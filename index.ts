import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

const MODIFYING_TOOLS = new Set([
  'write', 'edit',
  'lsp_rename', 'lsp_code_action_resolve',
  'ast_grep_replace'
])

// Educational messages for common jj mistakes
const JJ_CONCEPTS = {
  noStagingArea: `**JJ Concept: No Staging Area**

JJ automatically tracks all files in the working copy.
There is no "git add" or staging step for jj itself.

Just write files - they're automatically included in the current change.

However, if you're in a nix flake repo, use \`jj_file_track\` to add files
to git's index so nix can see them.`,

  orphanedCommits: (count: number, examples: string[]) => `**Orphaned Commits Detected (${count})**

Some commits are disconnected from main (marked with ↔ in jj log).
This happens when external operations change jj state.

Found orphans:
${examples.map(e => `• ${e}`).join('\n')}

Attempting automatic recovery...`,

  recoverySuccess: (restored: string[]) => `**Recovery Complete**

Restored changes from orphaned commits:
${restored.map(r => `• ${r}`).join('\n')}

The orphaned commits still exist. To clean up:
• \`jj abandon <commit-id>\` to remove them
• Or leave them (they don't affect anything)`,

  recoveryFailed: `**Recovery Failed**

Could not automatically restore orphaned changes.
Manual recovery options:
• \`jj log -r 'all()' --limit 10\` to see all commits
• \`jj rebase -s <commit-id> -d main\` to rebase orphan onto main
• \`jj restore --from <commit-id> <file>\` to restore specific files`,
}

// Session state: track if gate was opened (edits were allowed) this session
const sessionState = new Map<string, { gateOpened: boolean }>()

async function getCurrentDescription($: any): Promise<string> {
  try {
    return (await $`jj log -r @ --no-graph -T description`.text()).trim()
  } catch {
    return ''
  }
}

async function isJJRepo($: any): Promise<boolean> {
  try {
    await $`jj root`.text()
    return true
  } catch {
    return false
  }
}

async function isSubagent(client: any, sessionID: string): Promise<boolean> {
  try {
    const session = await client.session.get({ path: { id: sessionID } })
    return !!session.data?.parentID
  } catch {
    return false
  }
}

async function getChangeInfo($: any, rev: string = '@'): Promise<{ id: string; description: string; stats: string }> {
  try {
    const id = (await $`jj log -r ${rev} --no-graph -T 'change_id.shortest(8)'`.text()).trim()
    const description = (await $`jj log -r ${rev} --no-graph -T description`.text()).trim()
    const stats = (await $`jj diff -r ${rev} --stat`.text()).trim()
    return { id, description, stats }
  } catch {
    return { id: '', description: '', stats: '' }
  }
}

async function getCommitStack($: any, bookmark: string, targetRev: string): Promise<string[]> {
  try {
    const output = (await $`jj log -r '${bookmark}@origin..${targetRev}' --no-graph -T 'change_id.shortest(8) ++ " " ++ description.first_line() ++ "\n"'`.text()).trim()
    return output ? output.split('\n').filter(Boolean) : []
  } catch {
    return []
  }
}

interface PushTarget {
  revision: string
  info: { id: string; description: string; stats: string }
  stack: string[]
  needsConfirmation: boolean
}

async function findPushTarget($: any, bookmark: string): Promise<PushTarget | null> {
  const atInfo = await getChangeInfo($, '@')
  if (atInfo.description && atInfo.stats) {
    const stack = await getCommitStack($, bookmark, '@')
    return { revision: '@', info: atInfo, stack, needsConfirmation: false }
  }

  const parentInfo = await getChangeInfo($, '@-')
  if (parentInfo.description && parentInfo.stats) {
    const stack = await getCommitStack($, bookmark, '@-')
    return { revision: '@-', info: parentInfo, stack, needsConfirmation: false }
  }

  try {
    const unpushedOutput = (await $`jj log -r '${bookmark}@origin..@' --no-graph -T 'change_id.shortest(8) ++ "|" ++ description.first_line() ++ "\n"'`.text()).trim()
    const unpushedLines = unpushedOutput ? unpushedOutput.split('\n').filter(Boolean) : []
    
    const nonEmptyCommits = []
    for (const line of unpushedLines) {
      const [changeId] = line.split('|')
      const info = await getChangeInfo($, changeId)
      if (info.stats) {
        nonEmptyCommits.push({ changeId, info })
      }
    }

    if (nonEmptyCommits.length > 0) {
      const tipCommit = nonEmptyCommits[0]
      const stack = await getCommitStack($, bookmark, tipCommit.changeId)
      return {
        revision: tipCommit.changeId,
        info: tipCommit.info,
        stack,
        needsConfirmation: true
      }
    }
  } catch {}

  return null
}

async function isImmutable($: any, revset: string = '@'): Promise<boolean> {
  try {
    const result = (await $`jj log -r '${revset}' --no-graph -T 'if(immutable, "true", "false")'`.text()).trim()
    return result === 'true'
  } catch {
    return false
  }
}

interface OrphanedCommit {
  id: string
  description: string
  files: string[]
}

async function findOrphanedCommits($: any): Promise<OrphanedCommit[]> {
  try {
    // Find commits that are not ancestors of main and not the working copy
    const orphansOutput = (await $`jj log -r 'all() ~ ::main@origin ~ @' --no-graph -T 'change_id.shortest(8) ++ "|" ++ description.first_line() ++ "\n"'`.text()).trim()
    if (!orphansOutput) return []
    
    const orphans: OrphanedCommit[] = []
    for (const line of orphansOutput.split('\n').filter(Boolean)) {
      const [id, description] = line.split('|')
      if (!id) continue
      
      // Get files changed in this commit
      const files = await getFilesChangedInCommit($, id.trim())
      if (files.length > 0) {
        orphans.push({ id: id.trim(), description: description?.trim() || '(no description)', files })
      }
    }
    return orphans
  } catch {
    return []
  }
}

async function recoverOrphanedChanges($: any, orphans: OrphanedCommit[]): Promise<{ success: boolean; restored: string[] }> {
  const restored: string[] = []
  
  for (const orphan of orphans) {
    try {
      // Restore each file from the orphaned commit
      for (const file of orphan.files) {
        await $`jj restore --from ${orphan.id} ${file}`.quiet()
        restored.push(`${file} (from ${orphan.id}: ${orphan.description})`)
      }
    } catch {
      // Continue with other orphans if one fails
    }
  }
  
  return { success: restored.length > 0, restored }
}

async function getFilesInWorkingCopy($: any): Promise<string[]> {
  try {
    const output = (await $`jj diff --summary`.text()).trim()
    if (!output) return []
    return output.split('\n').filter(Boolean).map((line: string) => line.replace(/^[AMD] /, ''))
  } catch {
    return []
  }
}

async function addFilesToGitIndex($: any, files: string[]): Promise<{ added: string[]; failed: string[] }> {
  const added: string[] = []
  const failed: string[] = []
  
  for (const file of files) {
    try {
      await $`git add ${file}`.quiet()
      added.push(file)
    } catch {
      failed.push(file)
    }
  }
  
  return { added, failed }
}

async function getFilesChangedInCommit($: any, rev: string): Promise<string[]> {
  try {
    const output = (await $`jj diff -r ${rev} --summary`.text()).trim()
    if (!output) return []
    return output.split('\n').filter(Boolean).map((line: string) => line.replace(/^[AMD] /, ''))
  } catch {
    return []
  }
}

const JJ_ERROR_PATTERNS: Array<{ pattern: RegExp; message: (match: RegExpMatchArray) => string }> = [
  {
    pattern: /Commit (\S+) is immutable/i,
    message: (m) => `Cannot modify commit ${m[1]} - it's immutable (already pushed).

Recovery options:
• Continue with new work: jj describe -m "next task"
• Start fresh from main: jj new main@origin -m "description"
• Undo recent operation: jj undo`
  },
  {
    pattern: /working copy is stale/i,
    message: () => `Working copy is stale.

Recovery: jj workspace update-stale`
  },
]

function parseJjError(stderr: string): string | null {
  for (const { pattern, message } of JJ_ERROR_PATTERNS) {
    const match = stderr.match(pattern)
    if (match) return message(match)
  }
  return null
}

const plugin: Plugin = async ({ $, client }) => ({
  name: 'jj-opencode',

  tool: {
    jj_file_track: tool({
      description: `Add files to git's index so nix flakes can see them.

JJ automatically tracks all files, but nix flakes only see files in git's index.
Use this after creating/modifying files that nix needs to see.

Without arguments: adds all files in current jj working copy to git index.
With files argument: adds only specified files.`,
      args: {
        files: tool.schema.array(tool.schema.string()).optional().describe(
          "Specific files to add. If omitted, adds all files in jj working copy."
        ),
      },
      async execute(args) {
        if (!await isJJRepo($)) {
          return "Not a JJ repository."
        }

        const filesToAdd = args.files || await getFilesInWorkingCopy($)
        
        if (filesToAdd.length === 0) {
          return "No files to track. Working copy is clean."
        }

        const { added, failed } = await addFilesToGitIndex($, filesToAdd)
        
        let result = ""
        if (added.length > 0) {
          result += `**Added to git index (${added.length} files):**\n`
          result += added.map(f => `• ${f}`).join('\n')
          result += `\n\nThese files are now visible to nix flakes.`
        }
        
        if (failed.length > 0) {
          result += `\n\n**Failed to add (${failed.length} files):**\n`
          result += failed.map(f => `• ${f}`).join('\n')
        }
        
        if (added.length === 0 && failed.length === 0) {
          result = "No files needed to be added."
        }
        
        return result
      },
    }),

    jj_recover_orphans: tool({
      description: `Detect and recover orphaned commits.

Orphaned commits are disconnected from main (shown with ↔ in jj log).
This happens when external operations (like nix-darwin rebuild) change jj state.

This tool:
1. Finds orphaned commits with actual file changes
2. Restores those changes to the current working copy
3. Reports what was recovered`,
      args: {},
      async execute() {
        if (!await isJJRepo($)) {
          return "Not a JJ repository."
        }

        const orphans = await findOrphanedCommits($)
        
        if (orphans.length === 0) {
          return "No orphaned commits found. Repository is clean."
        }

        const examples = orphans.slice(0, 5).map(o => `${o.id}: ${o.description} (${o.files.length} files)`)
        let result = JJ_CONCEPTS.orphanedCommits(orphans.length, examples) + "\n\n"

        const { success, restored } = await recoverOrphanedChanges($, orphans)
        
        if (success) {
          result += JJ_CONCEPTS.recoverySuccess(restored)
        } else {
          result += JJ_CONCEPTS.recoveryFailed
        }
        
        return result
      },
    }),

    jj_push: tool({
      description: `Push current JJ change to a bookmark (default: main). 
Auto-detects push target: checks @ first, then @- if @ is empty (common after session idle).
Only specify 'bookmark' if user explicitly requested a specific branch.`,
      args: {
        bookmark: tool.schema.string().optional().describe(
          "Target bookmark/branch. ONLY set if user explicitly specified. Defaults to 'main'."
        ),
        confirmed: tool.schema.boolean().optional().describe(
          "Set to true after user confirms the push preview."
        ),
      },
      async execute(args) {
        if (!await isJJRepo($)) {
          return "Not a JJ repository."
        }

        const bookmark = args.bookmark || 'main'
        const target = await findPushTarget($, bookmark)

        if (!target) {
          return `Nothing to push. No unpushed changes between \`${bookmark}@origin\` and \`@\`.`
        }

        if (await isImmutable($, target.revision)) {
          return `Target commit is already immutable (pushed). Start new work: jj describe -m "description"`
        }

        const { revision, info, stack, needsConfirmation } = target
        const totalCommits = stack.length

        if (!args.confirmed) {
          let preview = `## Push Preview\n\n`
          preview += `**Target:** \`${revision}\` ${revision !== '@' ? '(@ is empty)' : ''}\n\n`
          preview += `**${totalCommits} commit(s) will be pushed to \`${bookmark}\`:**\n\n`
          preview += `\`\`\`\n`
          for (const commit of stack) {
            preview += `${commit}\n`
          }
          preview += `\`\`\`\n\n`
          preview += `**Files in tip commit:**\n\`\`\`\n${info.stats}\n\`\`\`\n\n`
          
          if (needsConfirmation) {
            preview += `⚠️  **Note:** Had to search beyond \`@-\` to find changes. Please verify this is correct.\n\n`
          }
          
          preview += `After pushing, these commits become **immutable**.\n\n`
          preview += `Call with \`confirmed: true\` to push.`
          
          return preview
        }

        try {
          if (revision === '@') {
            await $`jj new`.text()
            await $`jj bookmark set ${bookmark} -r @-`.text()
          } else {
            await $`jj bookmark set ${bookmark} -r ${revision}`.text()
          }
          
          await $`jj git push -b ${bookmark}`.text()

          const postPushDesc = (await $`jj log -r @ --no-graph -T description`.text()).trim()
          const isClean = !postPushDesc
          
          let result = `Pushed ${totalCommits} commit(s) to \`${bookmark}\`:\n\n`
          for (const commit of stack) {
            result += `• ${commit}\n`
          }
          result += `\nThese commits are now **immutable**.`
          
          if (isClean) {
            result += ` Working copy is clean and ready.`
          } else {
            result += `\n\n⚠️  Working copy has description set. Run \`jj new\` if starting fresh work.`
          }
          
          return result
        } catch (error: any) {
          const recoveryMessage = parseJjError(error.message)
          if (recoveryMessage) {
            return recoveryMessage
          }
          return `Push failed: ${error.message}`
        }
      },
    }),
  },

  "tool.execute.before": async ({ tool: toolName, sessionID }) => {
    if (!MODIFYING_TOOLS.has(toolName)) return
    if (!await isJJRepo($)) return
    
    const description = await getCurrentDescription($)
    if (description.length > 0) {
      const state = sessionState.get(sessionID) || { gateOpened: false }
      state.gateOpened = true
      sessionState.set(sessionID, state)
      return
    }

    const subagent = await isSubagent(client, sessionID)
    
    if (subagent) {
      throw new Error(
        `BLOCKED: JJ gate is closed.\n\n` +
        `You are a subagent. Return to the parent agent with this message:\n\n` +
        `"Cannot edit files - no JJ change description set. ` +
        `Parent must run: jj describe -m \\"description\\" before delegating file edits."`
      )
    }

    throw new Error(
      `Describe your intent before editing:\n\n` +
      `    jj describe -m "what you're about to do"\n\n` +
      `When done, run \`jj new\` to commit and start fresh.\n\n` +
      `---\n` +
      `${JJ_CONCEPTS.noStagingArea}`
    )
  },

  event: async ({ event }) => {
    const props = event.properties as Record<string, unknown> | undefined

    if (event.type === "session.deleted") {
      const sessionID = props?.sessionID as string | undefined
      if (sessionID) sessionState.delete(sessionID)
      return
    }

    if (event.type === "session.idle") {
      const sessionID = props?.sessionID as string | undefined
      if (!sessionID) return

      if (await isSubagent(client, sessionID)) return

      const state = sessionState.get(sessionID)
      if (!state?.gateOpened) return

      if (!await isJJRepo($)) return

      const stats = (await $`jj diff --stat`.text()).trim()
      if (!stats || stats.includes("0 files changed")) return

      const description = await getCurrentDescription($)
      if (!description) return

      try {
        // Check if @- has actual changes (non-empty parent)
        // If so, create child of @- to continue the chain
        // Otherwise, create sibling from main (default behavior)
        const parentStats = (await $`jj diff -r @- --stat`.text()).trim()
        const parentHasChanges = parentStats && !parentStats.includes("0 files changed")
        
        if (parentHasChanges) {
          // Continue from last work - creates linear chain
          await $`jj new @-`.quiet()
        } else {
          // Start fresh from main - creates sibling
          await $`jj new`.quiet()
        }
        sessionState.set(sessionID, { gateOpened: false })
      } catch {
        // Silent fail - user will see uncommitted work next session
      }
    }
  },
})

export default plugin

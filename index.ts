import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { createState, getState, setState, inheritParentState, deleteState } from './lib/state.js'
import { checkGate, isGatedTool } from './lib/gate.js'
import { analyzeBashCommand, checkForGitCommand } from './lib/bash-filter.js'
import { getParentSessionId } from './lib/subagent.js'
import * as jj from './lib/jj.js'
import * as messages from './lib/messages.js'

/**
 * Validate description quality - enforces meaningful change descriptions
 */
function validateDescription(description: string): { valid: boolean; message?: string } {
  const trimmed = description.trim()
  
  // Check minimum length
  if (trimmed.length < 10) {
    return {
      valid: false,
      message: messages.DESCRIPTION_TOO_SHORT(trimmed.length),
    }
  }
  
  // Check for single-word descriptions
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  if (words.length < 2) {
    return {
      valid: false,
      message: messages.DESCRIPTION_SINGLE_WORD,
    }
  }
  
  return { valid: true }
}

const plugin: Plugin = async (ctx) => {
  const { client, $ } = ctx

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const sessionId = event.properties.info.id

        const parentId = await getParentSessionId(client, sessionId)
        if (parentId) {
          const inherited = inheritParentState(sessionId, parentId)
          if (inherited) {
            return
          }
        }

        const isJJRepo = await jj.isJJRepo($)

        if (!isJJRepo) {
          createState(sessionId, {
            gateUnlocked: false,
            isJJRepo: false,
          })
          return
        }

        const changeId = await jj.getCurrentChangeId($)
        const description = await jj.getCurrentDescription($)
        const hasActiveChange = description.length > 0

        createState(sessionId, {
          gateUnlocked: hasActiveChange,
          changeId,
          changeDescription: description,
          isJJRepo: true,
        })
      }

      if (event.type === 'session.deleted') {
        deleteState(event.properties.info.id)
      }
    },

    "tool.execute.before": async (input, output) => {
      const { tool: toolName, sessionID } = input

      if (toolName === 'bash') {
        const command = output.args?.command || ''
        
        const gitCheck = checkForGitCommand(command)
        if (gitCheck.isGitCommand) {
          throw new Error(messages.GIT_COMMAND_BLOCKED(
            gitCheck.gitSubcommand!,
            gitCheck.jjAlternative!
          ))
        }

        const bashCheck = analyzeBashCommand(command)
        if (bashCheck.isModifying) {
          const gateCheck = checkGate(sessionID, 'bash')
          if (!gateCheck.allowed) {
            throw new Error(gateCheck.message)
          }
        }
        return
      }

      if (isGatedTool(toolName)) {
        const gateCheck = checkGate(sessionID, toolName)
        if (!gateCheck.allowed) {
          throw new Error(gateCheck.message)
        }
      }
    },

    "tool.execute.after": async (input, output) => {
      const { tool: toolName, sessionID } = input
      const state = getState(sessionID)

      if (!state) return

      if (toolName === 'write' || toolName === 'edit') {
        const filePath = output.metadata?.filePath || output.title
        if (filePath && !state.modifiedFiles.includes(filePath)) {
          setState(sessionID, {
            modifiedFiles: [...state.modifiedFiles, filePath],
          })
        }
      }
    },

    tool: {
      jj: tool({
        description: "Create a new JJ change and unlock file editing. Run this BEFORE making any file edits.",
        args: {
          description: tool.schema.string().describe("Description of the work you're about to do"),
        },
        async execute(args, context) {
          const validation = validateDescription(args.description)
          if (!validation.valid) {
            return validation.message!
          }

          let warning = ''
          const fetchResult = await jj.gitFetch($)
          if (!fetchResult.success) {
            warning = `Note: git fetch skipped (${fetchResult.error})\n\n`
          }

          const newResult = await jj.newChange($, args.description)
          if (!newResult.success) {
            return `Error creating change: ${newResult.error}`
          }

          setState(context.sessionID, {
            gateUnlocked: true,
            changeId: newResult.changeId || null,
            changeDescription: args.description,
            isJJRepo: true,
          })

          return warning + messages.JJ_INIT_SUCCESS(newResult.changeId || 'unknown', args.description)
        },
      }),

      jj_status: tool({
        description: "Show current JJ change status, gate state, and diff summary",
        args: {},
        async execute(args, context) {
          const state = getState(context.sessionID)
          const changeId = await jj.getCurrentChangeId($)
          const description = await jj.getCurrentDescription($)
          const diffSummary = await jj.getDiffSummary($)
          const status = await jj.getStatus($)

          const lines = [
            '## JJ Status',
            '',
            `| Field | Value |`,
            `|-------|-------|`,
            `| Gate | ${state?.gateUnlocked ? 'UNLOCKED' : 'LOCKED'} |`,
            `| JJ Repo | ${state?.isJJRepo ? 'Yes' : 'No'} |`,
            `| Change ID | \`${changeId || 'none'}\` |`,
            `| Description | ${description || '(empty)'} |`,
            '',
            '### Working Copy Status',
            '```',
            status || '(no changes)',
            '```',
            '',
            '### Diff Summary',
            '```',
            diffSummary || '(no diff)',
            '```',
          ]

          return lines.join('\n')
        },
      }),

      jj_push: tool({
        description: "Validate changes and push to remote. First call shows confirmation, second call with confirm:true pushes.",
        args: {
          bookmark: tool.schema.string().optional().describe("Bookmark name to push (defaults to 'main')"),
          confirm: tool.schema.boolean().optional().describe("Set to true to confirm and push after reviewing"),
        },
        async execute(args, context) {
          const state = getState(context.sessionID)
          if (!state?.gateUnlocked) {
            return messages.GATE_NOT_UNLOCKED
          }

          const bookmark = args.bookmark || 'main'

          const diffFiles = await jj.getDiffFiles($)
          if (diffFiles.length === 0) {
            return messages.PUSH_NO_CHANGES
          }

          const description = await jj.getCurrentDescription($)
          const diffSummary = await jj.getDiffSummary($)

          if (!args.confirm) {
            return messages.PUSH_CONFIRMATION(description, diffFiles, diffSummary)
          }

          let warning = ''
          if (description.length < 10) {
            warning = messages.PUSH_DESCRIPTION_WARNING(description, diffFiles) + '\n\n'
          }

          const bookmarkResult = await jj.bookmarkMove($, bookmark)
          if (!bookmarkResult.success) {
            return `Error moving bookmark '${bookmark}': ${bookmarkResult.error}`
          }

          const pushResult = await jj.gitPush($, bookmark)
          if (!pushResult.success) {
            return `Error pushing: ${pushResult.error}`
          }

          setState(context.sessionID, {
            gateUnlocked: false,
            changeId: null,
            changeDescription: '',
            modifiedFiles: [],
          })

          return warning + messages.PUSH_SUCCESS(description, bookmark)
        },
      }),

      jj_git_init: tool({
        description: "Initialize JJ in this directory. Only available if not already a JJ repo.",
        args: {},
        async execute(args, context) {
          const state = getState(context.sessionID)
          if (state?.isJJRepo) {
            return "This directory is already a JJ repository. Use `jj()` to create a new change."
          }

          const result = await jj.gitInit($)
          if (!result.success) {
            return `Error initializing JJ: ${result.error}`
          }

          setState(context.sessionID, {
            isJJRepo: true,
          })

          return messages.JJ_GIT_INIT_SUCCESS
        },
      }),
    },
  }
}

export default plugin

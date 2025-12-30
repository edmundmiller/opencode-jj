export const GATE_BLOCK_MESSAGE = `
**Edit blocked**: No JJ change defined for this session.

Before I can modify files, I need to know what change you want to make.

**What work are you about to do?**

Once you describe it, I'll run:
\`\`\`bash
jj git fetch && jj new main@origin -m "your description"
\`\`\`

This creates a new JJ change that tracks all your work with clear intent.

Just tell me what you're implementing and I'll set it up.
`

export const NOT_JJ_REPO_MESSAGE = `
**This directory is not a JJ repository.**

I can initialize JJ for you - it's fully Git-compatible and won't affect your existing Git history.

**To get started**, call \`jj_git_init()\` and I'll:
1. Initialize JJ in this directory
2. Ask what change you want to make
3. Set up tracking so all your work is captured

Would you like me to proceed?
`

export const JJ_INIT_SUCCESS = (changeId: string, description: string): string => `
**Change created successfully**

| Field | Value |
|-------|-------|
| Change ID | \`${changeId}\` |
| Description | ${description} |
| Base | \`main@origin\` (latest remote) |

You may now edit files. All changes will be tracked in this change.

When ready to push, call \`jj_push()\`.
`

export const JJ_GIT_INIT_SUCCESS = `
**JJ initialized successfully**

This directory is now a JJ repository. JJ is fully Git-compatible - your existing Git history is preserved.

**Next step**: What change are you about to make?

Call \`jj("description of your work")\` to create your first change and unlock file editing.
`

export const GATE_NOT_UNLOCKED = `
**No active JJ change.**

You need to define your change first. Call:
\`jj("description of your work")\`
`

export const PUSH_DESCRIPTION_WARNING = (description: string, files: string[]): string => `
**Description may not match changes**

Current description: "${description}"
Files modified: ${files.join(', ')}

Consider running \`jj describe -m "new description"\` before pushing.
`

export const PUSH_SUCCESS = (description: string, bookmark: string = 'main'): string => `
**Pushed successfully**

Change "${description.trim()}" has been pushed to **${bookmark}**.

**Gate locked.** To continue working, call \`jj("next task description")\` to create a new checkpoint.
`

export const PUSH_NO_CHANGES = `
**No changes to push.**

The working copy has no modifications. Make some changes first, then call \`jj_push()\`.
`

export const DESCRIPTION_TOO_SHORT = (length: number): string => `
**Description too short** (${length} characters)

Change descriptions must be at least 10 characters. Please provide a meaningful description of what you're implementing.

Example: "Add user authentication to login page"
`

export const DESCRIPTION_SINGLE_WORD = `
**Description must be more than one word**

Single-word descriptions don't provide enough context. Please describe what change you're making.

Example: "Fix pagination bug in user list"
`

export const PUSH_CONFIRMATION = (description: string, files: string[], diffSummary: string): string => `
**Ready to push?**

| Field | Value |
|-------|-------|
| Description | ${description} |
| Files changed | ${files.length} |

### Files
${files.map(f => '- ' + f).join('\n')}

### Diff Summary
\`\`\`
${diffSummary}
\`\`\`

Call \`jj_push(confirm: true)\` to proceed, or run \`jj describe -m "new description"\` to update first.
`

export const GIT_COMMAND_BLOCKED = (gitSubcommand: string, jjAlternative: string): string =>
  `**Git command blocked** - use JJ instead\n\n` +
  `You tried to run: \`git ${gitSubcommand}\`\n\n` +
  `**JJ equivalent**: \`${jjAlternative}\`\n\n` +
  `This project uses JJ (Jujutsu) for version control. JJ is Git-compatible but provides a better workflow:\n` +
  `- Working copy is always a commit (no staging area)\n` +
  `- Changes are automatically tracked\n` +
  `- Parallel changes are easy with \`jj new\`\n\n` +
  `Use the \`jj_*\` tools or run JJ commands directly.`

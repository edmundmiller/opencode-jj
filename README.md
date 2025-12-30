# jj-opencode

[![npm version](https://img.shields.io/npm/v/jj-opencode.svg)](https://www.npmjs.com/package/jj-opencode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OpenCode plugin that enforces JJ's "define change before implementation" workflow.

## What It Does

This plugin prevents file modifications until you define what change you're making. It enforces the pattern:

```bash
jj git fetch && jj new main@origin -m "description of work"
```

**Before** you can edit any files.

## Quick Start

```bash
# 1. Install
npm install -g jj-opencode

# 2. Add to OpenCode config (~/.config/opencode/config.json)
{ "plugin": ["jj-opencode"] }

# 3. Use /jj before editing
/jj "Add feature X"
# Now you can edit files
```

## Installation

### From npm (recommended)

```bash
npm install -g jj-opencode
```

Then add to your OpenCode config (`~/.config/opencode/config.json`):

```json
{
  "plugin": ["jj-opencode"]
}
```

The postinstall script automatically copies slash commands (`/jj`, `/jj-push`) to `~/.config/opencode/command/`.

### Local Development

Clone the repo and symlink:

```bash
git clone https://github.com/dpshade/jj-opencode
cd jj-opencode
bun install
bun run build

# Symlink the plugin
ln -s $(pwd) ~/.config/opencode/plugin/jj-opencode

# Install slash commands
node bin/setup.js
```

## How It Works

1. **Session starts** → Gate is LOCKED
2. **You try to edit** → BLOCKED with helpful message
3. **You run `/jj "add feature X"`** → Gate UNLOCKS
4. **You edit freely** → All changes tracked in JJ change
5. **You run `/jj-push`** → Pushes to remote, **gate locks again**
6. **Next task?** → Run `/jj "next task"` to unlock

## Available Commands

### Slash Commands (User-facing)

| Command | Purpose |
|---------|---------|
| `/jj "description"` | Create new JJ change and unlock editing |
| `/jj-push` | Preview and push changes to remote |

### Tools (AI-facing)

| Tool | Purpose |
|------|---------|
| `jj(description)` | Create new JJ change from `main@origin`, unlock editing |
| `jj_push(bookmark?, confirm?)` | Preview then push (requires `confirm: true`) |
| `jj_status()` | Show current change, gate state, and diff summary |
| `jj_git_init()` | Initialize JJ in non-JJ repo |

## Push Requires Confirmation

**Important**: The `/jj-push` command uses a two-step process:

1. First call shows a preview of changes and asks for permission
2. Only after you explicitly confirm does it actually push

The AI cannot auto-push without your approval.

## What's Blocked

Until a change is defined via `/jj` or `jj()`:
- File write/edit operations
- Bash commands that modify files (sed -i, rm, mv, etc.)
- LSP rename/code action operations
- AST grep replace operations

**All git commands are blocked** with JJ alternatives suggested:

| Git Command | JJ Alternative |
|-------------|----------------|
| `git status` | `jj st` |
| `git log` | `jj log` |
| `git diff` | `jj diff` |
| `git add` | (not needed) |
| `git commit` | `jj describe -m "..."` |
| `git push` | `/jj-push` or `jj_push()` |
| `git checkout` | `jj edit <change>` |
| `git branch` | `jj bookmark list` |
| `git stash` | (use `jj new`) |
| `git pull` | `jj git fetch && jj rebase` |

What's always allowed:
- Reading files
- Searching (grep, glob)
- LSP queries (hover, definitions)
- Web lookups
- JJ commands (`jj log`, `jj st`, etc.)
- Spawning subagents (they inherit gate state)

## Description Quality

Descriptions must be at least 10 characters and more than one word. This ensures meaningful change context.

## Workflow Example

```
Session starts
    ↓
Gate is LOCKED
    ↓
User: "Add a validation function to utils.ts"
    ↓
AI attempts to edit → BLOCKED
    ↓
AI runs: /jj "Add input validation function to utils.ts"
    ↓
Gate UNLOCKS, change ID assigned
    ↓
AI edits utils.ts freely
    ↓
Work complete → /jj-push
    ↓
Gate LOCKS again (checkpoint complete)
    ↓
Next task? Run /jj "description" to start new checkpoint
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Edit blocked unexpectedly | Run `jj_status()` to check gate state |
| Wrong change description | Run `jj describe -m "new description"` |
| Want to start over | Run `jj abandon` then `/jj "new description"` |
| Push fails | Check `jj_status()`, fix issues, try `/jj-push` again |
| Plugin not loading | Verify `~/.config/opencode/config.json` includes `"plugin": ["jj-opencode"]` |

## JJ Concepts

New to JJ? Here are the key concepts:

- **Change ID**: Stable identifier that survives rebases (e.g., `skvrkxkk`)
- **Commit ID**: Git-style hash that changes on every edit (e.g., `52ba303b`)
- **Working copy = commit**: Your edits are always in a commit context
- **`@`**: Refers to the current working-copy change

## Why?

JJ (Jujutsu) treats the working copy as an implicit commit. The `jj new -m "description"` command declares your intent BEFORE you start implementing. This plugin enforces that pattern at the tooling level.

Benefits:
- **Intentionality**: Forces you to think before coding
- **Audit trail**: Every change has a description from the start
- **Parallel work**: Multiple changes as siblings from main
- **JJ philosophy**: The tool enforces what JJ was designed for

## Requirements

- [JJ (Jujutsu)](https://github.com/jj-vcs/jj) installed and in PATH
- [OpenCode](https://github.com/opencode-ai/opencode) with plugin support

## License

MIT

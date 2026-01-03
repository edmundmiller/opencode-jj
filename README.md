# jj-opencode

> [!NOTE]
>
> *"Git worktrees are powerful but clunky. JJ workspaces are elegant but manual. This plugin makes parallel AI development feel like magic — describe what you're doing, implement, push, done. No staging, no stashing, no merge conflicts, no cleanup."*

<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

**Git worktrees are dead. Long live JJ workspaces.**

[![npm version](https://img.shields.io/npm/v/opencode-jj.svg?color=cb3837&labelColor=black&style=flat-square)](https://www.npmjs.com/package/opencode-jj)
[![GitHub Stars](https://img.shields.io/github/stars/edmundmiller/opencode-jj?color=ffcb47&labelColor=black&style=flat-square)](https://github.com/edmundmiller/opencode-jj/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-white?labelColor=black&style=flat-square)](https://opensource.org/licenses/MIT)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

**The simplest way to do parallel AI-assisted development.**

No more `git worktree add`. No more `git stash`. No more merge conflicts. No more forgotten cleanup.

Just: **describe → implement → push → done**.

---

## Contents

- [Just Skip Reading This](#just-skip-reading-this)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Installation](#installation)
- [How It Works](#how-it-works)
- [Side-by-Side Comparison](#side-by-side-git-worktrees-vs-jj-opencode)
- [Available Tools](#available-tools)
- [Parallel Development](#parallel-development-with-workspaces)
- [Why JJ Over Git?](#why-jj-over-git)
- [Troubleshooting](#troubleshooting)
- [Warnings](#warnings)

---

## Just Skip Reading This

### For LLM Agents

If you're an AI agent helping set up opencode-jj:

```bash
npm install -g opencode-jj
```

Add to `~/.config/opencode/config.json`:
```json
{ "plugin": ["opencode-jj"] }
```

Done. The plugin handles everything else. When the user asks you to edit files, you'll be prompted to describe the change first. Workspaces are created and cleaned up automatically.

### For Humans Who Don't Like Reading

1. Install: `npm install -g opencode-jj`
2. Add `"opencode-jj"` to your OpenCode plugins
3. Start coding — the plugin guides you through the rest

**That's it.** The AI handles workspace creation, cleanup, and all the JJ ceremony. You just say what you want to build.

---

## The Problem

Git worktrees let you work on multiple branches simultaneously. But they're a pain:

| What You Want | What Git Makes You Do |
|---------------|----------------------|
| Start a new feature | `git worktree add ../proj-feature -b feature-x` |
| Context switch | `git stash && cd ../other-worktree` |
| Come back | `cd ../original && git stash pop` |
| Finish up | `git rebase main` (pray for no conflicts) |
| Clean up | `git worktree remove ../proj-feature && git branch -d feature-x` |

**20+ commands** for something that should be: "work on this" → "now work on that" → "ship both".

---

## The Solution

<table>
<tr>
<th width="50%">Git Worktrees (~15 commands)</th>
<th width="50%">jj-opencode (2 conversations)</th>
</tr>
<tr>
<td>

```bash
# Terminal 1
git worktree add ../proj-feature -b feature
cd ../proj-feature
# work...
git add . && git commit -m "add auth"
git rebase main
git push origin feature

# Terminal 2
git worktree add ../proj-hotfix -b hotfix
cd ../proj-hotfix
# work...
git add . && git commit -m "fix"
git push origin hotfix

# Cleanup (often forgotten)
git worktree remove ../proj-hotfix
git branch -d hotfix
```

</td>
<td>

```
# Terminal 1: opencode
You: "Add authentication"
AI:  ✓ Workspace created
     [works...] 
You: "ship it"
AI:  ✓ Pushed, cleaned up

# Terminal 2: opencode (same repo)
You: "Fix that auth bug"
AI:  ✓ Workspace created
     [works...]
You: "ship it"
AI:  ✓ Pushed, cleaned up
```

</td>
</tr>
</table>

**No staging. No stashing. No rebasing. No manual cleanup. No merge conflicts.**

---

## Installation

```bash
# Install
npm install -g opencode-jj

# Add to OpenCode config (~/.config/opencode/config.json)
{
  "plugin": ["opencode-jj"]
}

# That's it. Start working.
```

### Requirements

- [JJ (Jujutsu)](https://github.com/jj-vcs/jj) — Git-compatible VCS
- [OpenCode](https://github.com/opencode-ai/opencode) — AI coding assistant

---

## How It Works

### The Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│  1. OPEN REPO                                                   │
│     Working copy is empty (clean from last session)             │
│     Gate is LOCKED — can't edit until you describe the work     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. BEGIN CHANGE                                                │
│     You: "Add input validation"                                 │
│     AI calls jj("Add input validation") → workspace created     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. IMPLEMENT                                                   │
│     Gate UNLOCKED — AI edits freely in isolated workspace       │
│     All changes tracked automatically                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
          ┌───────────────────┴───────────────────┐
          ↓                                       ↓
┌─────────────────────────┐         ┌─────────────────────────────┐
│  PARALLEL WORK          │         │  4. PUSH                    │
│  (optional)             │         │     You: "ship it"          │
│                         │         │     AI: confirms, pushes    │
│  Create more            │         │     Workspace auto-deleted  │
│  workspaces for         │         │     Back to clean state     │
│  other features         │         │     Gate LOCKS              │
└─────────────────────────┘         └─────────────────────────────┘
                                                  ↓
                              ┌────────────────────────────────────┐
                              │  CYCLE COMPLETE — ready for next   │
                              └────────────────────────────────────┘
```

**Key insight**: After push, workspace is deleted and you're back to a clean repo. No cruft accumulates. Ever.

### What Gets Blocked

Until you describe your change:
- File writes/edits
- LSP renames
- AST replacements

**Git commands are always blocked** — the plugin suggests JJ equivalents:

| You Type | Plugin Says |
|----------|-------------|
| `git status` | Use `jj st` |
| `git add && git commit` | Not needed — just `jj describe` |
| `git stash` | Not needed — just `jj new` |
| `git push` | Use `jj_push()` |

---

## Side-by-Side: Git Worktrees vs jj-opencode

<table>
<tr>
<th width="50%">Git Worktrees</th>
<th width="50%">jj-opencode</th>
</tr>
<tr>
<td>

```bash
# Terminal 1: Set up feature work
git worktree add ../proj-feature -b feature
cd ../proj-feature
# work on feature...
```

</td>
<td>

```
# Terminal 1
$ opencode
You: "Add user authentication"

AI: ✓ Workspace created
    ✓ Ready to edit
    [working on feature...]
```

</td>
</tr>
<tr>
<td>

```bash
# Terminal 2: Set up hotfix (separate terminal)
git worktree add ../proj-hotfix -b hotfix
cd ../proj-hotfix
# work on hotfix...
```

</td>
<td>

```
# Terminal 2 (same repo, new opencode)
$ opencode
You: "Fix that auth bug"

AI: ✓ Workspace created
    ✓ Ready to edit
    [working on fix...]
```

</td>
</tr>
<tr>
<td>

```bash
# Terminal 2: Push hotfix
git add . && git commit -m "fix auth bug"
git push origin hotfix
```

</td>
<td>

```
# Terminal 2
You: "ship it"

AI: ✓ Pushed, workspace cleaned up
```

</td>
</tr>
<tr>
<td>

```bash
# Terminal 1: Push feature
git add . && git commit -m "add auth"
git rebase main  # pray for no conflicts
git push origin feature

# Manual cleanup (often forgotten)
git worktree remove ../proj-hotfix
git branch -d hotfix
```

</td>
<td>

```
# Terminal 1
You: "ship it"

AI: ✓ Pushed, workspace cleaned up
```

</td>
</tr>
<tr>
<td>

**~15 commands** across 2 terminals, manual cleanup, merge conflicts possible

</td>
<td>

**2 conversations**, automatic cleanup, no conflicts

</td>
</tr>
</table>

---

## Available Tools

| Tool | What It Does |
|------|--------------|
| `jj("description")` | Create change, unlock editing |
| `jj_status()` | Show current state |
| `jj_push()` | Preview and push (requires confirmation) |
| `jj_workspace("description")` | Create parallel workspace |
| `jj_workspaces()` | List all workspaces |
| `jj_cleanup()` | Remove empty commits and stale workspaces |
| `jj_undo()` | Undo last operation |
| `jj_describe("new description")` | Update change description |
| `jj_abandon()` | Abandon current change |

### Push Requires Confirmation

The AI **cannot auto-push**. `jj_push()` always shows a preview first:

```
AI: Ready to push to main:
    
    Files changed (2):
      M src/auth.ts
      M src/validation.ts
    
    Description: "Add input validation"
    
    Confirm?

You: "yes"

AI: ✓ Pushed to main
```

---

## Parallel Development with Workspaces

Work on multiple features at once — just open multiple terminals:

```
# Terminal 1                          # Terminal 2
$ opencode                            $ opencode
You: "Add authentication"             You: "Fix that auth bug"
AI: ✓ Workspace created               AI: ✓ Workspace created
    [working...]                          [working...]

# Both work independently in isolated workspaces
# Push in any order — each cleans up automatically
```

Each `opencode` session gets its own workspace. No coordination needed.

### Directory Structure

```
myproject/
├── .jj/                    # JJ internal storage
├── .workspaces/            # AI workspaces (gitignored, temporary)
│   ├── add-feature-a/      
│   └── fix-auth-bug/       
├── src/
└── ...
```

---

## Why JJ Over Git?

| Git Pain | JJ Solution |
|----------|-------------|
| Staging area | None — working copy IS the commit |
| `git stash` | Just `jj new` — everything's a commit |
| Merge conflicts | Auto-rebase, conflicts resolved in-place |
| Detached HEAD | Can't happen |
| Branch management | Bookmarks are just labels |
| Worktrees | Built-in workspaces, simpler |

**This plugin adds**:
- Automatic workspace creation/cleanup
- Gate enforcement (describe before implement)
- AI-friendly workflow
- Clean development cycles

### The Philosophy

Instead of:
```bash
git checkout -b feature-x
# ... forget what you were doing ...
git add -p  # what should I stage?
git commit -m "stuff"  # vague message after the fact
```

You get:
```bash
jj("Add input validation to signup form")  # intent declared upfront
# ... implement with full context ...
jj_push()  # clean push, workspace cleaned up
```

**Intentionality** → **Audit trail** → **Clean parallel work** → **No cruft**

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Edit blocked | `jj_status()` to check gate state |
| Wrong description | `jj_describe("new description")` |
| Start over | `jj_abandon()` then new change |
| Made a mistake | `jj_undo()` |
| Push fails | `jj_status()`, fix issues, try again |
| Cruft accumulated | `jj_cleanup()` |

---

## Pairs Well With

This plugin was inspired by and works seamlessly with [oh-my-opencode](https://github.com/YeonGyu-Kim/oh-my-opencode) — an excellent OpenCode orchestration layer that enhances agent capabilities with parallel task execution and specialized subagents.

**Subagent inheritance**: When you spawn subagents via the `task` tool, they inherit the parent session's gate state. If the parent called `jj()`, all subagents can edit files immediately — no need to call `jj()` again. All their changes flow into the same JJ change, making oh-my-opencode's parallel workflows work seamlessly with jj-opencode's change tracking.

---

## Warnings

- You might ship features faster than your team can review them
- You might forget how painful git worktrees were
- You might start expecting other tools to be this simple

---

## JJ Concepts (For the Curious)

New to JJ? Quick primer:

- **Change ID**: Stable identifier that survives rebases (e.g., `skvrkxkk`)
- **Commit ID**: Git-style hash that changes on every edit
- **Working copy = commit**: Your edits are always in a commit context
- **`@`**: The current working-copy change
- **Bookmarks**: JJ's version of branches (just labels, easily moved)

---

## License

MIT

---
name: jj-opencode
description: "JJ VCS integration - describe intent before every edit"
alwaysApply: true
---

# jj-opencode

Blocks edits until you describe your intent. Every logical unit of work gets its own commit.

## Workflow

```
jj describe -m "Add input validation"  ← declare intent, unlocks editing
[edit files]                           ← edits go to this commit
[session ends]                         ← auto-commits, locks editing

jj describe -m "Add tests"             ← declare next intent, unlocks
[edit files]
[session ends]                         ← auto-commits, locks editing
```

`jj new` runs automatically when the session goes idle. No manual commit needed.

**If something goes wrong:** `jj undo` reverts the last operation.

## What's Blocked

Until `jj describe -m "description"` is run:
- `write`, `edit`
- `lsp_rename`, `lsp_code_action_resolve`
- `ast_grep_replace`

## Commands

| Task | Command |
|------|---------|
| Start work | `jj describe -m "what you're about to do"` |
| Finish work | *(automatic on session idle)* |
| Check status | `jj st` |
| View history | `jj log` |
| Undo | `jj undo` |
| Abandon current work | `jj abandon @` |
| Push to remote | `jj_push` tool (or specify bookmark: `jj_push bookmark="feature"`) |

## Tools

### jj_push

Safely pushes changes to a bookmark (defaults to `main`).

```
jj_push                      ← push to main
jj_push bookmark="feature"   ← push to feature branch (user must specify)
```

The tool auto-detects what to push:
- If `@` has changes → pushes `@`
- If `@` is empty (common after session idle) → pushes `@-`
- If both empty → searches for unpushed commits, requires confirmation

Flow:
1. Shows preview with commits and files to push
2. Requires user confirmation
3. Moves bookmark → pushes → verifies clean working copy

**Important:** Only specify a bookmark if the user explicitly requested it.

## Subagents

If a subagent tries to edit without a description, it will be blocked and instructed to return to the parent agent. Only the primary agent should manage JJ workflow (describe, new, push).

## Why This Workflow?

1. **Guaranteed separation** — `jj new` runs automatically, re-engaging the gate
2. **Never lose work** — every edit is in a described commit
3. **Clear history** — `jj log` shows what happened step by step
4. **No WIP commits** — every commit has meaning

## JJ ≠ Git (CRITICAL)

### The #1 Mistake: Sequential Pushing

**Git thinking (WRONG):**
```
Push parent commit → Push child commit → Push next...
```

**JJ thinking (CORRECT):**
```
Move bookmark to tip → Push once (all ancestors included automatically)
```

### What Actually Happens

```
@ (commit C - docs)
│
◉ (commit B - feature)  
│
◆ main@origin (commit A)

WRONG: Push B first, then push C  ← Creates immutability issues
RIGHT: Point main at C, push once ← B and C both pushed
```

### Why This Matters

1. **Ancestors are automatic** — pushing a bookmark pushes ALL commits between `bookmark@origin` and the new target
2. **Commits become immutable after push** — you can't squash/rewrite them
3. **No sequential pushing needed** — one push, all commits

### Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Push commits one at a time | Push bookmark once (includes all ancestors) |
| Squash after pushing | Squash BEFORE pushing (commits are immutable after) |
| Think "I need to push each commit" | Think "move bookmark to tip, push bookmark" |

### Command Mapping

| Git | JJ |
|-----|-----|
| `git status` | `jj st` |
| `git log` | `jj log` |
| `git diff` | `jj diff` |
| `git add && git commit` | Not needed |
| `git push` | `jj git push -b main` |

## Before Push

Just call `jj_push` — it auto-detects the right commit and shows a preview.

Wait for explicit "yes" before calling with `confirmed: true`.

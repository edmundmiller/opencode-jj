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

## Automatic Chaining (Session Idle Behavior)

When session goes idle, the plugin auto-detects whether to chain or branch:

| Parent (@-) State | Action | Result |
|-------------------|--------|--------|
| Has changes | `jj new @-` | Child of last work (linear chain) |
| Empty | `jj new` | Sibling from main |

**Linear chain (default when continuing work):**
```
main@origin
│
◉ "Add validation"
│
◉ "Add tests"     ← child of previous
│
@ (current)
```

**Siblings (when @- was empty or starting fresh):**
```
main@origin
├── ◉ "Add validation"     (message 1)
├── ◉ "Add tests"          (message 2)  ← siblings
└── @ (current)
```

If you have siblings that represent one logical unit of work, **squash before pushing**.

### Recognizing the Pattern

Run `jj log` before push. If you see siblings from same parent that represent one logical unit of work:

```
@  (empty)
│
│ ◉  "Fix typo in validation"
├─╯
│ ◉  "Add tests for validation"
├─╯
│ ◉  "Add input validation"
├─╯
◆  main@origin
```

These three commits are related work — offer to squash.

### Squashing Siblings

```bash
# Create merge commit from siblings
jj new sibling1 sibling2 sibling3 -m "Add input validation with tests"

# Squash the merge into single commit (now a child of main)
jj squash
```

Result:
```
@  (empty)
│
◉  "Add input validation with tests"   ← combined work
│
◆  main@origin
```

### When to Offer Squash

| See This | Do This |
|----------|---------|
| Multiple siblings, related work | **Offer squash** before push |
| Multiple siblings, unrelated work | Push as-is (or separate bookmarks) |
| Linear chain (parent→child→...) | Push as-is |

**Prompt**: "I see N related commits. Want me to squash them into one before pushing?"

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

## Common Mistakes to Avoid

### 1. File Tracking (CRITICAL)

**WRONG:** Trying to use `jj file track <file>` (doesn't exist)
**WRONG:** Thinking files need to be "staged" before commit

**RIGHT:** JJ automatically tracks all files in working copy
- Just use `write`, `edit` tools
- No staging step needed for jj
- All changes go into current change (`@`)

**Exception - Nix Flakes:** If you're in a nix flake repo, nix only sees files in git's index. Use the `jj_file_track` tool to add files to git's index after creating/modifying them.

### 2. After External Operations

If user runs `hey rebuild`, `nix develop`, or other external commands:

**DO THIS FIRST:**
```bash
jj status          # Check current working copy
jj log --limit 5   # Check for orphaned commits (↔ symbol)
```

**Orphaned commits (↔ symbol) mean:**
- Previous work got disconnected from main
- External operation triggered jj state changes
- Use `jj_recover_orphans` tool for automatic recovery

### 3. Multiple Related Changes

**WRONG:**
- Session 1: Create new file
- User runs rebuild
- Session 2: Update config to reference file
- Result: Changes get separated, file may be lost

**RIGHT:**
- Single session: Create file AND update config
- Run `jj_file_track` to add to git index (for nix)
- User runs rebuild
- Verify both changes present

### 4. Git Mental Model vs JJ

| Git Concept | JJ Reality |
|-------------|------------|
| `git add` (staging) | Not needed - jj tracks automatically |
| `git commit` | Not needed - changes are always in a commit |
| `git stash` | Use `jj new` to start fresh work |
| Working directory | Always in a commit (`@`) |

## Tools Reference

### jj_file_track

Add files to git's index so nix flakes can see them.

```
jj_file_track                    ← adds all files in working copy
jj_file_track files=["a.md"]     ← adds specific files
```

**When to use:**
- After creating files that nix needs to see
- Before user runs `hey rebuild`
- When working in nix flake repos

### jj_recover_orphans

Detect and automatically recover orphaned commits.

```
jj_recover_orphans               ← finds and restores orphaned changes
```

**When to use:**
- After seeing `↔` symbol in `jj log`
- After user reports "my changes disappeared"
- After external operations that might have changed jj state

### jj_push

(See above for full documentation)

## Debugging Guide

### "File disappeared after rebuild"

1. Run `jj_recover_orphans` for automatic recovery
2. Or manually:
   - `jj log -r 'all()' --limit 10` to see all commits
   - Look for orphaned commits (↔ symbol)
   - `jj diff -r <commit-id>` to check if file is there
   - `jj restore --from <commit-id> <file>` to restore

### "Changes not visible to nix"

1. Run `jj_file_track` to add files to git index
2. User runs `hey rebuild`
3. Verify: `ls ~/.config/opencode/...` (or wherever deployed)

### "Working copy is empty but I made changes"

This happens when jj moved to a new commit. Your changes are in a previous commit.

1. `jj log --limit 5` to see recent commits
2. Find your work (look for your description)
3. Either:
   - `jj edit <commit-id>` to go back to that commit
   - `jj restore --from <commit-id>` to bring changes to current commit

### "Commit is immutable"

Commits become immutable after pushing. You can't modify them.

Options:
- Continue with new work: `jj describe -m "next task"`
- Start fresh from main: `jj new main@origin -m "description"`
- Undo recent operation: `jj undo`

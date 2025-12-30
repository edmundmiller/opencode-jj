---
description: "Create a new JJ change and unlock file editing"
argument-hint: "[description] - What you're about to implement"
---

# /jj Command

Create a new JJ change and unlock the gate for file editing.

## Usage

```
/jj "Add user authentication to the API"
```

## What This Does

**From default workspace:**
1. Runs `jj git fetch` to get latest from remote
2. Creates `.workspaces/slug/` directory (auto-generated from description)
3. Creates a JJ workspace there with a bookmark
4. Moves the session to that workspace
5. Unlocks the gate

**From feature workspace:**
1. Runs `jj git fetch` to get latest
2. Creates a new change in the current workspace
3. Unlocks the gate

## Arguments

**Required:**
- `description` - What you're about to implement (min 10 chars, 2+ words)

**Optional:**
- `bookmark` - Named bookmark (auto-generated from description if not provided)
- `from` - Base revision to branch from (defaults to `main@origin`)

## Examples

Basic usage:
```
jj(description: "Add input validation")
```

With named bookmark:
```
jj(description: "Add user settings", bookmark: "user-settings")
```

From specific revision:
```
jj(description: "Fix auth bug", from: "release-v2")
```

## Action

Call the `jj` tool with the provided description:

```
jj(description: "$ARGUMENTS")
```

If no argument provided, ask the user what they want to work on.

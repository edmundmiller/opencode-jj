type Shell = any

function shell($: Shell, cwd?: string): Shell {
  return cwd ? $({ cwd }) : $
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function isJJRepo($: Shell): Promise<boolean> {
  try {
    const result = await $.nothrow()`jj root 2>/dev/null`
    return result.exitCode === 0
  } catch {
    return false
  }
}

export async function getCurrentChangeId($: Shell, cwd?: string): Promise<string | null> {
  try {
    const result = await shell($, cwd)`jj log -r @ --no-graph -T 'change_id.short()' 2>/dev/null`.text()
    return result.trim() || null
  } catch {
    return null
  }
}

export async function getCurrentDescription($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj log -r @ --no-graph -T 'description' 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function getDiffSummary($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj diff --stat 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function hasUncommittedChanges($: Shell, cwd?: string): Promise<boolean> {
  try {
    const result = await shell($, cwd)`jj diff --stat 2>/dev/null`.text()
    return result.trim().length > 0
  } catch {
    return false
  }
}

export async function getDiffFiles($: Shell, cwd?: string): Promise<string[]> {
  try {
    const result = await shell($, cwd)`jj diff --name-only 2>/dev/null`.text()
    return result.trim().split('\n').filter((f: string) => f.length > 0)
  } catch {
    return []
  }
}

export async function getStatus($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj st 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function gitFetch($: Shell, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj git fetch >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function newFromMain($: Shell, cwd?: string): Promise<{ success: boolean; error?: string }> {
  const s = shell($, cwd)
  try {
    await s`jj new main@origin >/dev/null 2>&1`
    return { success: true }
  } catch {
    try {
      await s`jj new main >/dev/null 2>&1`
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message || String(e) }
    }
  }
}

export async function newChange($: Shell, description: string, cwd?: string): Promise<{ success: boolean; changeId?: string; error?: string }> {
  const s = shell($, cwd)
  try {
    await s`jj new main@origin -m ${description} >/dev/null 2>&1`
    const changeId = await getCurrentChangeId($, cwd)
    return { success: true, changeId: changeId || undefined }
  } catch {
    try {
      await s`jj new main -m ${description} >/dev/null 2>&1`
      const changeId = await getCurrentChangeId($, cwd)
      return { success: true, changeId: changeId || undefined }
    } catch (e: any) {
      return { 
        success: false, 
        error: `Could not branch from main@origin or main. Error: ${e.message || String(e)}. Make sure you have a 'main' branch.`
      }
    }
  }
}

export async function describe($: Shell, message: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj describe -m ${message} >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function abandon($: Shell, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj abandon @ >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function bookmarkMove($: Shell, bookmark: string = 'main', cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj bookmark move ${bookmark} --to @ >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    try {
      await shell($, cwd)`jj bookmark create ${bookmark} -r @ >/dev/null 2>&1`
      return { success: true }
    } catch {
      return { success: false, error: e.message || String(e) }
    }
  }
}

export async function gitPush($: Shell, bookmark: string = 'main', cwd?: string): Promise<{ success: boolean; error?: string }> {
  const s = shell($, cwd)
  try {
    await s`jj git push -b ${bookmark} >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    try {
      const commitId = await s`jj log -r @ --no-graph -T 'commit_id' 2>/dev/null`.text()
      await s`git push origin ${commitId.trim()}:${bookmark} >/dev/null 2>&1`
      return { success: true }
    } catch (e2: any) {
      return { success: false, error: e2.message || String(e2) }
    }
  }
}

export async function gitInit($: Shell): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj git init >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function undo($: Shell, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj undo >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function newChangeFromCurrent($: Shell, description: string, cwd?: string): Promise<{ success: boolean; changeId?: string; parentId?: string; error?: string }> {
  try {
    const parentId = await getCurrentChangeId($, cwd)
    await shell($, cwd)`jj new -m ${description} >/dev/null 2>&1`
    const changeId = await getCurrentChangeId($, cwd)
    return { success: true, changeId: changeId || undefined, parentId: parentId || undefined }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function newChangeFrom($: Shell, from: string, description: string, cwd?: string): Promise<{ success: boolean; changeId?: string; error?: string }> {
  try {
    await shell($, cwd)`jj new ${from} -m ${description} >/dev/null 2>&1`
    const changeId = await getCurrentChangeId($, cwd)
    return { success: true, changeId: changeId || undefined }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function bookmarkSet($: Shell, name: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj bookmark set ${name} -r @ >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function getWorkspaceName($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj workspace list 2>/dev/null`.text()
    const lines = result.trim().split('\n')
    for (const line of lines) {
      if (line.includes('@')) {
        const match = line.match(/^(\S+):/)
        if (match) {
          return match[1]
        }
      }
    }
    return 'default'
  } catch {
    return 'default'
  }
}

export async function getWorkspaceRoot($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj workspace root 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function workspaceAdd($: Shell, path: string, name: string, revision: string): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj workspace add ${path} --name ${name} -r ${revision} >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function workspaceList($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj workspace list 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function workspaceForget($: Shell, name: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj workspace forget ${name} >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function getBookmarkForChange($: Shell, rev: string = '@', cwd?: string): Promise<string | null> {
  try {
    const result = await shell($, cwd)`jj log -r ${rev} --no-graph -T 'bookmarks' 2>/dev/null`.text()
    const bookmarks = result.trim()
    if (bookmarks && bookmarks.length > 0) {
      return bookmarks.split(' ')[0]
    }
    return null
  } catch {
    return null
  }
}

export async function rebase($: Shell, onto: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj rebase -d ${onto} >/dev/null 2>&1`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function squash($: Shell, message?: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
  const s = shell($, cwd)
  try {
    if (message) {
      await s`jj squash -m ${message} >/dev/null 2>&1`
    } else {
      await s`jj squash >/dev/null 2>&1`
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function getParentDescription($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj log -r @- --no-graph -T 'description' 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function getRepoRoot($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj root 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function ensureWorkspacesIgnored($: Shell, repoRoot: string, cwd?: string): Promise<{ added: boolean; error?: string }> {
  const gitignorePath = `${repoRoot}/.gitignore`
  const s = shell($, cwd)
  try {
    let content = ''
    try {
      content = await s`cat ${gitignorePath} 2>/dev/null`.text()
    } catch {
      // File doesn't exist, that's fine
    }
    
    if (content.includes('.workspaces')) {
      return { added: false }
    }
    
    const addition = content.endsWith('\n') || content === '' 
      ? '.workspaces/\n' 
      : '\n.workspaces/\n'
    await s`echo ${addition} >> ${gitignorePath} 2>/dev/null`
    return { added: true }
  } catch (e: any) {
    return { added: false, error: e.message || String(e) }
  }
}

export interface EmptyCommit {
  changeId: string
  description: string
  bookmarks: string[]
}

/**
 * JJ template: 'change_id.short() ++ "|" ++ description.first_line() ++ "|" ++ bookmarks'
 * Revset: 'empty() & ~immutable() & ~@' excludes merged commits and current working copy
 */
export async function getEmptyCommits($: Shell, cwd?: string): Promise<EmptyCommit[]> {
  try {
    const result = await shell($, cwd)`jj log -r 'empty() & ~immutable() & ~@' --no-graph -T 'change_id.short() ++ "|" ++ description.first_line() ++ "|" ++ bookmarks ++ "\n"' 2>/dev/null`.text()
    const lines = result.trim().split('\n').filter((l: string) => l.length > 0)
    
    return lines.map((line: string) => {
      const [changeId, description, bookmarksStr] = line.split('|')
      const bookmarks = bookmarksStr ? bookmarksStr.split(' ').filter((b: string) => b.length > 0) : []
      return { changeId, description: description || '(no description)', bookmarks }
    })
  } catch {
    return []
  }
}

export interface StaleWorkspace {
  name: string
  changeId: string
  reason: string
}

/**
 * Finds workspaces that are stale: already merged to main or empty.
 * JJ workspace list format: "workspace-name: changeId description"
 */
export async function getStaleWorkspaces($: Shell, cwd?: string): Promise<StaleWorkspace[]> {
  try {
    const s = shell($, cwd)
    const listResult = await s`jj workspace list 2>/dev/null`.text()
    const lines = listResult.trim().split('\n')
    const stale: StaleWorkspace[] = []
    
    for (const line of lines) {
      const match = line.match(/^(\S+):\s+(\S+)\s*(.*)$/)
      if (!match) continue
      
      const [, name, changeId, rest] = match
      
      if (name === 'default') continue
      if (rest.includes('@')) continue
      
      const isEmpty = rest.includes('(empty)')
      
      try {
        const ancestorCheck = await s.nothrow()`jj log -r '${changeId} & ::main' --no-graph -T 'change_id' 2>/dev/null`
        const isMerged = ancestorCheck.exitCode === 0 && ancestorCheck.stdout.toString().trim().length > 0
        
        if (isMerged) {
          stale.push({ name, changeId, reason: 'already merged to main' })
        } else if (isEmpty) {
          stale.push({ name, changeId, reason: 'empty workspace' })
        }
      } catch {
        if (isEmpty) {
          stale.push({ name, changeId, reason: 'empty workspace' })
        }
      }
    }
    
    return stale
  } catch {
    return []
  }
}

/**
 * JJ abandon output includes "Deleted bookmarks: foo, bar" when bookmarks are removed
 */
export async function abandonCommits($: Shell, changeIds: string[], cwd?: string): Promise<{ success: boolean; abandoned: number; deletedBookmarks: string[]; error?: string }> {
  if (changeIds.length === 0) {
    return { success: true, abandoned: 0, deletedBookmarks: [] }
  }
  
  try {
    const result = await shell($, cwd)`jj abandon ${changeIds} 2>/dev/null`.text()
    const bookmarkMatch = result.match(/Deleted bookmarks?:\s*(.+)/i)
    const deletedBookmarks = bookmarkMatch 
      ? bookmarkMatch[1].split(',').map((b: string) => b.trim()).filter((b: string) => b.length > 0)
      : []
    return { success: true, abandoned: changeIds.length, deletedBookmarks }
  } catch (e: any) {
    return { success: false, abandoned: 0, deletedBookmarks: [], error: e.message || String(e) }
  }
}

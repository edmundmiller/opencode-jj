type Shell = any

export async function isJJRepo($: Shell): Promise<boolean> {
  try {
    const result = await $.nothrow()`jj root`
    return result.exitCode === 0
  } catch {
    return false
  }
}

export async function getCurrentChangeId($: Shell): Promise<string | null> {
  try {
    const result = await $`jj log -r @ --no-graph -T 'change_id.short()'`.text()
    return result.trim() || null
  } catch {
    return null
  }
}

export async function getCurrentDescription($: Shell): Promise<string> {
  try {
    const result = await $`jj log -r @ --no-graph -T 'description'`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function getDiffSummary($: Shell): Promise<string> {
  try {
    const result = await $`jj diff --stat`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function getDiffFiles($: Shell): Promise<string[]> {
  try {
    const result = await $`jj diff --name-only`.text()
    return result.trim().split('\n').filter((f: string) => f.length > 0)
  } catch {
    return []
  }
}

export async function getStatus($: Shell): Promise<string> {
  try {
    const result = await $`jj st`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function gitFetch($: Shell): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj git fetch`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function newChange($: Shell, description: string): Promise<{ success: boolean; changeId?: string; error?: string }> {
  // Try main@origin first (remote tracking branch)
  try {
    await $`jj new main@origin -m ${description}`
    const changeId = await getCurrentChangeId($)
    return { success: true, changeId: changeId || undefined }
  } catch {
    // Fallback to local main if remote doesn't exist
    try {
      await $`jj new main -m ${description}`
      const changeId = await getCurrentChangeId($)
      return { success: true, changeId: changeId || undefined }
    } catch (e: any) {
      // Don't silently use current change - error out with helpful message
      return { 
        success: false, 
        error: `Could not branch from main@origin or main. Error: ${e.message || String(e)}. Make sure you have a 'main' branch.`
      }
    }
  }
}

export async function describe($: Shell, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj describe -m ${message}`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function abandon($: Shell): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj abandon @`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function bookmarkMove($: Shell, bookmark: string = 'main'): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj bookmark move ${bookmark} --to @`
    return { success: true }
  } catch (e: any) {
    try {
      await $`jj bookmark create ${bookmark} -r @`
      return { success: true }
    } catch {
      return { success: false, error: e.message || String(e) }
    }
  }
}

export async function gitPush($: Shell, bookmark: string = 'main'): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj git push -b ${bookmark}`
    return { success: true }
  } catch (e: any) {
    try {
      const commitId = await $`jj log -r @ --no-graph -T 'commit_id'`.text()
      await $`git push origin ${commitId.trim()}:${bookmark}`
      return { success: true }
    } catch (e2: any) {
      return { success: false, error: e2.message || String(e2) }
    }
  }
}

export async function gitInit($: Shell): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj git init`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function newChangeFromCurrent($: Shell, description: string): Promise<{ success: boolean; changeId?: string; parentId?: string; error?: string }> {
  try {
    const parentId = await getCurrentChangeId($)
    await $`jj new -m ${description}`
    const changeId = await getCurrentChangeId($)
    return { success: true, changeId: changeId || undefined, parentId: parentId || undefined }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

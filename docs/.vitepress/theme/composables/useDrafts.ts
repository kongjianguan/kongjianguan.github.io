// docs/.vitepress/theme/composables/useDrafts.ts

interface DraftData {
  content: string
  frontmatter: Record<string, any>
  savedAt: string
  remoteSha: string | null
}

function getKey(filePath: string): string {
  return `draft:${filePath}`
}

export function useDrafts() {
  function loadDraft(filePath: string): DraftData | null {
    const key = getKey(filePath)
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const draft = JSON.parse(raw)
      if (
        typeof draft?.content !== 'string' ||
        typeof draft?.frontmatter !== 'object' ||
        draft.frontmatter === null ||
        Array.isArray(draft.frontmatter) ||
        typeof draft?.savedAt !== 'string' ||
        (draft.remoteSha !== null && typeof draft.remoteSha !== 'string')
      ) {
        localStorage.removeItem(key)
        return null
      }
      return draft as DraftData
    } catch {
      try { localStorage.removeItem(key) } catch { /* storage may be unavailable */ }
      return null
    }
  }

  function saveDraft(filePath: string, content: string, frontmatter: Record<string, any>, remoteSha: string | null): void {
    const key = getKey(filePath)
    const draft: DraftData = {
      content,
      frontmatter,
      savedAt: new Date().toISOString(),
      remoteSha
    }
    try {
      localStorage.setItem(key, JSON.stringify(draft))
    } catch {
      // A private browsing session or a full storage quota must not crash editing.
    }
  }

  function deleteDraft(filePath: string): void {
    try { localStorage.removeItem(getKey(filePath)) } catch { /* storage may be unavailable */ }
  }

  function hasDraft(filePath: string): boolean {
    try { return localStorage.getItem(getKey(filePath)) !== null } catch { return false }
  }

  return { loadDraft, saveDraft, deleteDraft, hasDraft }
}

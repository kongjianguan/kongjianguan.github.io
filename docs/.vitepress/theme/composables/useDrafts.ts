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
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      localStorage.removeItem(key)
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
    localStorage.setItem(key, JSON.stringify(draft))
  }

  function deleteDraft(filePath: string): void {
    localStorage.removeItem(getKey(filePath))
  }

  function hasDraft(filePath: string): boolean {
    return localStorage.getItem(getKey(filePath)) !== null
  }

  return { loadDraft, saveDraft, deleteDraft, hasDraft }
}

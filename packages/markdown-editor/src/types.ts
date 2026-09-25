export interface EditorFile {
  content: string
  sha: string
}

export interface EditorCommitResult {
  sha: string
}

export interface EditorStorage {
  readFile(path: string): Promise<EditorFile | null>
  createFile(path: string, content: string, message: string): Promise<EditorCommitResult | null>
  updateFile(
    path: string,
    content: string,
    sha: string,
    message: string,
  ): Promise<EditorCommitResult | null>
  uploadImage(file: File): Promise<string | null>
  readLocalFile?(path: string, fallbackContent: string): string | null
  localFileNotice?: string
}

export interface DraftRecord {
  content: string
  frontmatter: Record<string, unknown>
  savedAt: string
  remoteSha: string | null
  images: Record<string, File>
}

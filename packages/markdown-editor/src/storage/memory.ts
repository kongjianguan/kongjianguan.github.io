import type { EditorCommitResult, EditorFile, EditorStorage } from '../types'

export interface MemoryStorageOptions {
  files?: Record<string, string>
  uploadUrlPrefix?: string
}

/**
 * 内存存储适配器，实现与博客相同的 EditorStorage 接口。
 * 用于本地开发与自动化测试，行为与远程实现保持一致：读取不存在的路径返回 null，
 * 提交时校验版本号，版本不匹配返回 null 而不是抛出异常。
 */
export function createMemoryStorage(options: MemoryStorageOptions = {}) {
  const files = new Map<string, { content: string; sha: string }>()
  const uploadUrlPrefix = options.uploadUrlPrefix ?? '/images/'
  let revision = 0
  let uploadSequence = 0

  for (const [path, content] of Object.entries(options.files ?? {})) {
    files.set(path, { content, sha: `sha-${++revision}` })
  }

  const storage: EditorStorage = {
    async readFile(path: string): Promise<EditorFile | null> {
      const file = files.get(path)
      return file ? { content: file.content, sha: file.sha } : null
    },

    async createFile(path: string, content: string, _message: string): Promise<EditorCommitResult | null> {
      if (files.has(path)) return null
      const sha = `sha-${++revision}`
      files.set(path, { content, sha })
      return { sha }
    },

    async updateFile(
      path: string,
      content: string,
      sha: string,
      _message: string,
    ): Promise<EditorCommitResult | null> {
      const file = files.get(path)
      if (!file || file.sha !== sha) return null
      const nextSha = `sha-${++revision}`
      files.set(path, { content, sha: nextSha })
      return { sha: nextSha }
    },

    async uploadImage(file: File): Promise<string | null> {
      return `${uploadUrlPrefix}${++uploadSequence}-${file.name}`
    },
  }

  return {
    storage,
    get: (path: string) => files.get(path)?.content ?? null,
    sha: (path: string) => files.get(path)?.sha ?? null,
  }
}

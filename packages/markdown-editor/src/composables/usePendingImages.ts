import { ref } from 'vue'

export interface PendingImageOptions {
  maxBytes?: number
  uploadImage: (file: File) => Promise<string | null>
}

interface PendingImage {
  file: File
  localUrl: string
  remoteUrl?: string
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024

/*
 * 粘贴或拖入的图片先以本机地址插入正文，提交时再统一上传并替换为远程地址。
 * 这样编辑期间无需等待上传，也能在断网时继续写作。
 */
export function createPendingImages(options: PendingImageOptions) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const pending = new Map<string, PendingImage>()
  const isUploading = ref(false)

  async function stage(file: File): Promise<string | null> {
    if (file.size > maxBytes) {
      throw new Error(`图片体积超过上限（最大 ${Math.round(maxBytes / 1024 / 1024)}MB）`)
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      throw new Error('当前浏览器不支持本地图片暂存')
    }

    const localUrl = URL.createObjectURL(file)
    pending.set(localUrl, { file, localUrl })
    return localUrl
  }

  function release(): void {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      pending.forEach(({ localUrl }) => URL.revokeObjectURL(localUrl))
    }
    pending.clear()
  }

  function hasReferences(content: string): boolean {
    return Array.from(pending.values()).some(({ localUrl }) => content.includes(localUrl))
  }

  /*
   * 把正文中的本机地址替换为远程地址，返回替换后的内容。
   * 调用方负责把结果写回会话，避免此处直接改动状态。
   */
  async function uploadAll(content: string): Promise<string> {
    let next = content
    isUploading.value = true
    try {
      for (const item of pending.values()) {
        if (!next.includes(item.localUrl)) continue

        if (!item.remoteUrl) {
          const remoteUrl = await options.uploadImage(item.file)
          if (!remoteUrl) throw new Error('图片上传失败')
          item.remoteUrl = remoteUrl
        }

        next = next.split(item.localUrl).join(item.remoteUrl)
      }
      return next
    } finally {
      isUploading.value = false
    }
  }

  return { stage, release, hasReferences, uploadAll, isUploading }
}

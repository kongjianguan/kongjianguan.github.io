import { describe, expect, it } from 'vitest'
import { createEditSession } from '../src/composables/useEditMode'
import { createDraftStore } from '../src/composables/useDrafts'
import type { EditorStorage } from '../src/types'

const ARTICLE = 'docs/随笔/示例.md'

function createMemoryStorage(files: Record<string, string> = {}) {
  const store = new Map<string, { content: string; sha: string }>()
  let revision = 0

  for (const [path, content] of Object.entries(files)) {
    store.set(path, { content, sha: `sha-${++revision}` })
  }

  // createEditSession 在构造时解构了存储方法，函数标识必须保持稳定，
  // 因此用这些开关控制行为，而不是在测试中替换方法。
  const hooks: {
    rejectUpdate: boolean
    updateError: Error | null
    updateErrorContent: string | null
    onUpdate: (() => void) | null
  } = { rejectUpdate: false, updateError: null, updateErrorContent: null, onUpdate: null }

  const storage: EditorStorage = {
    async readFile(path) {
      const file = store.get(path)
      return file ? { content: file.content, sha: file.sha } : null
    },
    async createFile(path, content) {
      if (store.has(path)) return null
      const sha = `sha-${++revision}`
      store.set(path, { content, sha })
      return { sha }
    },
    async updateFile(path, content, sha) {
      hooks.onUpdate?.()
      if (hooks.updateError) {
        if (hooks.updateErrorContent !== null) {
          store.set(path, { content: hooks.updateErrorContent, sha: `sha-${++revision}` })
        }
        throw hooks.updateError
      }
      if (hooks.rejectUpdate) return null
      const file = store.get(path)
      if (!file || file.sha !== sha) return null
      const nextSha = `sha-${++revision}`
      store.set(path, { content, sha: nextSha })
      return { sha: nextSha }
    },
    async uploadImage() {
      return '/images/uploaded.png'
    },
  }

  return {
    storage,
    hooks,
    get: (path: string) => store.get(path)?.content ?? null,
    sha: (path: string) => store.get(path)?.sha ?? null,
  }
}

function createDraftBackend() {
  const store = new Map<string, string>()
  const backend: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
  return backend
}

function setup(files: Record<string, string> = {}, confirmResult = true) {
  const memory = createMemoryStorage(files)
  const draftStore = createDraftStore({ storage: createDraftBackend() })
  const session = createEditSession({
    storage: memory.storage,
    draftStore,
    confirmAction: () => confirmResult,
  })
  return { memory, session, draftStore }
}

describe('createEditSession 初始化', () => {
  it('读取远程内容并计算未修改状态', async () => {
    const { session } = setup({ [ARTICLE]: '---\ntitle: 标题\n---\n正文\n' })
    await session.initEditor(ARTICLE, '备用内容')

    expect(session.isEditing.value).toBe(true)
    expect(session.content.value).toBe('---\ntitle: 标题\n---\n正文\n')
    expect(session.frontmatter.value).toEqual({ title: '标题' })
    expect(session.isDirty.value).toBe(false)
    expect(session.remoteSha.value).toBe('sha-1')
    expect(session.isNewFile.value).toBe(false)
    expect(session.loadError.value).toBeNull()
  })

  it('远程不存在且不期待新文件时给出错误提示', async () => {
    const { session } = setup()
    await session.initEditor(ARTICLE, '备用内容')

    expect(session.loadError.value).toContain('远程文章不存在')
    expect(session.content.value).toBe('备用内容')
    expect(session.isDirty.value).toBe(false)
  })

  it('期待新文件且远程已存在时判定为冲突', async () => {
    const { session } = setup({ 'docs/新文章.md': '已有内容' })
    await session.initEditor('docs/新文章.md', '模板内容', { expectNew: true })

    expect(session.newFileConflict.value).toBe(true)
    expect(session.loadError.value).toContain('已经存在')
  })

  it('期待新文件且远程不存在时进入新建状态', async () => {
    const { session } = setup()
    await session.initEditor('docs/新文章.md', '模板内容', { expectNew: true })

    expect(session.isNewFile.value).toBe(true)
    expect(session.newFileConflict.value).toBe(false)
    expect(session.loadError.value).toBeNull()
    expect(session.isDirty.value).toBe(true)
  })

  it('读取抛出异常时回退到备用内容并记录错误', async () => {
    const memory = createMemoryStorage()
    memory.storage.readFile = async () => {
      throw new Error('网络不可用')
    }
    const session = createEditSession({
      storage: memory.storage,
      draftStore: createDraftStore({ storage: createDraftBackend() }),
      confirmAction: () => true,
    })

    await session.initEditor(ARTICLE, '备用内容')
    expect(session.loadError.value).toBe('网络不可用')
    expect(session.content.value).toBe('备用内容')
  })

  it('提供本地文件兜底时使用本地内容并给出提示', async () => {
    const memory = createMemoryStorage()
    memory.storage.readFile = async () => {
      throw new Error('未连接')
    }
    memory.storage.readLocalFile = () => '本地内容'
    memory.storage.localFileNotice = '本地编辑模式未连接远程'
    const session = createEditSession({
      storage: memory.storage,
      draftStore: createDraftStore({ storage: createDraftBackend() }),
      confirmAction: () => true,
    })

    await session.initEditor(ARTICLE, '备用内容')
    expect(session.content.value).toBe('本地内容')
    expect(session.loadError.value).toBe('本地编辑模式未连接远程')
  })

  it('并发初始化时只有最后一次调用生效', async () => {
    const memory = createMemoryStorage({ 'docs/a.md': '内容 A', 'docs/b.md': '内容 B' })
    const session = createEditSession({      storage: memory.storage,
      draftStore: createDraftStore({ storage: createDraftBackend() }),
      confirmAction: () => true,
    })

    await Promise.all([
      session.initEditor('docs/a.md', ''),
      session.initEditor('docs/b.md', ''),
    ])

    expect(session.content.value).toBe('内容 B')
    expect(session.filePath.value).toBe('docs/b.md')
  })

  it('初始化时重置上一次的错误与冲突状态', async () => {
    const { session } = setup({ 'docs/新文章.md': '已有内容' })
    await session.initEditor('docs/新文章.md', '模板', { expectNew: true })
    expect(session.newFileConflict.value).toBe(true)

    await session.initEditor(ARTICLE, '正文')
    expect(session.newFileConflict.value).toBe(false)
    expect(session.loadError.value).toContain('远程文章不存在')
  })
})

describe('createEditSession 草稿', () => {
  it('版本号一致的草稿自动恢复', async () => {
    const { session, memory, draftStore } = setup({ [ARTICLE]: '远程内容' })
    draftStore.saveDraft(ARTICLE, '草稿内容', { title: '草稿' }, memory.sha(ARTICLE))

    await session.initEditor(ARTICLE, '')
    expect(session.content.value).toBe('草稿内容')
    expect(session.isDirty.value).toBe(true)
  })

  it('远程已更新且用户确认时仍然恢复草稿', async () => {
    const { session, draftStore } = setup({ [ARTICLE]: '远程内容' }, true)
    draftStore.saveDraft(ARTICLE, '草稿内容', { title: '草稿' }, 'sha-旧版本')

    await session.initEditor(ARTICLE, '')
    expect(session.content.value).toBe('草稿内容')
  })

  it('远程已更新且用户拒绝时丢弃草稿', async () => {
    const { session, draftStore } = setup({ [ARTICLE]: '远程内容' }, false)
    draftStore.saveDraft(ARTICLE, '草稿内容', { title: '草稿' }, 'sha-旧版本')

    await session.initEditor(ARTICLE, '')
    expect(session.content.value).toBe('远程内容')
    expect(draftStore.hasDraft(ARTICLE)).toBe(false)
  })

  it('保存草稿写入内容与版本号', async () => {
    const { session, draftStore } = setup({ [ARTICLE]: '远程内容' })
    await session.initEditor(ARTICLE, '')

    session.updateContent('远程内容改了')
    session.saveDraft()

    expect(draftStore.loadDraft(ARTICLE)).toMatchObject({
      content: '远程内容改了',
      remoteSha: 'sha-1',
    })
  })
})

describe('createEditSession 内容与属性更新', () => {
  it('更新内容会重新解析属性并计算修改状态', async () => {
    const { session } = setup({ [ARTICLE]: '---\ntitle: 原标题\n---\n正文' })
    await session.initEditor(ARTICLE, '')

    session.updateContent('---\ntitle: 新标题\n---\n正文')
    expect(session.frontmatter.value).toEqual({ title: '新标题' })
    expect(session.isDirty.value).toBe(true)

    session.updateContent('---\ntitle: 原标题\n---\n正文')
    expect(session.isDirty.value).toBe(false)
  })

  it('属性解析失败时记录错误并保留正文', async () => {
    const { session } = setup({ [ARTICLE]: '正文' })
    await session.initEditor(ARTICLE, '')

    session.updateContent('---\n- 数组\n---\n正文')
    expect(session.frontmatterError.value).toContain('文章属性必须是 YAML 对象')
  })

  it('更新属性会重建完整 Markdown', async () => {
    const { session } = setup({ [ARTICLE]: '---\ntitle: 原标题\n---\n正文内容' })
    await session.initEditor(ARTICLE, '')

    session.updateFrontmatter({ title: '新标题', tags: ['a'] })
    expect(session.content.value).toContain('title: 新标题')
    expect(session.content.value).toContain('正文内容')
    expect(session.frontmatterError.value).toBeNull()
    expect(session.isDirty.value).toBe(true)
  })

  it('正文中的 Markdown 结构在属性更新后保持完整', async () => {
    const body = '## 标题\n\n- 一\n- 二\n\n```js\nconst a = 1\n```\n'
    const { session } = setup({ [ARTICLE]: `---\ntitle: 原标题\n---\n${body}` })
    await session.initEditor(ARTICLE, '')

    session.updateFrontmatter({ title: '新标题' })
    expect(session.content.value.endsWith(body)).toBe(true)
  })
})

describe('createEditSession 提交', () => {
  it('提交前属性有错时直接失败', async () => {
    const { session } = setup({ [ARTICLE]: '正文' })
    await session.initEditor(ARTICLE, '')
    session.updateContent('---\n- 数组\n---\n正文')

    expect(await session.commit('msg')).toBe(false)
    expect(session.saveError.value).toContain('文章属性必须是 YAML 对象')
  })

  it('没有修改时拒绝提交', async () => {
    const { session } = setup({ [ARTICLE]: '正文' })
    await session.initEditor(ARTICLE, '')

    expect(await session.commit('msg')).toBe(false)
    expect(session.saveError.value).toBe('内容未修改')
  })

  it('已有文件提交成功后刷新版本号并清除草稿', async () => {
    const { session, memory, draftStore } = setup({ [ARTICLE]: '原标题内容' })
    await session.initEditor(ARTICLE, '')
    session.updateContent('新标题内容')
    session.saveDraft()

    expect(await session.commit('docs: update')).toBe(true)
    expect(memory.get(ARTICLE)).toBe('新标题内容')
    expect(session.remoteSha.value).toBe(memory.sha(ARTICLE))
    expect(session.isDirty.value).toBe(false)
    expect(draftStore.hasDraft(ARTICLE)).toBe(false)
    expect(session.saveError.value).toBeNull()
  })

  it('新建文件走创建路径并切换为非新建状态', async () => {
    const { session, memory } = setup()
    await session.initEditor('docs/新文章.md', '模板内容', { expectNew: true })
    session.updateContent('模板内容加一点')

    expect(await session.commit('feat: add')).toBe(true)
    expect(memory.get('docs/新文章.md')).toBe('模板内容加一点')
    expect(session.isNewFile.value).toBe(false)
  })

  it('新建时远程已存在则失败并保留草稿', async () => {
    const { session, draftStore } = setup({ 'docs/新文章.md': '远程内容' })
    await session.initEditor('docs/新文章.md', '模板内容', { expectNew: true })
    session.updateContent('改动内容')

    expect(await session.commit('feat: add')).toBe(false)
    expect(session.saveError.value).toContain('已经存在')
    expect(draftStore.hasDraft('docs/新文章.md')).toBe(true)
  })

  it('缺少远程版本号时拒绝提交', async () => {
    const { session } = setup({ [ARTICLE]: '正文' })
    await session.initEditor(ARTICLE, '')
    session.updateContent('改动')
    session.remoteSha.value = null

    expect(await session.commit('msg')).toBe(false)
    expect(session.saveError.value).toContain('缺少远程文件版本信息')
  })

  it('远程版本冲突时提交失败并保存草稿', async () => {
    const { session, memory, draftStore } = setup({ [ARTICLE]: '正文' })
    await session.initEditor(ARTICLE, '')
    session.updateContent('本地改动')
    memory.hooks.rejectUpdate = true

    expect(await session.commit('msg')).toBe(false)
    expect(session.saveError.value).toContain('远程文章可能已经更新')
    expect(draftStore.hasDraft(ARTICLE)).toBe(true)
  })

  it('写入抛出异常但远程内容已经一致时视为成功', async () => {
    const { session, memory, draftStore } = setup({ [ARTICLE]: '正文' })
    await session.initEditor(ARTICLE, '')
    session.updateContent('已写入但响应丢失')
    memory.hooks.updateError = new Error('连接中断')
    memory.hooks.updateErrorContent = '已写入但响应丢失'

    expect(await session.commit('msg')).toBe(true)
    expect(session.isDirty.value).toBe(false)
    expect(draftStore.hasDraft(ARTICLE)).toBe(false)
  })

  it('写入抛出异常且远程内容不一致时判定失败', async () => {
    const { session, memory } = setup({ [ARTICLE]: '正文' })
    await session.initEditor(ARTICLE, '')
    session.updateContent('本地改动')
    memory.hooks.updateError = new Error('网络错误')
    memory.hooks.updateErrorContent = '远程的其他内容'

    expect(await session.commit('msg')).toBe(false)
    expect(session.saveError.value).toBe('网络错误')
  })

  it('提交期间保存状态被置位并在结束后复位', async () => {
    const { session, memory } = setup({ [ARTICLE]: '正文' })
    await session.initEditor(ARTICLE, '')
    session.updateContent('改动')

    const observed: boolean[] = []
    memory.hooks.onUpdate = () => {
      observed.push(session.isSaving.value)
    }

    await session.commit('msg')
    expect(observed).toEqual([true])
    expect(session.isSaving.value).toBe(false)
  })

  it('提交失败时保存状态同样复位', async () => {
    const { session, memory } = setup({ [ARTICLE]: '正文' })
    await session.initEditor(ARTICLE, '')
    session.updateContent('改动')
    memory.hooks.updateError = new Error('网络错误')

    await session.commit('msg')
    expect(session.isSaving.value).toBe(false)
  })

  it('没有文件路径时拒绝提交', async () => {
    const { session } = setup()
    expect(await session.commit('msg')).toBe(false)
    expect(session.saveError.value).toBe('缺少文章路径')
  })
})

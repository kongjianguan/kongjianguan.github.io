import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MarkdownEditor from '../src/components/MarkdownEditor.vue'
import { createMemoryStorage } from '../src/storage/memory'

/*
 * 组件层测试：验证装配、登录态、错误提示与提交流程，
 * 编辑器的标记隐藏行为由 live-preview.test.ts 覆盖。
 */

function mountEditor(files: Record<string, string> = {}) {
  const memory = createMemoryStorage({ files })

  const wrapper = mount(MarkdownEditor, {
    props: {
      storage: memory.storage,
      active: true,
      filePath: 'docs/示例.md',
      title: '示例文章',
      isLoggedIn: true,
    },
    attachTo: document.body,
  })

  return { wrapper, memory }
}

/*
 * 正文编辑器是按需加载的异步组件，挂载后需要若干轮微任务与定时器
 * 才会出现在组件树里，这里统一等待到组件可用为止。
 */
async function flush(times = 8): Promise<void> {
  for (let index = 0; index < times; index++) {
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

async function waitForEditor(wrapper: VueWrapper, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const editor = wrapper.findComponent({ name: 'CodeMirrorEditor' })
    if (editor.exists()) return editor
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  return wrapper.findComponent({ name: 'CodeMirrorEditor' })
}

describe('MarkdownEditor 装配', () => {
  it('未激活时不渲染编辑控件', async () => {
    const memory = createMemoryStorage()
    const wrapper = mount(MarkdownEditor, {
      props: {
        storage: memory.storage,
        active: false,
        filePath: 'docs/示例.md',
      },
    })

    await flush()
    expect(wrapper.find('.editor-controls').exists()).toBe(false)
  })

  it('激活后加载远程内容并显示工具栏', async () => {
    const { wrapper } = mountEditor({ 'docs/示例.md': '---\ntitle: 标题\n---\n正文段落' })
    await flush()

    expect(wrapper.find('.editor-controls').exists()).toBe(true)
    expect(wrapper.find('.toolbar-path').text()).toBe('docs/示例.md')
    wrapper.unmount()
  })

  it('正文编辑器只接收正文部分，不含属性块', async () => {
    const { wrapper } = mountEditor({ 'docs/示例.md': '---\ntitle: 标题\n---\n正文段落' })
    await flush()

    const editor = await waitForEditor(wrapper)
    expect(editor.props('modelValue')).toBe('正文段落')
    wrapper.unmount()
  })

  it('标题优先使用属性而不是外部传入', async () => {
    const { wrapper } = mountEditor({ 'docs/示例.md': '---\ntitle: 属性标题\n---\n正文' })
    await flush()

    expect(wrapper.find('.toolbar-title').text()).toBe('属性标题')
    wrapper.unmount()
  })

  it('未登录时显示登录提示并使用插槽', async () => {
    const memory = createMemoryStorage({ files: { 'docs/示例.md': '正文' } })
    const wrapper = mount(MarkdownEditor, {
      props: {
        storage: memory.storage,
        active: true,
        filePath: 'docs/示例.md',
        isLoggedIn: false,
      },
      slots: { login: '<button class="custom-login">登录</button>' },
      attachTo: document.body,
    })
    await flush()

    expect(wrapper.find('.custom-login').exists()).toBe(true)
    expect(wrapper.find('.login-banner').exists()).toBe(true)
    wrapper.unmount()
  })

  it('未登录时不渲染属性面板', async () => {
    const memory = createMemoryStorage({ files: { 'docs/示例.md': '正文' } })
    const wrapper = mount(MarkdownEditor, {
      props: {
        storage: memory.storage,
        active: true,
        filePath: 'docs/示例.md',
        isLoggedIn: false,
      },
      attachTo: document.body,
    })
    await flush()

    expect(wrapper.find('.fm-panel').exists()).toBe(false)
    wrapper.unmount()
  })

  it('远程读取失败时显示错误提示', async () => {
    const memory = createMemoryStorage()
    const wrapper = mount(MarkdownEditor, {
      props: {
        storage: memory.storage,
        active: true,
        filePath: 'docs/不存在.md',
        fallbackContent: '备用正文',
        notify: () => {},
      },
      attachTo: document.body,
    })
    await flush()

    expect(wrapper.find('.editor-error').text()).toContain('远程文章不存在')
    wrapper.unmount()
  })

  it('属性解析失败时显示错误并隐藏属性面板', async () => {
    const { wrapper } = mountEditor({ 'docs/示例.md': '---\n- 数组\n---\n正文' })
    await flush()

    expect(wrapper.find('.editor-error').text()).toContain('文章属性必须是 YAML 对象')
    expect(wrapper.find('.fm-panel').exists()).toBe(false)
    wrapper.unmount()
  })

  it('新建文件模式下渲染空正文编辑器', async () => {
    const memory = createMemoryStorage()
    const wrapper = mount(MarkdownEditor, {
      props: {
        storage: memory.storage,
        active: true,
        standalone: true,
        filePath: 'docs/新建.md',
        fallbackContent: '',
        expectNew: true,
        isLoggedIn: true,
      },
      attachTo: document.body,
    })
    await flush()

    const editor = await waitForEditor(wrapper)
    expect(editor.exists()).toBe(true)
    expect(editor.props('modelValue')).toBe('')
    wrapper.unmount()
  })

  it('退出编辑时发出 exit 事件并收起控件', async () => {
    const { wrapper } = mountEditor({ 'docs/示例.md': '正文' })
    await flush()

    const buttons = wrapper.findAll('.tb-btn')
    await buttons[buttons.length - 1].trigger('click')
    await flush()

    expect(wrapper.emitted('exit')).toHaveLength(1)
    expect(wrapper.find('.editor-controls').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('MarkdownEditor 正文编辑与提交', () => {
  it('正文变化后重新拼装完整内容并标记为已修改', async () => {
    const { wrapper } = mountEditor({ 'docs/示例.md': '---\ntitle: 标题\n---\n原正文' })
    await flush()

    const editor = await waitForEditor(wrapper)
    await editor.vm.$emit('update:modelValue', '改后的正文')
    await flush()

    const exposed = wrapper.vm as unknown as { content: string; isDirty: boolean }
    expect(exposed.content).toContain('改后的正文')
    expect(exposed.content).toContain('title: 标题')
    expect(exposed.isDirty).toBe(true)
    wrapper.unmount()
  })

  it('属性面板更新不会丢失正文改动', async () => {
    const { wrapper } = mountEditor({ 'docs/示例.md': '---\ntitle: 原标题\n---\n原正文' })
    await flush()

    const editor = await waitForEditor(wrapper)
    await editor.vm.$emit('update:modelValue', '改后的正文')
    await flush()

    await wrapper.find('.fm-input').setValue('新标题')
    await flush()

    const exposed = wrapper.vm as unknown as { content: string }
    expect(exposed.content).toContain('新标题')
    expect(exposed.content).toContain('改后的正文')
    wrapper.unmount()
  })

  it('提交成功后写入远程并发出 saved 事件', async () => {
    const { wrapper, memory } = mountEditor({ 'docs/示例.md': '---\ntitle: 标题\n---\n原正文' })
    await flush()

    const editor = await waitForEditor(wrapper)
    await editor.vm.$emit('update:modelValue', '改后的正文')
    await flush()

    const exposed = wrapper.vm as unknown as {
      requestCommit: () => Promise<void>
      isDirty: boolean
    }
    await exposed.requestCommit()
    await flush()

    const dialogInput = document.querySelector<HTMLInputElement>('.commit-input')
    expect(dialogInput).not.toBeNull()
    dialogInput!.value = 'docs: update'
    dialogInput!.dispatchEvent(new Event('input'))
    await flush()

    document.querySelector<HTMLButtonElement>('.btn-confirm')!.click()
    await flush(12)

    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(exposed.isDirty).toBe(false)
    expect(memory.get('docs/示例.md')).toContain('改后的正文')
    wrapper.unmount()
  })

  it('提交前把待上传图片的本机地址替换为远程地址', async () => {
    const memory = createMemoryStorage({ files: { 'docs/示例.md': '---\ntitle: 标题\n---\n正文' } })
    const uploaded: string[] = []
    const originalUpload = memory.storage.uploadImage
    memory.storage.uploadImage = async (file) => {
      const url = await originalUpload(file)
      if (url) uploaded.push(url)
      return url
    }

    const wrapper = mount(MarkdownEditor, {
      props: {
        storage: memory.storage,
        active: true,
        filePath: 'docs/示例.md',
        isLoggedIn: true,
      },
      attachTo: document.body,
    })
    await flush()

    // 模拟粘贴图片：暂存得到本机地址并插入正文
    const editor = await waitForEditor(wrapper)
    const stage = editor.props('stageImage') as (file: File) => Promise<string | null>
    const localUrl = await stage(new File(['x'], 'a.png', { type: 'image/png' }))
    expect(localUrl).toMatch(/^blob:/)

    await editor.vm.$emit('update:modelValue', `正文![a](${localUrl})`)
    await flush()

    const exposed = wrapper.vm as unknown as { requestCommit: () => Promise<void> }
    await exposed.requestCommit()
    await flush()
    const dialogInput = document.querySelector<HTMLInputElement>('.commit-input')
    dialogInput!.value = 'docs: update'
    dialogInput!.dispatchEvent(new Event('input'))
    await flush()
    document.querySelector<HTMLButtonElement>('.btn-confirm')!.click()
    await flush(12)

    expect(uploaded).toHaveLength(1)
    expect(memory.get('docs/示例.md')).toContain(uploaded[0])
    expect(memory.get('docs/示例.md')).not.toContain('blob:')
    wrapper.unmount()
  })
})

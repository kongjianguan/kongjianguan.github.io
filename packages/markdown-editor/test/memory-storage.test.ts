import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../src/storage/memory'

describe('createMemoryStorage', () => {
  it('初始文件可读且带版本号', async () => {
    const memory = createMemoryStorage({ files: { 'docs/a.md': '内容' } })
    const file = await memory.storage.readFile('docs/a.md')

    expect(file).toEqual({ content: '内容', sha: expect.any(String) })
  })

  it('读取不存在的路径返回 null', async () => {
    const memory = createMemoryStorage()
    expect(await memory.storage.readFile('docs/缺失.md')).toBeNull()
  })

  it('创建成功后可以读回内容', async () => {
    const memory = createMemoryStorage()
    const result = await memory.storage.createFile('docs/新.md', '新内容', 'msg')

    expect(result).not.toBeNull()
    expect(memory.get('docs/新.md')).toBe('新内容')
  })

  it('重复创建同名文件失败', async () => {
    const memory = createMemoryStorage({ files: { 'docs/a.md': '已有' } })
    expect(await memory.storage.createFile('docs/a.md', '覆盖', 'msg')).toBeNull()
    expect(memory.get('docs/a.md')).toBe('已有')
  })

  it('版本号一致时更新成功并换发新版本号', async () => {
    const memory = createMemoryStorage({ files: { 'docs/a.md': '旧' } })
    const before = memory.sha('docs/a.md')
    const result = await memory.storage.updateFile('docs/a.md', '新', before!, 'msg')

    expect(result).not.toBeNull()
    expect(result!.sha).not.toBe(before)
    expect(memory.get('docs/a.md')).toBe('新')
  })

  it('版本号不一致时更新失败且内容不变', async () => {
    const memory = createMemoryStorage({ files: { 'docs/a.md': '旧' } })
    expect(await memory.storage.updateFile('docs/a.md', '新', 'sha-过期', 'msg')).toBeNull()
    expect(memory.get('docs/a.md')).toBe('旧')
  })

  it('更新不存在的路径失败', async () => {
    const memory = createMemoryStorage()
    expect(await memory.storage.updateFile('docs/缺失.md', '新', 'sha-1', 'msg')).toBeNull()
  })

  it('图片上传返回可预测的地址且互不相同', async () => {
    const memory = createMemoryStorage()
    const first = await memory.storage.uploadImage(new File(['a'], 'a.png', { type: 'image/png' }))
    const second = await memory.storage.uploadImage(new File(['b'], 'b.png', { type: 'image/png' }))

    expect(first).not.toBe(second)
    expect(first).toContain('a.png')
  })

  it('自定义地址前缀生效', async () => {
    const memory = createMemoryStorage({ uploadUrlPrefix: '/assets/' })
    const url = await memory.storage.uploadImage(new File(['a'], 'a.png'))
    expect(url!.startsWith('/assets/')).toBe(true)
  })
})

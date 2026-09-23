import { describe, expect, it } from 'vitest'
import {
  assembleMarkdown,
  buildFrontmatter,
  parseFrontmatter,
} from '../src/frontmatter'

describe('parseFrontmatter', () => {
  it('分离 YAML 属性与正文', () => {
    const result = parseFrontmatter('---\ntitle: 标题\ndate: 2026-01-01\n---\n正文内容\n')
    expect(result.error).toBeUndefined()
    expect(result.frontmatter).toEqual({ title: '标题', date: '2026-01-01' })
    expect(result.body).toBe('正文内容\n')
  })

  it('没有属性块时把整段当作正文', () => {
    const result = parseFrontmatter('只有正文')
    expect(result.frontmatter).toEqual({})
    expect(result.body).toBe('只有正文')
  })

  it('属性块为空对象时正文完整保留', () => {
    const result = parseFrontmatter('---\n---\n正文')
    expect(result.frontmatter).toEqual({})
    expect(result.body).toBe('正文')
  })

  it('YAML 是数组时报错', () => {
    const result = parseFrontmatter('---\n- a\n- b\n---\n正文')
    expect(result.error).toContain('文章属性必须是 YAML 对象')
    expect(result.body).toBe('正文')
  })

  it('重复键的 YAML 直接判定为解析失败', () => {
    const result = parseFrontmatter('---\ntitle: a\ntitle: b\n---\n正文')
    expect(result.error).toContain('文章属性 YAML 无法解析')
  })

  it('CRLF 换行同样可以解析', () => {
    const result = parseFrontmatter('---\r\ntitle: 标题\r\n---\r\n正文')
    expect(result.frontmatter).toEqual({ title: '标题' })
    expect(result.body).toBe('正文')
  })

  it('没有结束分隔符时按无属性处理', () => {
    const result = parseFrontmatter('---\ntitle: 标题\n正文')
    expect(result.frontmatter).toEqual({})
    expect(result.body).toBe('---\ntitle: 标题\n正文')
  })
})

describe('buildFrontmatter 与 assembleMarkdown', () => {
  it('生成以分隔符包裹的 YAML', () => {
    const output = buildFrontmatter({ title: '标题', tags: ['a', 'b'] })
    expect(output.startsWith('---\n')).toBe(true)
    expect(output.endsWith('\n---')).toBe(true)
    expect(output).toContain('title: 标题')
  })

  it('长文本不会折行', () => {
    const long = 'x'.repeat(300)
    const output = buildFrontmatter({ description: long })
    expect(output).toContain(long)
  })

  it('拼装后正文与属性之间只有一个换行', () => {
    const output = assembleMarkdown({ title: '标题' }, '正文')
    expect(output).toBe(`---\ntitle: 标题\n---\n正文`)
  })

  it('拼装结果可以被重新解析回原属性', () => {
    const frontmatter = { title: '标题', categories: ['编程'], tags: ['ACM'] }
    const roundTrip = parseFrontmatter(assembleMarkdown(frontmatter, '正文'))
    expect(roundTrip.frontmatter).toEqual(frontmatter)
    expect(roundTrip.body).toBe('正文')
  })
})

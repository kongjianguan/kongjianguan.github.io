import { expect, test, type Page } from '@playwright/test'

const VIEW_LABEL = '本站被访问了'
const VISITOR_LABEL = '本站曾来访过'
const API_PATTERN = '**/events.vercount.one/api/v2/log'

const readRows = (page: Page) => page.locator('.tk-doc-analysis__item').evaluateAll(items =>
  Object.fromEntries(items.map(item => [
    item.children[0].textContent?.trim() ?? '',
    item.children[1].textContent?.trim() ?? '',
  ])))

test.describe.configure({ mode: 'serial' })

test.describe('站点信息访问量', () => {
  test('正常网络显示真实计数', async ({ page }, testInfo) => {
    const api: { status: number }[] = []
    page.on('response', response => {
      if (response.url().includes('/api/v2/log')) api.push({ status: response.status() })
    })

    await page.goto('/')
    await expect.poll(async () => (await readRows(page))[VIEW_LABEL], { timeout: 20_000 }).toMatch(/^\d+ 次$/)
    await expect.poll(async () => (await readRows(page))[VISITOR_LABEL], { timeout: 20_000 }).toMatch(/^\d+ 人$/)

    const rows = await readRows(page)
    expect(rows[VIEW_LABEL]).not.toBe('9999 次')
    expect(rows[VISITOR_LABEL]).not.toBe('9999 人')
    await testInfo.attach('站点信息访问量', {
      body: JSON.stringify({ rows, api }, null, 2), contentType: 'application/json',
    })
  })

  test('接口响应超过 5 秒时仍显示真实计数', async ({ page }, testInfo) => {
    let delay = 0
    await page.route(API_PATTERN, async route => {
      const started = Date.now()
      await new Promise(resolve => setTimeout(resolve, 5_500))
      await route.continue()
      delay = Date.now() - started
    })

    await page.goto('/')
    await expect.poll(async () => (await readRows(page))[VIEW_LABEL], { timeout: 25_000 }).toMatch(/^\d+ 次$/)
    await expect.poll(async () => (await readRows(page))[VISITOR_LABEL], { timeout: 25_000 }).toMatch(/^\d+ 人$/)

    const rows = await readRows(page)
    expect(rows[VIEW_LABEL]).not.toBe('9999 次')
    await testInfo.attach('慢速接口下的站点信息访问量', {
      body: JSON.stringify({ rows, delay }, null, 2), contentType: 'application/json',
    })
  })

  test('接口被阻断且没有缓存时显示占位符', async ({ page }, testInfo) => {
    await page.route(API_PATTERN, route => route.abort('failed'))

    await page.goto('/')
    await expect.poll(async () => (await readRows(page))[VIEW_LABEL], { timeout: 20_000 }).toBe('— 次')
    await expect.poll(async () => (await readRows(page))[VISITOR_LABEL], { timeout: 20_000 }).toBe('— 人')

    const rows = await readRows(page)
    expect(rows[VIEW_LABEL]).not.toBe('9999 次')
    expect(rows[VISITOR_LABEL]).not.toBe('9999 人')
    await testInfo.attach('阻断接口后的站点信息访问量', {
      body: JSON.stringify({ rows }, null, 2), contentType: 'application/json',
    })
  })

  test('接口被阻断时回退到上一次成功的数据', async ({ page }, testInfo) => {
    await page.goto('/')
    await expect.poll(async () => (await readRows(page))[VIEW_LABEL], { timeout: 20_000 }).toMatch(/^\d+ 次$/)
    const before = await readRows(page)

    await page.route(API_PATTERN, route => route.abort('failed'))
    await page.reload()
    await expect.poll(async () => (await readRows(page))[VIEW_LABEL], { timeout: 20_000 }).toBe(before[VIEW_LABEL])
    const after = await readRows(page)

    expect(after[VIEW_LABEL]).toBe(before[VIEW_LABEL])
    expect(after[VISITOR_LABEL]).toBe(before[VISITOR_LABEL])
    expect(after[VIEW_LABEL]).not.toBe('9999 次')
    await testInfo.attach('缓存回退后的站点信息访问量', {
      body: JSON.stringify({ before, after }, null, 2), contentType: 'application/json',
    })
  })

  test('文章页浏览量使用同一份取数逻辑', async ({ page }, testInfo) => {
    await page.goto('/Life/无职转生')
    const pageView = page.locator('a[title="浏览量"]')
    await expect.poll(async () => (await pageView.textContent())?.trim(), { timeout: 20_000 }).toMatch(/^\d+$/)

    const value = (await pageView.textContent())?.trim()
    expect(value).not.toBe('9999')
    await testInfo.attach('文章页浏览量', {
      body: JSON.stringify({ value }, null, 2), contentType: 'application/json',
    })
  })
})

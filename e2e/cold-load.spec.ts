import { expect, test, devices } from '@playwright/test'

test('未登录的首页隐藏编辑入口，延迟加载桌面模型', async ({ page }, testInfo) => {
  const scripts: string[] = []
  const errors: string[] = []
  page.on('request', request => {
    if (request.resourceType() === 'script') scripts.push(request.url())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '编辑文章', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '新建文章', exact: true })).toHaveCount(0)
  await expect.poll(() => scripts.some(url => /\/live2d\.[^/]+\.js$/.test(url))).toBe(true)
  await page.waitForFunction(() => performance.getEntriesByType('resource')
    .some(entry => /\/live2d\.[^/]+\.js$/.test(entry.name)))
  const timing = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const model = performance.getEntriesByType('resource')
      .find(entry => /\/live2d\.[^/]+\.js$/.test(entry.name))!
    return { load: navigation.loadEventEnd, modelStart: model.startTime }
  })
  expect(timing.modelStart).toBeGreaterThanOrEqual(timing.load)
  expect(scripts.some(url => /\/(diagrams|NewArticleDialog|CodeMirrorEditor|mathjax|svg)\./.test(url))).toBe(false)
  expect(errors).toEqual([])
  await testInfo.attach('首页脚本请求', {
    body: JSON.stringify({ scripts, timing, errors }, null, 2), contentType: 'application/json',
  })
})

test('移动设备的无缓存首页不下载模型脚本', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' })
  const page = await context.newPage()
  const client = await context.newCDPSession(page)
  await client.send('Network.enable')
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  const scripts: string[] = []
  page.on('request', request => {
    if (request.resourceType() === 'script') scripts.push(request.url())
  })
  await page.goto('http://127.0.0.1:4174/')
  await page.waitForFunction(() => Boolean((document.querySelector('#app') as any)?.__vue_app__))
  await page.waitForTimeout(2_000)
  expect(scripts.some(url => /\/(live2d|diagrams|NewArticleDialog|CodeMirrorEditor)\./.test(url))).toBe(false)
  await expect(page.getByRole('button', { name: '编辑文章', exact: true })).toHaveCount(0)
  await testInfo.attach('移动设备脚本请求', {
    body: JSON.stringify(scripts, null, 2), contentType: 'application/json',
  })
  await context.close()
})

test('归档页面按需加载贡献图', async ({ page }) => {
  await page.goto('/archives')
  await page.locator('.contribute__chart').scrollIntoViewIfNeeded()
  await expect(page.locator('.contribute__chart canvas').first()).toBeVisible({ timeout: 30_000 })
})

test('三类图表支持直接访问与站内导航', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const scripts: string[] = []
  const errors: string[] = []
  const charts = [
    ['.mermaid-container svg.flowchart', '开始'],
    ['.markmap-container > svg', '博客'],
    ['.infographic svg', '文章流程'],
  ]
  page.on('request', request => {
    if (request.resourceType() === 'script') scripts.push(request.url())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:4175/')
  expect(scripts.some(url => /\/diagrams\./.test(url))).toBe(false)
  await page.getByRole('link', { name: '打开图表验证', exact: true }).click()
  for (const [selector, text] of charts) {
    await expect(page.locator(selector)).toBeVisible({ timeout: 30_000 })
    await expect(page.locator(selector)).toContainText(text, { timeout: 30_000 })
  }
  expect(scripts.some(url => /\/diagrams\./.test(url))).toBe(true)
  await page.reload()
  for (const [selector, text] of charts) {
    await expect(page.locator(selector)).toBeVisible({ timeout: 30_000 })
    await expect(page.locator(selector)).toContainText(text, { timeout: 30_000 })
  }
  await page.goto('http://127.0.0.1:4175/referenced')
  await expect(page.locator('.mermaid-container svg.flowchart')).toContainText('引用图表', { timeout: 30_000 })
  expect(errors).toEqual([])
  await testInfo.attach('图表脚本请求', {
    body: JSON.stringify({ scripts, errors }, null, 2), contentType: 'application/json',
  })
})

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'
import { once } from 'node:events'
import { pathToFileURL } from 'node:url'
import { chromium, devices, expect } from '@playwright/test'
import { serve } from 'vitepress'

const require = createRequire(import.meta.url)
const viteRequire = createRequire(require.resolve('vitepress/package.json'))
const { createServer } = await import(new URL('./dist/node/index.js', pathToFileURL(viteRequire.resolve('vite/package.json'))))
const baseURL = 'http://127.0.0.1:4184'
const articlePath = 'docs/Life/无职转生.md'
const articleURL = '/Life/无职转生'
const outputDir = '.scratch/mobile-editor-e2e'
const report = { status: 'running', api: [], devices: [] }
const selectedDevices = process.argv.slice(2)
await mkdir(outputDir, { recursive: true })

// 使用本机已登录账户的真实凭据，调用应用自己的会话加密和接口处理逻辑。
process.env.GITHUB_SESSION_SECRET = randomBytes(32).toString('base64url')
const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()
const loader = await createServer({
  configFile: false,
  root: process.cwd(),
  cacheDir: '.scratch/api-vite-cache',
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const auth = await loader.ssrLoadModule('/api/_lib/github.ts')
const handlers = new Map(await Promise.all([
  ['/api/github/contents', '/api/github/contents.ts'],
  ['/api/github/upload', '/api/github/upload.ts'],
  ['/api/auth/me', '/api/auth/me.ts'],
  ['/api/auth/logout', '/api/auth/logout.ts'],
].map(async ([path, file]) => [path, (await loader.ssrLoadModule(file)).default])))
const user = await auth.getGitHubUser(token)
assert(user && auth.isAllowedGitHubLogin(user.login), '需要已获本站编辑权限的真实 GitHub 账户')
const sessionValue = await auth.sealSessionToken(token)
const csrfToken = auth.randomToken()
const expectedFile = JSON.parse(execFileSync('gh', [
  'api',
  `repos/kongjianguan/kongjianguan.github.io/contents/${articlePath.split('/').map(encodeURIComponent).join('/')}?ref=main`,
], { encoding: 'utf8' }))

// HTTP 适配仅转交真实处理函数，GitHub 请求保持实际网络调用。
const preview = await serve({ root: 'docs', port: 4184 })
preview.use(async (incoming, outgoing, next) => {
  const url = new URL(incoming.url, baseURL)
  const handler = handlers.get(url.pathname)
  if (!handler) return next()
  const request = new Request(url, {
    method: incoming.method,
    headers: incoming.headers,
    body: ['GET', 'HEAD'].includes(incoming.method) ? undefined : Readable.toWeb(incoming),
    duplex: 'half',
  })
  const response = await handler(request)
  report.api.push({ method: incoming.method, path: url.pathname, file: url.searchParams.get('path'), status: response.status })
  outgoing.statusCode = response.status
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') outgoing.setHeader(name, value)
  })
  outgoing.setHeader('Set-Cookie', response.headers.getSetCookie())
  outgoing.end(Buffer.from(await response.arrayBuffer()))
})
if (!preview.server.listening) await once(preview.server, 'listening')

const browser = await chromium.launch()
let completed = false
try {
  const anonymous = await fetch(`${baseURL}/api/github/contents?${new URLSearchParams({ path: articlePath })}`)
  assert.equal(anonymous.status, 401)

  const scenarios = [
    { name: 'iPhone SE', options: devices['iPhone SE'] },
    { name: 'Android 360px', options: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } },
    { name: 'Android 390px', options: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'Pixel 7', options: devices['Pixel 7'] },
    { name: 'iPad Mini', options: devices['iPad Mini'] },
    { name: 'Desktop', options: { viewport: { width: 1280, height: 900 } } },
  ]
  assert(selectedDevices.every(name => scenarios.some(device => device.name === name)), '设备名称无效')
  for (const device of scenarios.filter(device => selectedDevices.length === 0 || selectedDevices.includes(device.name))) {
    const { defaultBrowserType, ...options } = device.options
    const context = await browser.newContext({ ...options, baseURL, serviceWorkers: 'block' })
    await context.addCookies([
      { name: 'github_session', value: sessionValue, url: baseURL, httpOnly: true, sameSite: 'Lax' },
      { name: 'github_csrf', value: csrfToken, url: baseURL, sameSite: 'Lax' },
    ])
    const page = await context.newPage()
    const requests = []
    page.on('request', request => requests.push(request.url()))
    page.on('dialog', dialog => dialog.accept())
    await page.goto(articleURL, { waitUntil: 'domcontentloaded' })
    const account = page.getByRole('button', { name: `账户：${user.login}`, exact: true })
    await expect(account).toBeVisible({ timeout: 30_000 })
    await expect.poll(() => page.locator('.logged-in .avatar').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)

    const layout = await page.locator('.VPNavBar').evaluate(nav => ({
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      controls: [...nav.querySelectorAll('a, button')]
        .filter(element => element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
        .map(element => ({
        name: element.getAttribute('aria-label') || element.textContent.trim(),
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      })).filter(rect => rect.width > 0 && rect.height > 0).sort((a, b) => a.left - b.left),
    }))
    const avatar = await page.locator('.logged-in .avatar').boundingBox()
    const accountBounds = await account.boundingBox()
    assert(avatar && accountBounds, `${device.name} 头像没有显示`)
    assert.equal(avatar.width, avatar.height, `${device.name} 头像尺寸失真`)
    assert(avatar.x >= accountBounds.x && avatar.x + avatar.width <= accountBounds.x + accountBounds.width,
      `${device.name} 头像超出账户按钮`)
    assert(Math.abs(avatar.y + avatar.height / 2 - accountBounds.y - accountBounds.height / 2) <= 1,
      `${device.name} 头像没有垂直居中`)
    assert(layout.documentWidth <= layout.viewport, `${device.name} 页面出现水平溢出`)
    for (const [index, control] of layout.controls.entries()) {
      assert(control.left >= -1 && control.right <= layout.viewport + 1, `${device.name} ${control.name} 超出视口`)
      if (index > 0) assert(layout.controls[index - 1].right <= control.left + 1,
        `${device.name} 顶部控件相互覆盖：${JSON.stringify([layout.controls[index - 1], control])}`)
    }

    await account.click()
    await expect(page.locator('.user-menu')).toBeInViewport()
    if (layout.viewport < 768) {
      await page.getByRole('button', { name: '新建文章', exact: true }).click()
      await expect(page.getByPlaceholder('添加标题（可选）')).toBeVisible()
      const composer = page.getByRole('dialog', { name: '新建文章' })
      const picker = composer.getByLabel('添加照片')
      await expect(picker).toHaveAttribute('multiple', '')
      await expect(picker).toHaveAttribute('accept', 'image/*')
      await picker.setInputFiles([
        'docs/public/images/2026-02-04.jpg',
        'docs/public/images/2025-09-05.jpg',
        'docs/public/images/2025-05-04.jpg',
      ])
      await expect(composer.locator('.compose-thumb img')).toHaveCount(3)
      await composer.getByRole('button', { name: '移除第 2 张照片' }).click()
      await expect(composer.locator('.compose-thumb img')).toHaveCount(2)
      await composer.getByRole('button', { name: '#摄影', exact: true }).click()
      await expect(composer.getByRole('button', { name: '#摄影', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await composer.getByRole('textbox', { name: '正文' }).fill('留下周末的几张照片。')
      await expect(composer.getByRole('button', { name: /立即发布/ })).toBeEnabled()
      if (device.name === 'Android 390px') {
        await page.screenshot({ path: `${outputDir}/photo-compose-390.png` })
        // 使用真实会话验证上传请求和错误反馈，撤掉 CSRF 凭据使写入在服务器上被拒绝。
        await context.clearCookies({ name: 'github_csrf' })
        await composer.getByRole('button', { name: /立即发布/ }).click()
        await expect(composer.getByRole('alert')).toContainText('第 1 张照片上传失败')
        await expect(composer.locator('.compose-thumb img')).toHaveCount(2)
        const attemptedUploads = report.api.filter(request => request.path === '/api/github/upload')
        assert.deepEqual(attemptedUploads.map(request => request.status), [403, 403])
        assert(!report.api.some(request => request.path === '/api/github/contents' && request.method === 'POST'))
        await context.addCookies([{ name: 'github_csrf', value: csrfToken, url: baseURL, sameSite: 'Lax' }])
      }
      await composer.getByRole('button', { name: /专栏文章/ }).click()
      await expect(composer.getByPlaceholder('文章标题')).toBeVisible()
      await expect(composer.getByRole('button', { name: '开始写作' })).toBeDisabled()
      await page.getByRole('button', { name: '取消', exact: true }).click()
      await expect(account).toHaveAttribute('aria-expanded', 'false')
    } else {
      await account.click()
    }

    await page.getByRole('button', { name: '编辑文章', exact: true }).click()
    await page.getByRole('button', { name: '文章属性' }).click()
    const title = page.locator('.fm-row').filter({ hasText: '标题' }).locator('input')
    await expect(title).toHaveValue('无职转生', { timeout: 30_000 })
    await expect(page.locator('.cm-content')).toContainText('0x0')
    await expect(page.locator('.editor-error')).toHaveCount(0)
    assert(requests.some(url => url.startsWith(`${baseURL}/api/github/contents?`)), '编辑器未通过本站接口读取文章')
    assert(!requests.some(url => url.startsWith('https://api.github.com/')), '浏览器直接请求了 GitHub API')

    const file = await context.request.get('/api/github/contents', { params: { path: articlePath } })
    assert.equal(file.status(), 200)
    assert.equal(file.headers()['cache-control'], 'no-store')
    const content = await file.json()
    assert.equal(content.sha, expectedFile.sha)
    assert.equal(Buffer.from(content.content, 'base64').toString('utf8'), Buffer.from(expectedFile.content, 'base64').toString('utf8'))

    if (device.name === 'Android 390px') {
      await title.fill('移动端布局验证草稿')
      await page.setViewportSize({ width: 390, height: 360 })
      await expect(title).toBeFocused()
      await page.getByRole('button', { name: '保存草稿', exact: true }).click()
      await page.getByRole('button', { name: '退出', exact: true }).click()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: '编辑文章', exact: true }).click()
      await page.getByRole('button', { name: '文章属性' }).click()
      await expect(title).toHaveValue('移动端布局验证草稿')
      await page.setViewportSize({ width: 390, height: 844 })

      const invalid = await context.request.get('/api/github/contents', { params: { path: 'docs/.vitepress/config.mts' } })
      assert.equal(invalid.status(), 400)
      const missing = await context.request.get('/api/github/contents', { params: { path: 'docs/Life/__missing_mobile_editor_check__.md' } })
      assert.equal(missing.status(), 404)
      const csrf = await context.request.post('/api/github/contents', { data: {} })
      assert.equal(csrf.status(), 403)

      await account.click()
      await page.getByRole('button', { name: '退出登录', exact: true }).click()
      await expect(page.getByRole('button', { name: '编辑文章', exact: true })).toHaveCount(0)
      await expect(page.locator('.VPNavBar').getByRole('button', { name: '登录', exact: true })).toBeInViewport()
      const loggedOut = await context.request.get('/api/github/contents', { params: { path: articlePath } })
      assert.equal(loggedOut.status(), 401)
    }

    report.devices.push({ name: device.name, layout, authenticatedArticleSha: content.sha, browserGitHubRequests: 0, photoComposer: layout.viewport < 768 })
    console.log(`${device.name}: 导航、头像、真实文章读取通过`)
    await context.close()
  }
  completed = true
} finally {
  report.status = completed ? 'passed' : 'failed'
  await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
  await new Promise(resolve => preview.server.close(resolve))
  await loader.close()
}
console.log(`验证记录：${outputDir}/report.json`)

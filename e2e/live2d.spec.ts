import { devices, expect, test } from '@playwright/test'

for (const deviceName of ['Pixel 7', 'Pixel 7 landscape', 'iPhone 13']) {
  test.describe(`手机 ${deviceName}`, () => {
    const { defaultBrowserType, ...device } = devices[deviceName]
    test.use(device)

    test('首页、旋转屏幕和归档页面均不加载 Live2D 资源及组件', async ({ page, context }, testInfo) => {
      test.setTimeout(90_000)
      const client = await context.newCDPSession(page)
      await client.send('Network.enable')
      await client.send('Network.setCacheDisabled', { cacheDisabled: true })
      const requests: string[] = []
      const errors: string[] = []
      const checkpoints: object[] = []
      page.on('request', request => requests.push(request.url()))
      page.on('pageerror', error => errors.push(error.message))

      for (const path of ['/', '/archives']) {
        await page.goto(path, { waitUntil: 'load' })
        await expect(page.getByRole('button', { name: '登录', exact: true })).toBeAttached()
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.waitForTimeout(1_500)
        await expect(page.locator('[id^="oml2d"]')).toHaveCount(0)
        const runtime = await page.evaluate(() => ({
          live2d: 'Live2D' in window,
          cubism: 'Live2DCubismCore' in window,
          styles: [...document.querySelectorAll('style')].some(style => style.textContent?.includes('oml2d')),
          coarsePointer: window.matchMedia('(pointer: coarse)').matches,
        }))
        expect(runtime).toEqual({ live2d: false, cubism: false, styles: false, coarsePointer: true })
        checkpoints.push({ path, runtime })
      }

      expect(requests.filter(url => /live2d|oml2d|cubism|anon_037_live_default|\/rem\//i.test(url))).toEqual([])
      expect(errors).toEqual([])
      await testInfo.attach('手机 Live2D 请求与运行记录', {
        body: JSON.stringify({ deviceName, requests, checkpoints, errors }, null, 2),
        contentType: 'application/json',
      })
    })
  })
}

for (const deviceName of ['iPad Mini', 'iPad Pro 11', 'iPad Pro 11 landscape', 'Galaxy Tab S4']) {
  test.describe(`平板 ${deviceName}`, () => {
    const { defaultBrowserType, ...device } = devices[deviceName]
    test.use(device)

    test('加载爱音模型，旋转屏幕及分屏时保持显示', async ({ page }, testInfo) => {
      test.setTimeout(90_000)
      const requests: string[] = []
      const errors: string[] = []
      page.on('request', request => requests.push(request.url()))
      page.on('pageerror', error => errors.push(error.message))
      await page.goto('/')
      const canvas = page.locator('#oml2d-stage canvas')
      await expect(canvas).toBeVisible({ timeout: 60_000 })
      await expect.poll(() => requests.some(url => url.endsWith('/data/model.moc'))).toBe(true)
      await expect.poll(() => requests.filter(url => /\/data\/textures\/texture_0[01]\.png$/.test(url)).length).toBe(2)
      await expect(page.locator('#About')).toBeAttached()
      for (const viewport of [{ width: 1194, height: 834 }, { width: 600, height: 834 }]) {
        await page.setViewportSize(viewport)
        await expect(canvas).toBeVisible()
        await expect(page.locator('#oml2d-stage')).toBeInViewport()
      }
      expect(errors).toEqual([])
      await testInfo.attach('平板 Live2D 请求与运行记录', {
        body: JSON.stringify({ deviceName, requests, errors }, null, 2),
        contentType: 'application/json',
      })
    })
  })
}

for (const savedModel of [null, '1']) {
  test(`Live2D 装饰图标无点击动作，爱音正常加载（保存的模型：${savedModel ?? '无'}）`, async ({ page, context }, testInfo) => {
    test.setTimeout(90_000)
    if (savedModel !== null) {
      await page.addInitScript(value => localStorage.setItem('OML2D_MODEL_INDEX', value), savedModel)
    }

    const requests: string[] = []
    const errors: string[] = []
    const popups: string[] = []
    page.on('request', request => requests.push(request.url()))
    page.on('pageerror', error => errors.push(error.message))
    context.on('page', popup => popups.push(popup.url()))
    await page.goto('/')
    const stage = page.locator('#oml2d-stage')
    await expect(stage.locator('canvas')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('#About')).toBeAttached({ timeout: 60_000 })
    await expect.poll(() => requests.filter(url => url.includes('/anon_037_live_default/model.json')).length).toBe(1)
    await expect.poll(() => requests.some(url => url.endsWith('/data/model.moc'))).toBe(true)
    await expect.poll(() => requests.filter(url => /\/data\/textures\/texture_0[01]\.png$/.test(url)).length).toBe(2)

    const modelRequests = requests.filter(url => url.includes('/anon_037_live_default/'))
    const initialUrl = page.url()
    for (let repetition = 0; repetition < 2; repetition++) {
      for (const id of ['About', 'SwitchModel', 'SwitchModelClothes']) {
        await stage.hover()
        await page.locator(`#${id}`).click()
      }
    }
    await page.waitForTimeout(1_200)
    expect(page.url()).toBe(initialUrl)
    expect(popups).toEqual([])
    expect(requests.some(url => url.includes('oml2d.com'))).toBe(false)
    expect(requests.some(url => url.includes('/rem/'))).toBe(false)
    expect(requests.filter(url => url.includes('/anon_037_live_default/'))).toEqual(modelRequests)
    expect(await page.evaluate(() => localStorage.getItem('OML2D_MODEL_INDEX'))).toBe('0')
    await expect(stage.locator('canvas')).toBeVisible()

    await stage.hover()
    await page.locator('#Rest').click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('OML2D_STATUS'))).toBe('sleep')
    await page.locator('#oml2d-statusBar').click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('OML2D_STATUS'))).toBe('active')
    expect(errors).toEqual([])
    await testInfo.attach('Live2D 浏览器验证记录', {
      body: JSON.stringify({ savedModel, initialUrl, modelRequests, requests, popups, errors }, null, 2),
      contentType: 'application/json',
    })
  })
}

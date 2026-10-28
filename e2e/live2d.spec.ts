import { expect, test } from '@playwright/test'

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

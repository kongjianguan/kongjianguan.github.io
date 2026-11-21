import { expect, test, type Locator } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { parseFrontmatter } from '../packages/markdown-editor/src/frontmatter'

const post = 'Life/photo-5d4be528-0e4'
const secondPost = 'Life/photo-8ce079a2-f54'

async function textStyle(locator: Locator) {
  return locator.evaluate(node => {
    const { color, fontFamily, fontSize, fontWeight, lineHeight } = getComputedStyle(node)
    return { color, fontFamily, fontSize, fontWeight, lineHeight }
  })
}

test('图文动态编辑保留阅读卡片，并实时更新画廊和本机草稿', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'warning' && message.text().includes('[Vue warn]')) errors.push(message.text())
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/${post}`)
  const reading = page.locator('main.red-post')
  const editing = page.locator('.mde-editor-body.with-media')
  const navigation = page.locator('.edit-article-btn')
  const gallery = editing.locator('.photo-gallery')
  const body = editing.locator('.cm-content')
  const title = editing.getByRole('textbox', { name: '文章标题' })
  const paragraph = reading.locator('.red-post-body p').first()
  await expect(reading).toBeVisible()
  const readingTitle = await textStyle(reading.locator('h1'))
  const readingBody = await textStyle(paragraph)
  const readingTags = await textStyle(reading.locator('.red-post-tags li'))
  const readingCard = (await reading.boundingBox())!
  const readingCopy = (await reading.locator('.red-post-copy').boundingBox())!
  const readingImage = reading.locator('.photo-track img')
  await expect.poll(() => readingImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('reading-desktop.png') })

  await navigation.click()
  await expect(body).toBeVisible()
  await expect(reading).toBeHidden()
  await expect(gallery).toBeVisible()
  await expect(editing).toHaveCSS('grid-template-columns', '589px 589px')
  await expect(editing).toHaveCSS('border-radius', '16px')
  expect(await textStyle(title)).toEqual(readingTitle)
  expect(await textStyle(body)).toEqual(readingBody)
  expect(await textStyle(editing.locator('.mde-doc-tags li'))).toEqual(readingTags)
  const editCard = (await editing.boundingBox())!
  const editCopy = (await editing.locator('.mde-doc-copy').boundingBox())!
  expect(editCard.x).toBe(readingCard.x)
  expect(editCard.width).toBe(readingCard.width)
  expect(editCopy.x).toBe(readingCopy.x)
  expect(editCopy.width).toBe(readingCopy.width)
  await expect(editing.locator('.mde-doc-author')).toHaveText('kongjianguan')
  await expect(editing.locator('time')).toHaveText('2026-11-20')
  await expect(editing.locator('.mde-paragraph-gap').first()).toHaveCSS('line-height', '16px')
  await page.screenshot({ path: testInfo.outputPath('editing-desktop.png') })

  await page.setViewportSize({ width: 960, height: 900 })
  await expect(editing).toHaveCSS('display', 'grid')
  await page.setViewportSize({ width: 959, height: 900 })
  await expect(editing).toHaveCSS('display', 'block')
  await page.setViewportSize({ width: 1440, height: 900 })

  const photoField = editing.getByRole('textbox', { name: '照片地址' })
  const properties = editing.getByRole('button', { name: '文章属性' })
  const [, source] = await Promise.all([
    properties.click(),
    readFile(`docs/${secondPost}.md`, 'utf8'),
  ])
  const secondPhoto = (parseFrontmatter(source).frontmatter.photos as string[])[0]
  const firstPhoto = await photoField.inputValue()
  await photoField.fill('')
  await expect(gallery).toHaveCount(0)
  await expect(editing).toHaveCSS('display', 'block')
  await photoField.fill(`${firstPhoto}\n${secondPhoto}`)
  await expect(gallery.locator('.photo-track img')).toHaveCount(2)
  await expect.poll(() => gallery.locator('.photo-track img').evaluateAll(images =>
    images.every(image => (image as HTMLImageElement).naturalWidth > 0),
  )).toBe(true)
  await properties.click()
  await title.fill('图文动态编辑验证')
  await expect(gallery.locator('.photo-track img').first()).toHaveAttribute('alt', /图文动态编辑验证/)

  await gallery.getByRole('button', { name: '下一张照片' }).click()
  await expect(gallery.locator('.photo-count')).toHaveText('2 / 2')
  await gallery.getByRole('button', { name: '预览第 2 张照片' }).click()
  const preview = page.getByRole('dialog', { name: '照片预览' })
  await expect(preview).toBeVisible()
  await preview.locator('.photo-preview-stage').dblclick()
  await expect(preview.locator('.photo-preview-stage')).toHaveClass(/is-zoomed/)
  await page.keyboard.press('ArrowLeft')
  await expect(preview.locator('.preview-counter')).toHaveText('1 / 2')
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()

  const original = await body.innerText()
  await body.fill(Array.from({ length: 16 }, () => original).join('\n\n'))
  const toolbar = page.locator('.red-post-editor .editor-toolbar')
  const stickyGallery = gallery.locator('.photo-sticky-wrap')
  await expect(stickyGallery).toHaveCSS('position', 'sticky')
  await page.evaluate(() => window.scrollTo({ top: 240, behavior: 'instant' }))
  const firstToolbar = (await toolbar.boundingBox())!
  const firstGallery = (await stickyGallery.boundingBox())!
  await page.evaluate(() => window.scrollTo({ top: 460, behavior: 'instant' }))
  const secondToolbar = (await toolbar.boundingBox())!
  const secondGallery = (await stickyGallery.boundingBox())!
  expect(secondToolbar.y).toBeCloseTo(firstToolbar.y)
  expect(secondGallery.y).toBeCloseTo(firstGallery.y)
  expect(secondGallery.y).toBeGreaterThanOrEqual(secondToolbar.y + secondToolbar.height)

  await toolbar.getByRole('button', { name: '保存草稿' }).click()
  await expect(toolbar.getByText('本机草稿已保存')).toBeVisible()
  page.on('dialog', dialog => dialog.accept())
  await navigation.click()
  await expect(reading).toBeVisible()
  await navigation.click()
  await expect(title).toHaveValue('图文动态编辑验证')
  await expect(gallery.locator('.photo-track img')).toHaveCount(2)
  expect(errors).toEqual([])
})

test.describe('触屏图文编辑', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })

  test('手机保持上图下文，照片可滑动、双击缩放和拖动', async ({ page }, testInfo) => {
    await page.goto(`/${post}`)
    const reading = page.locator('main.red-post')
    await expect(reading).toBeVisible()
    const readingCard = (await reading.boundingBox())!
    await page.locator('.edit-article-btn').tap()
    const editing = page.locator('.mde-editor-body.with-media')
    const gallery = editing.locator('.photo-gallery')
    await expect(gallery).toBeVisible()
    await expect(reading).toBeHidden()
    const editCard = (await editing.boundingBox())!
    const photo = (await gallery.boundingBox())!
    const copy = (await editing.locator('.mde-doc-copy').boundingBox())!
    expect(editCard.x).toBe(readingCard.x)
    expect(editCard.width).toBe(readingCard.width)
    expect(photo.y + photo.height).toBeCloseTo(copy.y)
    await page.screenshot({ path: testInfo.outputPath('editing-mobile.png'), fullPage: true })

    await editing.getByRole('button', { name: '文章属性' }).tap()
    const photoField = editing.getByRole('textbox', { name: '照片地址' })
    const second = parseFrontmatter(await readFile(`docs/${secondPost}.md`, 'utf8')).frontmatter.photos as string[]
    await photoField.fill(`${await photoField.inputValue()}\n${second[0]}`)
    await gallery.getByRole('button', { name: '预览第 1 张照片' }).tap()
    const preview = page.getByRole('dialog', { name: '照片预览' })
    await expect(preview).toBeVisible()

    const input = await page.context().newCDPSession(page)
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y: 400 }] })
    await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: 400 }] })
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(preview.locator('.preview-counter')).toHaveText('2 / 2')

    await page.touchscreen.tap(195, 440)
    await page.touchscreen.tap(195, 440)
    const stage = preview.locator('.photo-preview-stage')
    await expect(stage).toHaveClass(/is-zoomed/)
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 440 }] })
    await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: 480 }] })
    await expect(stage).toHaveClass(/is-panning/)
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await preview.getByRole('button', { name: '关闭照片预览' }).tap()
    await expect(preview).toBeHidden()
  })
})

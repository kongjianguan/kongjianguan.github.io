import { expect, test } from '@playwright/test'
import { assembleMarkdown, parseFrontmatter } from '../packages/markdown-editor/src/frontmatter'

test('本机草稿在文章路由离开后仍可恢复', async ({ page }) => {
  await page.goto('/programming/树的重心/')
  let confirmNavigation = false
  page.on('dialog', dialog => confirmNavigation ? dialog.accept() : dialog.dismiss())
  await expect(page.getByRole('button', { name: '编辑文章' })).toBeEnabled()
  await page.getByRole('button', { name: '编辑文章' }).click()
  await expect(page.getByRole('button', { name: '阅读模式' })).toBeVisible()

  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  await editor.press('Meta+ArrowDown')
  await editor.press('Enter')
  await editor.press('Enter')
  await editor.pressSequentially('\nE2E 草稿恢复标记')
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('本机草稿已保存')).toBeVisible()

  const nextArticle = page.getByRole('navigation', { name: 'Pager' })
    .getByRole('link', { name: /上一页 使用Cloudflare建立静态站点/ })
  confirmNavigation = false
  await nextArticle.click()
  await expect.poll(() => page.evaluate(() => decodeURIComponent(location.pathname)))
    .toContain('树的重心')
  await expect(editor).toBeVisible()

  confirmNavigation = true
  await nextArticle.click()
  await page.waitForURL(url => decodeURIComponent(url.pathname).includes('使用Cloudflare建立静态站点'))
  await page.goBack()
  await page.waitForURL(url => decodeURIComponent(url.pathname).includes('树的重心'))
  await expect(page.locator('h1#树的重心')).toBeVisible()
  await expect(page.getByRole('button', { name: '编辑文章' })).toBeEnabled()
  await page.getByRole('button', { name: '编辑文章' }).click()
  const restoredEditor = page.locator('.cm-content')
  await expect(restoredEditor).toBeVisible()
  await restoredEditor.press('Meta+ArrowDown')
  await expect(restoredEditor).toContainText('E2E 草稿恢复标记')
})

test('分类标签与标题属性可保存并恢复', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/programming/树的重心/')
  await page.getByRole('button', { name: '编辑文章' }).click()
  const tags = page.locator('.fm-row').filter({ hasText: '标签' }).locator('input')
  await tags.fill('one, two,')
  await expect(tags).toHaveValue('one, two,')
  await tags.press('Tab')
  await expect(tags).toHaveValue('one, two')

  const title = page.locator('.fm-row').filter({ hasText: '标题' }).locator('input')
  await title.fill('E2E 属性恢复标题')
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('本机草稿已保存')).toBeVisible()
  await page.getByRole('button', { name: '退出' }).click()
  await expect(page.getByRole('button', { name: '编辑文章' })).toBeVisible()
  await expect(page.locator('.cm-content')).toHaveCount(0)
  await page.getByRole('button', { name: '编辑文章' }).click()
  await expect(page.locator('.fm-row').filter({ hasText: '标题' }).locator('input'))
    .toHaveValue('E2E 属性恢复标题')
})

test('真实损坏的草稿YAML可修复并保留正文', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/programming/树的重心/')
  await page.getByRole('button', { name: '编辑文章' }).click()

  const title = page.locator('.fm-row').filter({ hasText: '标题' }).locator('input')
  await expect(title).toHaveValue('树的重心')
  await expect(page.locator('.cm-content')).toContainText('树若以某点为根')
  await title.fill('E2E YAML损坏前标题')
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('本机草稿已保存')).toBeVisible()
  await page.getByRole('button', { name: '退出' }).click()
  await expect(page.getByRole('button', { name: '编辑文章' })).toBeVisible()
  await expect(page.locator('.cm-content')).toHaveCount(0)

  const stored = await page.evaluate(() => new Promise<{
    content: string
    imageKeys: string[]
  }>((resolve, reject) => {
    const request = indexedDB.open('keyval-store')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const read = request.result.transaction('keyval', 'readonly')
        .objectStore('keyval').get('draft:docs/programming/树的重心.md')
      read.onsuccess = () => {
        if (!read.result) return reject(new Error('编辑器草稿没有写入IndexedDB'))
        resolve({
          content: read.result.content,
          imageKeys: Object.keys(read.result.images),
        })
      }
      read.onerror = () => reject(read.error)
    }
  }))
  const parsed = parseFrontmatter(stored.content)
  expect(parsed.error).toBeUndefined()
  expect(parsed.frontmatter.categories).toEqual(['编程'])
  expect(parsed.frontmatter.tags).toEqual(['ACM', '算法'])
  const invalidContent = `---\ntitle: [broken\n---\n${parsed.body}`
  await page.evaluate(content => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('keyval-store')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const transaction = request.result.transaction('keyval', 'readwrite')
      const store = transaction.objectStore('keyval')
      const read = store.get('draft:docs/programming/树的重心.md')
      read.onsuccess = () => {
        if (!read.result) return reject(new Error('编辑器草稿没有写入IndexedDB'))
        read.result.content = content
        store.put(read.result, 'draft:docs/programming/树的重心.md')
      }
      read.onerror = () => reject(read.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    }
  }), invalidContent)

  await page.getByRole('button', { name: '编辑文章' }).click()
  const repairField = page.getByRole('textbox', { name: '修复文章属性 YAML' })
  await expect(repairField).toBeVisible()
  await expect(page.locator('.editor-error')).toContainText('YAML 无法解析')

  const repairedContent = assembleMarkdown(
    { ...parsed.frontmatter, title: 'E2E YAML修复标题' },
    parsed.body,
  )
  await repairField.fill(repairedContent)
  await expect(repairField).toBeVisible()
  await expect(repairField).toBeFocused()
  const applyRepair = page.getByRole('button', { name: '应用文章属性修复' })
  await expect(applyRepair).toBeEnabled()
  await applyRepair.click()

  await expect(page.locator('.fm-row').filter({ hasText: '标题' }).locator('input'))
    .toHaveValue('E2E YAML修复标题')
  const repairedEditor = page.locator('.cm-content')
  await expect(repairedEditor).toBeVisible()
  await repairedEditor.press('Meta+ArrowUp')
  await expect(repairedEditor).toContainText('树若以某点为根')
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('本机草稿已保存')).toBeVisible()
  await page.getByRole('button', { name: '退出' }).click()
  await expect(page.getByRole('button', { name: '编辑文章' })).toBeVisible()
  await page.getByRole('button', { name: '编辑文章' }).click()
  await expect(page.locator('.fm-row').filter({ hasText: '标题' }).locator('input'))
    .toHaveValue('E2E YAML修复标题')
  const restoredEditor = page.locator('.cm-content')
  await restoredEditor.press('Meta+ArrowUp')
  await expect(restoredEditor).toContainText('树若以某点为根')
})

test('撤销至原文后离开不会恢复过期草稿', async ({ page }) => {
  await page.goto('/programming/树的重心/')
  await page.getByRole('button', { name: '编辑文章' }).click()
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  await editor.press('Meta+ArrowDown')
  await editor.pressSequentially('\nE2E 撤销标记')
  await expect(page.locator('.toolbar-status.dirty')).toBeVisible()
  await expect(page.getByText('本机草稿已保存')).toBeVisible({ timeout: 3000 })
  await editor.press('Meta+z')
  await expect(page.getByRole('button', { name: '保存草稿' })).toBeDisabled()
  await expect.poll(() => page.evaluate(() => new Promise<boolean>((resolve, reject) => {
    const request = indexedDB.open('keyval-store')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const read = request.result.transaction('keyval', 'readonly')
        .objectStore('keyval').get('draft:docs/programming/树的重心.md')
      read.onsuccess = () => resolve(read.result !== undefined)
      read.onerror = () => reject(read.error)
    }
  }))).toBe(false)
  await page.reload()
  await expect(page.getByRole('button', { name: '编辑文章' })).toBeVisible()
  await page.getByRole('button', { name: '编辑文章' }).click()
  await expect(page.getByRole('button', { name: '阅读模式' })).toBeVisible()
  const restoredEditor = page.locator('.cm-content')
  await expect(restoredEditor).toBeVisible()
  await restoredEditor.press('Meta+ArrowDown')
  await expect(restoredEditor).not.toContainText('E2E 撤销标记')
})

test('含图片的本机草稿在远程不可用时恢复', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/programming/树的重心/')
  await page.getByRole('button', { name: '编辑文章' }).click()
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  await editor.press('Meta+ArrowDown')
  await editor.press('Enter')
  await editor.press('Enter')
  await page.evaluate(async () => {
    const response = await fetch('/images/2024-09-26-3.png')
    const image = await response.blob()
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })])
  })
  await editor.press('Meta+v')
  await expect(editor).toContainText('blob:')
  await editor.press('Enter')
  await editor.press('Enter')
  await editor.press('Meta+ArrowDown')
  const originalImage = page.locator('.cm-content .mde-image')
  await originalImage.scrollIntoViewIfNeeded()
  await expect.poll(() => originalImage.evaluate(element => {
    const rendered = element as HTMLImageElement
    return rendered.complete && rendered.naturalWidth > 0
  })).toBe(true)
  const originalDimensions = await originalImage.evaluate(element => {
    const rendered = element as HTMLImageElement
    return { width: rendered.naturalWidth, height: rendered.naturalHeight }
  })
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('本机草稿已保存')).toBeVisible()
  const savedDraft = await page.evaluate(() => new Promise<{ keys: string[]; content: string; imageSizes: number[] }>((resolve, reject) => {
    const request = indexedDB.open('keyval-store')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const transaction = request.result.transaction('keyval', 'readonly')
      const store = transaction.objectStore('keyval')
      const keysRequest = store.getAllKeys()
      keysRequest.onsuccess = () => {
        const keys = keysRequest.result.map(String)
        const draftRequest = store.get('draft:docs/programming/树的重心.md')
        draftRequest.onsuccess = () => resolve({
          keys,
          content: draftRequest.result?.content ?? '',
          imageSizes: Object.values(draftRequest.result?.images ?? {}).map((file: any) => file.size),
        })
        draftRequest.onerror = () => reject(draftRequest.error)
      }
      keysRequest.onerror = () => reject(keysRequest.error)
    }
  }))
  expect(savedDraft.content).toContain('blob:')
  expect(savedDraft.imageSizes[0]).toBeGreaterThan(0)

  await page.context().setOffline(true)
  await page.getByRole('button', { name: '退出' }).click()
  const savedAfterExit = await page.evaluate(() => new Promise<{ content: string; imageSizes: number[] }>((resolve, reject) => {
    const request = indexedDB.open('keyval-store')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const draftRequest = request.result.transaction('keyval', 'readonly')
        .objectStore('keyval').get('draft:docs/programming/树的重心.md')
      draftRequest.onsuccess = () => resolve({
        content: draftRequest.result?.content ?? '',
        imageSizes: Object.values(draftRequest.result?.images ?? {}).map((file: any) => file.size),
      })
      draftRequest.onerror = () => reject(draftRequest.error)
    }
  }))
  expect(savedAfterExit.content).toContain('blob:')
  expect(savedAfterExit.imageSizes[0]).toBeGreaterThan(0)
  await page.getByRole('button', { name: '编辑文章' }).click()
  const restoredEditor = page.locator('.cm-content')
  await expect(restoredEditor).toBeVisible()
  await restoredEditor.press('Meta+ArrowDown')
  const image = page.locator('.cm-content .mde-image')
  await image.scrollIntoViewIfNeeded()
  await expect.poll(() => image.evaluate(element => {
    const rendered = element as HTMLImageElement
    return rendered.complete && rendered.naturalWidth > 0
  })).toBe(true)
  await expect.poll(() => image.evaluate(element => {
    const rendered = element as HTMLImageElement
    return { width: rendered.naturalWidth, height: rendered.naturalHeight }
  })).toEqual(originalDimensions)
})

test('表格预览包含可打开链接和可加载图片', async ({ page }) => {
  await page.goto('/programming/树的重心/')
  await page.getByRole('button', { name: '编辑文章' }).click()
  const editor = page.locator('.cm-content')
  await editor.click()
  await editor.press('Meta+a')
  await editor.pressSequentially(
    '| Link | Image |\n| --- | --- |\n| [Open](https://example.com) | ![sample](/images/2024-09-26-3.png) |\n\n结束',
  )
  await editor.press('Meta+ArrowDown')

  const table = page.locator('.mde-table')
  await expect(table.locator('a[href="https://example.com"]')).toBeVisible()
  const image = table.locator('img')
  await expect.poll(() => image.evaluate(element => {
    const rendered = element as HTMLImageElement
    return rendered.complete && rendered.naturalWidth > 0
  })).toBe(true)
})

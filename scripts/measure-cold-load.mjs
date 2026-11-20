import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium, devices } from '@playwright/test'

const [label, baseURL = 'http://127.0.0.1:4174'] = process.argv.slice(2)
if (!label || !/^[a-z0-9-]+$/.test(label)) throw new Error('请提供测量名称，例如 baseline')

const outputDirectory = resolve('.scratch/cold-load', label)
await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true })
const reports = []

try {
  for (const [device, options] of [
    ['desktop', { viewport: { width: 1440, height: 900 } }],
    ['mobile', devices['Pixel 7']],
  ]) {
    const context = await browser.newContext({ ...options, serviceWorkers: 'block' })
    const page = await context.newPage()
    const client = await context.newCDPSession(page)
    await client.send('Network.enable')
    await client.send('Network.setCacheDisabled', { cacheDisabled: true })
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 100,
      downloadThroughput: 500_000,
      uploadThroughput: 125_000,
    })
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })

    const scripts = []
    const requestedScripts = []
    const pendingBodies = []
    const pageErrors = []
    const failedRequests = []
    page.on('request', request => {
      if (request.resourceType() === 'script') requestedScripts.push(request.url())
    })
    page.on('pageerror', error => {
      pageErrors.push(error.message)
      console.error(error.message)
    })
    page.on('requestfailed', request => failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText,
    }))
    page.on('requestfinished', request => {
      if (request.resourceType() !== 'script') return
      pendingBodies.push((async () => {
        const response = await request.response()
        if (response.status() >= 300 && response.status() < 400) return
        const body = await response.body()
        scripts.push({
          url: request.url(),
          status: response.status(),
          bytes: body.length,
          gzipBytes: gzipSync(body).length,
          sizes: await request.sizes(),
        })
      })())
    })
    await page.addInitScript(() => {
      window.coldLoadMetrics = { lcp: 0, longTasks: [] }
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.coldLoadMetrics.lcp = entry.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          window.coldLoadMetrics.longTasks.push({ start: entry.startTime, duration: entry.duration })
        }
      }).observe({ type: 'longtask', buffered: true })
    })

    const documentResponse = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    const initialScriptURLs = await page.evaluate(html => {
      const document = new DOMParser().parseFromString(html, 'text/html')
      return Array.from(document.querySelectorAll('script[src], link[rel="modulepreload"]'))
        .map(element => new URL(element.getAttribute('src') || element.getAttribute('href'), location.href).href)
    }, await documentResponse.text())
    await page.waitForFunction(() => Boolean(document.querySelector('#app')?.__vue_app__))
    const hydratedAt = await page.evaluate(() => performance.now())
    await page.waitForLoadState('load', { timeout: 120_000 })
    await page.waitForTimeout(5_000)
    const metrics = await page.evaluate(() => ({
      ...window.coldLoadMetrics,
      paints: performance.getEntriesByType('paint').map(entry => entry.toJSON()),
      navigation: performance.getEntriesByType('navigation')[0].toJSON(),
      resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()),
      editButtonVisible: Boolean(document.querySelector('.edit-article-btn')),
    }))
    metrics.initialScripts = initialScriptURLs
    await Promise.all(pendingBodies)
    const initialScripts = scripts.filter(script => metrics.initialScripts.includes(script.url))
    const report = {
      device,
      baseURL,
      conditions: { cache: 'disabled', bandwidthBytesPerSecond: 500_000, latencyMs: 100, cpuSlowdown: 4 },
      hydratedAt,
      initialScriptBytes: initialScripts.reduce((sum, script) => sum + script.bytes, 0),
      initialScriptGzipBytes: initialScripts.reduce((sum, script) => sum + script.gzipBytes, 0),
      allScriptBytes: scripts.reduce((sum, script) => sum + script.bytes, 0),
      allScriptGzipBytes: scripts.reduce((sum, script) => sum + script.gzipBytes, 0),
      scripts,
      requestedScripts,
      metrics,
      pageErrors,
      failedRequests,
    }
    reports.push(report)
    await writeFile(resolve(outputDirectory, `${device}.json`), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ device, hydratedAt, initialScriptBytes: report.initialScriptBytes,
      allScriptBytes: report.allScriptBytes, pageErrors, failedRequestCount: failedRequests.length }))
    await context.close()
  }
  await writeFile(resolve(outputDirectory, 'report.json'), JSON.stringify(reports, null, 2) + '\n')
} finally {
  await browser.close()
}

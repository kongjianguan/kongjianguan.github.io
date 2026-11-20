import { resolve } from 'node:path'
import { defineConfig } from 'vitepress'
import blogConfig from '../../../docs/.vitepress/config.mts'

export default defineConfig({
  extends: blogConfig,
  rewrites: {},
  outDir: resolve('.scratch/diagram-site-dist'),
  cacheDir: resolve('.scratch/diagram-site-cache'),
})

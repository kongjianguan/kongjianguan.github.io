<script setup lang="ts">
import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'
import { TkCommentGiscus } from 'vitepress-theme-teek'
import RedPhotoGallery from './RedPhotoGallery.vue'
import { getPostPhotos, resolvePostImage } from '../redPost'

const { frontmatter, page, site, theme } = useData()
const route = useRoute()
const photos = computed(() => getPostPhotos(frontmatter.value.photos)
  .map(photo => resolvePostImage(photo, theme.value.photoImageBase, site.value.base)))
const title = computed(() => frontmatter.value.title || page.value.title)
const author = computed(() => {
  const value = frontmatter.value.author || theme.value.author
  return typeof value === 'string' ? value : value?.name
})
const date = computed(() => {
  const value = frontmatter.value.date
  return String(value instanceof Date ? value.toISOString() : value ?? '').slice(0, 10)
})
const tags = computed(() => [frontmatter.value.tags ?? []].flat().filter(Boolean))
</script>

<template>
  <main class="red-post" :class="{ 'with-photos': photos.length }" data-pagefind-body>
    <RedPhotoGallery v-if="photos.length" :key="route.path" :photos="photos" :title="title" />

    <article class="red-post-copy">
      <header>
        <div class="red-post-byline">
          <span v-if="author" class="red-post-author">{{ author }}</span>
          <time v-if="date" :datetime="date">{{ date }}</time>
        </div>
        <h1>{{ title }}</h1>
      </header>

      <div class="vp-doc red-post-body"><Content /></div>

      <ul v-if="tags.length" class="red-post-tags" aria-label="标签">
        <li v-for="tag in tags" :key="tag">#{{ tag }}</li>
      </ul>

      <section v-if="frontmatter.comment !== false && theme.comment?.provider === 'giscus'" class="red-post-comments" aria-label="评论" data-pagefind-ignore>
        <TkCommentGiscus :key="route.path" />
      </section>
    </article>
  </main>
</template>

<style scoped>
.red-post {
  margin: 20px auto 48px;
  width: min(680px, calc(100% - 24px));
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: var(--vp-c-bg);
  box-shadow: 0 12px 48px rgb(78 66 95 / 10%);
  overflow: clip;
}
.red-post-copy { min-width: 0; padding: clamp(18px, 4vw, 46px); overflow-wrap: anywhere; }
.red-post-byline { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 13px; color: var(--vp-c-text-2); }
.red-post-author { font-weight: 650; color: var(--vp-c-text-1); }
.red-post h1 { margin: 12px 0 16px; font-weight: 750; font-size: clamp(25px, 3vw, 39px); line-height: 1.22; text-wrap: balance; }
.red-post-body :deep(> div > :first-child) { margin-top: 0; }
.red-post-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 0; }
.red-post-tags li { border-radius: 999px; padding: 3px 11px; background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); font-size: 13px; }
.red-post-comments { border-top: 1px solid var(--vp-c-divider); margin-top: 26px; padding-top: 20px; }

@media (min-width: 960px) {
  .red-post { margin-top: 28px; }
  .red-post.with-photos {
    margin-top: 28px;
    width: min(1180px, calc(100% - 64px));
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  }
}
</style>

<script setup lang="ts" name="FrontmatterPanel">
import { ref, useId, watch } from 'vue'
const props = defineProps<{
  frontmatter: Record<string, any>
  labels?: Partial<Record<'title' | 'date' | 'categories' | 'tags' | 'permalink' | 'description', string>>
  placeholders?: Partial<Record<'title' | 'categories' | 'tags' | 'permalink' | 'description', string>>
}>()

const emit = defineEmits<{
  'update:frontmatter': [value: Record<string, any>]
}>()

const categoriesInput = ref('')
const tagsInput = ref('')
const titleFieldId = useId()

watch(() => props.frontmatter.categories, value => {
  categoriesInput.value = Array.isArray(value) ? value.join(', ') : value || ''
}, { immediate: true })
watch(() => props.frontmatter.tags, value => {
  tagsInput.value = Array.isArray(value) ? value.join(', ') : value || ''
}, { immediate: true })

const defaultLabels = {
  title: '标题',
  date: '日期',
  categories: '分类',
  tags: '标签',
  permalink: '永久链接',
  description: '摘要',
}

const defaultPlaceholders = {
  title: '文章标题',
  categories: '逗号分隔多个分类',
  tags: '逗号分隔多个标签',
  permalink: '/path/to/article',
  description: '文章摘要...',
}

function label(key: keyof typeof defaultLabels): string {
  return props.labels?.[key] ?? defaultLabels[key]
}

function placeholder(key: keyof typeof defaultPlaceholders): string {
  return props.placeholders?.[key] ?? defaultPlaceholders[key]
}

function setField(key: string, value: any) {
  emit('update:frontmatter', { ...props.frontmatter, [key]: value })
}

function setArrayField(key: string, value: string) {
  const arr = value.split(',').map(s => s.trim()).filter(Boolean)
  emit('update:frontmatter', { ...props.frontmatter, [key]: arr })
}

</script>

<template>
  <div class="fm-panel">
    <div class="fm-fields">
      <div class="fm-row">
        <label class="fm-label" :for="titleFieldId">{{ label('title') }}</label>
        <input
          :id="titleFieldId"
          class="fm-input"
          :value="frontmatter.title || ''"
          @input="setField('title', ($event.target as HTMLInputElement).value)"
          :placeholder="placeholder('title')"
        />
      </div>

      <div class="fm-row">
        <label class="fm-label">{{ label('date') }}</label>
        <input
          class="fm-input"
          type="datetime-local"
          :value="frontmatter.date || ''"
          @input="setField('date', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="fm-row">
        <label class="fm-label">{{ label('categories') }}</label>
        <input
          class="fm-input"
          v-model="categoriesInput"
          @change="setArrayField('categories', categoriesInput)"
          :placeholder="placeholder('categories')"
        />
      </div>

      <div class="fm-row">
        <label class="fm-label">{{ label('tags') }}</label>
        <input
          class="fm-input"
          v-model="tagsInput"
          @change="setArrayField('tags', tagsInput)"
          :placeholder="placeholder('tags')"
        />
      </div>

      <div class="fm-row">
        <label class="fm-label">{{ label('permalink') }}</label>
        <input
          class="fm-input"
          :value="frontmatter.permalink || ''"
          @input="setField('permalink', ($event.target as HTMLInputElement).value)"
          :placeholder="placeholder('permalink')"
        />
      </div>

      <div class="fm-row">
        <label class="fm-label">{{ label('description') }}</label>
        <textarea
          class="fm-textarea"
          :value="frontmatter.description || ''"
          @input="setField('description', ($event.target as HTMLTextAreaElement).value)"
          :placeholder="placeholder('description')"
          rows="2"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.fm-fields {
  display: grid;
  gap: 12px;
  margin-top: 10px;
  padding: 16px;
  border: 1px solid var(--mde-divider);
  border-radius: 16px;
  background: color-mix(in srgb, var(--mde-bg-soft) 85%, transparent);
  backdrop-filter: blur(12px);
}

.fm-row { min-width: 0; }

.fm-label {
  display: block;
  font-size: 12px;
  color: var(--mde-text-2);
  margin-bottom: 3px;
}

.fm-input,
.fm-textarea {
  width: 100%;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid var(--mde-divider);
  border-radius: 9px;
  background: var(--mde-bg);
  color: var(--mde-text-1);
  font-size: 16px;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}

.fm-input:focus,
.fm-textarea:focus {
  border-color: var(--mde-brand);
}

.fm-textarea {
  resize: vertical;
}

@media (min-width: 640px) {
  .fm-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fm-row:last-child { grid-column: 1 / -1; }
}
</style>

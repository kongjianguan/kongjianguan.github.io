<script setup lang="ts" name="FrontmatterPanel">
const props = defineProps<{
  frontmatter: Record<string, any>
  labels?: Partial<Record<'toggle' | 'title' | 'date' | 'categories' | 'tags' | 'permalink' | 'description', string>>
  placeholders?: Partial<Record<'title' | 'categories' | 'tags' | 'permalink' | 'description', string>>
}>()

const emit = defineEmits<{
  'update:frontmatter': [value: Record<string, any>]
}>()

const collapsed = defineModel<boolean>('collapsed', { default: false })

const defaultLabels = {
  toggle: '文章属性',
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

function getArrayValue(key: string): string {
  const val = props.frontmatter[key]
  if (Array.isArray(val)) return val.join(', ')
  return val || ''
}
</script>

<template>
  <div class="fm-panel" :class="{ collapsed }">
    <button class="fm-toggle" @click="collapsed = !collapsed">
      <span class="fm-toggle-icon">{{ collapsed ? '>' : 'v' }}</span>
      {{ label('toggle') }}
    </button>

    <div v-show="!collapsed" class="fm-fields">
      <div class="fm-row">
        <label class="fm-label">{{ label('title') }}</label>
        <input
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
          :value="getArrayValue('categories')"
          @input="setArrayField('categories', ($event.target as HTMLInputElement).value)"
          :placeholder="placeholder('categories')"
        />
      </div>

      <div class="fm-row">
        <label class="fm-label">{{ label('tags') }}</label>
        <input
          class="fm-input"
          :value="getArrayValue('tags')"
          @input="setArrayField('tags', ($event.target as HTMLInputElement).value)"
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
.fm-panel {
  border: 1px solid var(--mde-divider);
  border-radius: 8px;
  margin-bottom: 12px;
  background: var(--mde-bg-soft);
  overflow: hidden;
}

.fm-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  color: var(--mde-text-2);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.fm-toggle:hover {
  background: var(--mde-bg-mute);
}

.fm-toggle-icon {
  font-size: 10px;
  width: 12px;
  text-align: center;
}

.fm-fields {
  padding: 0 12px 12px;
}

.fm-row {
  margin-bottom: 8px;
}

.fm-label {
  display: block;
  font-size: 12px;
  color: var(--mde-text-3);
  margin-bottom: 3px;
}

.fm-input,
.fm-textarea {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--mde-divider);
  border-radius: 4px;
  background: var(--mde-bg);
  color: var(--mde-text-1);
  font-size: 13px;
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

@media (max-width: 767px) {
  .fm-row {
    margin-bottom: 6px;
  }
}
</style>

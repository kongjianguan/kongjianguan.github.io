<script setup lang="ts" name="TeekLayoutProvider">
import Teek from "vitepress-theme-teek";
import ContributeChart from "./ContributeChart.vue";
import NotFound from "./404.vue";
import ArticleContent from "./ArticleContent.vue";
import LoginButton from "./LoginButton.vue";
import NewArticleDialog from "./NewArticleDialog.vue";

import { computed, ref, onMounted } from 'vue';
import { useData, withBase } from 'vitepress';
import { useGitHubAuth } from '../composables/useGitHubAuth';
import { useEditorEntry } from '../composables/useEditorEntry';

const showNewDialog = ref(false);
const { page } = useData();
const { isLoggedIn } = useGitHubAuth();
const { editRequested, requestEdit, requestReadMode } = useEditorEntry();
const hasEditablePage = computed(() => Boolean(page.value.relativePath));
const editButtonTitle = computed(() => {
  if (!isLoggedIn.value) return '登录 GitHub 后可编辑文章';
  if (!hasEditablePage.value) return '当前页面不可编辑';
  return editRequested.value ? '阅读模式' : '编辑文章';
});

function handleEditModeToggle() {
  if (editRequested.value) {
    requestReadMode();
    return;
  }
  requestEdit();
}

onMounted(async () => {
  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has('edit')) {
    currentUrl.searchParams.delete('edit');
    window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
  }

  const { pathname, search } = window.location;
  const callbackParams = new URLSearchParams(search)
  if (pathname === '/__auth/callback' && (callbackParams.get('code') || callbackParams.get('error'))) {
    const { handleCallback } = useGitHubAuth();
    try {
      await handleCallback();
    } catch (e) {
      console.error('OAuth callback error:', e);
    }
    return;
  }

  const { loadOml2d } = await import('oh-my-live2d');
  loadOml2d({
    dockedPosition: 'left',
    primaryColor: '#A0C6F9', // 模型的主色调，默认为粉色
    mobileDisplay: false, // 是否在移动设备上显示模型，默认为 false
    models: [
      {
        path: withBase('/anon_037_live_default/model.json'),
      },
      {
        path: withBase('/rem/model.json'),
      },
    ],

    menus: {
      disable: false, // 禁用右键菜单
    },

    tips: {
      copyTips: { // 复制提示文本
        message: ['你复制了什么内容呢?记得注明出处哦~']
      },
      style: {
        zIndex: 9999, // 层级最高，确保文字在画布之上
        top: 'auto', // 覆盖默认 top:0，避免气泡在舞台内与模型重叠
        bottom: 'calc(100%)', // 气泡底部对齐舞台上边缘
        // transform: 'translateX(-50%)' // 水平居中
      },
    }

  });
});

function handleNewArticle(payload: { path: string; title: string; template: string }) {
  if (!isLoggedIn.value) {
    alert('请先登录 GitHub')
    return
  }

  const path = payload.path.startsWith('docs/') ? payload.path : `docs/${payload.path}`
  sessionStorage.setItem('pending_new_article', JSON.stringify({ ...payload, path }))

  const url = new URL(window.location.href)
  url.pathname = withBase('/')
  url.search = '?new=true'
  url.hash = ''
  window.location.assign(url.pathname + url.search)
}

</script>

<template>
  <Teek.Layout>
    <template #nav-bar-content-after>
      <button
        class="nav-action-btn edit-article-btn"
        :class="{ active: editRequested }"
        :disabled="!isLoggedIn || !hasEditablePage"
        :title="editButtonTitle"
        :aria-label="editRequested ? '阅读模式' : '编辑文章'"
        :aria-pressed="editRequested"
        @click="handleEditModeToggle"
      >
        <svg v-if="editRequested" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>
        </svg>
      </button>
      <LoginButton />
      <button class="nav-action-btn new-article-btn" @click="showNewDialog = true" title="新建文章" aria-label="新建文章">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </template>

    <template #home-hero-before>
      <ArticleContent />
    </template>

    <template #doc-before>
      <ArticleContent />
    </template>

    <template #teek-archives-top-before>
      <ContributeChart />
    </template>

    <template #not-found>
      <NotFound />
    </template>

  </Teek.Layout>

  <NewArticleDialog v-model:visible="showNewDialog" @create="handleNewArticle" />
</template>

<style lang="scss">
.tk-my.is-circle-bg {
  margin-bottom: 20px;

  .tk-my__avatar.circle-rotate {
    margin-top: 200px;
  }
}

.nav-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  margin: 0 2px;
  line-height: var(--vp-nav-height);
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s, opacity 0.2s;
}

.nav-action-btn:hover:not(:disabled),
.nav-action-btn.active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
}

.nav-action-btn:disabled,
.nav-action-btn:disabled:hover {
  color: var(--vp-c-text-3);
  background: none;
  cursor: default;
  opacity: 0.55;
  pointer-events: none;
}
</style>

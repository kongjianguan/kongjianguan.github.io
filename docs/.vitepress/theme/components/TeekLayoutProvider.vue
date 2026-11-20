<script setup lang="ts" name="TeekLayoutProvider">
import Teek from "vitepress-theme-teek";
import NotFound from "./404.vue";
import ArticleContent from "./ArticleContent.vue";
import LoginButton from "./LoginButton.vue";

import { computed, defineAsyncComponent, ref, onMounted } from 'vue';
import { useData, useRoute, withBase } from 'vitepress';
import { useGitHubAuth } from '../composables/useGitHubAuth';
import { useEditorEntry } from '../composables/useEditorEntry';
import { useLive2D } from '../composables/useLive2D';
import { isRedPost } from '../redPost';

const ContributeChart = defineAsyncComponent(() => import('./ContributeChart.vue'));
const NewArticleDialog = defineAsyncComponent(() => import('./NewArticleDialog.vue'));

const showNewDialog = ref(false);
const { page, frontmatter } = useData();
const isPhotoPage = computed(() => isRedPost(frontmatter.value));
const route = useRoute();
const { isLoggedIn } = useGitHubAuth();
const { editRequested, requestEdit, requestReadMode } = useEditorEntry();
const callbackStatus = ref<'loading' | 'error'>('loading');
const callbackError = ref<string>('');
const isHomePage = computed(() => frontmatter.value.layout === 'home' || page.value.relativePath === 'index.md');
const isAuthCallback = computed(() => route.path === '/__auth/callback');
const hasEditablePage = computed(() => Boolean(page.value.relativePath) && !isHomePage.value && !isAuthCallback.value);
useLive2D(() => !isAuthCallback.value);
const editButtonTitle = computed(() => editRequested.value ? '阅读模式' : '编辑文章');

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

  if (isAuthCallback.value) {
    const { handleCallback } = useGitHubAuth();
    try {
      const result = await handleCallback();
      if (!result.ok && !result.isPopup) {
        callbackStatus.value = 'error';
        callbackError.value = result.error || 'GitHub 登录失败';
      }
    } catch (e) {
      console.error('OAuth callback error:', e);
      callbackStatus.value = 'error';
      callbackError.value = e instanceof Error ? e.message : 'GitHub 登录遇到异常';
    }
    return;
  }

  // 非弹窗模式下登录失败跳回原页面后，消费并提示错误
  const { consumeAuthError } = useGitHubAuth();
  const authErr = consumeAuthError();
  if (authErr) {
    alert(authErr);
  }
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
  <div v-if="isAuthCallback" class="oauth-callback-page">
    <div v-if="callbackStatus === 'loading'" class="callback-card">
      <div class="callback-spinner"></div>
      <p>正在完成 GitHub 登录……</p>
    </div>
    <div v-else class="callback-card is-error">
      <p class="error-msg">{{ callbackError || '登录遇到问题' }}</p>
      <div class="error-actions">
        <a href="/" class="callback-btn">返回首页</a>
      </div>
    </div>
  </div>

  <Teek.Layout v-else>
    <template #nav-bar-content-after>
      <div class="nav-editor-actions">
        <button
          v-if="isLoggedIn && hasEditablePage"
          class="nav-action-btn edit-article-btn"
          :class="{ active: editRequested }"
          :title="editButtonTitle"
          :aria-label="editButtonTitle"
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
        <LoginButton>
          <template #menu>
            <button class="user-menu-item nav-mobile-create" @click="showNewDialog = true">
              新建文章
            </button>
          </template>
        </LoginButton>
        <button v-if="isLoggedIn" class="nav-action-btn new-article-btn" @click="showNewDialog = true" title="新建文章" aria-label="新建文章">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </template>

    <template #home-hero-before>
      <ArticleContent standalone-only />
    </template>

    <template #doc-before>
      <ArticleContent v-if="hasEditablePage" />
    </template>

    <template #layout-top>
      <div v-if="isPhotoPage && hasEditablePage" class="red-post-editor">
        <ArticleContent />
      </div>
    </template>

    <template #teek-archives-top-before>
      <ContributeChart />
    </template>

    <template #not-found>
      <NotFound />
    </template>

  </Teek.Layout>

  <NewArticleDialog v-if="showNewDialog && isLoggedIn" @update:visible="showNewDialog = $event" @create="handleNewArticle" />
</template>

<style lang="scss">
.red-post-editor {
  width: min(880px, calc(100% - 32px));
  margin-inline: auto;
}

.red-post-editor:not(:has(.editor-controls)) {
  display: none;
}

.red-post-editor:has(.editor-controls) {
  padding-top: var(--vp-nav-height);
}

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
  flex-shrink: 0;
}

.nav-editor-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.VPNavBar .VPNavBarExtra,
.VPNavBar .VPNavBarSocialLinks {
  margin-right: 0;
}

.nav-mobile-create {
  display: none;
}

@media (max-width: 767px) {
  .VPNavBar .wrapper {
    padding-right: 12px;
    padding-left: 12px;
  }

  .VPNavBar .container > .title {
    flex: 1;
    min-width: 0;
  }

  .VPNavBarTitle,
  .VPNavBarTitle .title > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .VPNavBar .content {
    flex: 0 0 auto;
    min-width: 0;
  }

  .VPNavBar .content-body {
    column-gap: 0;
  }

  .nav-action-btn {
    width: 44px;
    height: 44px;
    margin: 0;
  }

  .new-article-btn {
    display: none;
  }

  .nav-mobile-create {
    display: flex;
  }
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

.oauth-callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.callback-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.callback-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: callback-spin 0.8s linear infinite;
}

@keyframes callback-spin {
  to {
    transform: rotate(360deg);
  }
}

.error-msg {
  color: var(--vp-c-danger-1, #e03131);
  font-size: 15px;
  margin: 0;
}

.callback-btn {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 14px;
  background: var(--vp-c-brand-1);
  color: #fff !important;
  text-decoration: none;
  transition: opacity 0.2s;
}

.callback-btn:hover {
  opacity: 0.85;
}
</style>

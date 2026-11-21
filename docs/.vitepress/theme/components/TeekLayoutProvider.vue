<script setup lang="ts" name="TeekLayoutProvider">
import Teek from "vitepress-theme-teek";
import NotFound from "./404.vue";
import ArticleContent from "./ArticleContent.vue";
import LoginButton from "./LoginButton.vue";

import { computed, defineAsyncComponent, ref, onMounted } from 'vue';
import { useData, withBase } from 'vitepress';
import { useGitHubAuth } from '../composables/useGitHubAuth';
import { useEditorEntry } from '../composables/useEditorEntry';
import { useLive2D } from '../composables/useLive2D';
import { isRedPost } from '../redPost';

const ContributeChart = defineAsyncComponent(() => import('./ContributeChart.vue'));
const NewArticleDialog = defineAsyncComponent(() => import('./NewArticleDialog.vue'));

const showNewDialog = ref(false);
const { page, frontmatter } = useData();
const isPhotoPage = computed(() => isRedPost(frontmatter.value));
const { isLoggedIn } = useGitHubAuth();
const { editRequested, requestEdit, requestReadMode } = useEditorEntry();
const isHomePage = computed(() => frontmatter.value.layout === 'home' || page.value.relativePath === 'index.md');
const hasEditablePage = computed(() => Boolean(page.value.relativePath) && !isHomePage.value);
useLive2D(() => true);
const editButtonTitle = computed(() => editRequested.value ? '阅读模式' : '编辑文章');

function handleEditModeToggle() {
  if (editRequested.value) {
    requestReadMode();
    return;
  }
  requestEdit();
}

function closeNavScreen(event: MouseEvent) {
  const action = event.currentTarget as HTMLButtonElement;
  action.closest('.VPNav')?.querySelector<HTMLButtonElement>('[aria-controls="VPNavScreen"][aria-expanded="true"]')?.click();
}

function handleNavScreenEdit(event: MouseEvent) {
  closeNavScreen(event);
  handleEditModeToggle();
}

function handleNavScreenCreate(event: MouseEvent) {
  closeNavScreen(event);
  showNewDialog.value = true;
}

onMounted(async () => {
  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has('edit')) {
    currentUrl.searchParams.delete('edit');
    window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
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
  <Teek.Layout>
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

    <template #nav-screen-content-after>
      <div v-if="isLoggedIn" class="nav-screen-editor-actions">
        <button
          v-if="hasEditablePage"
          type="button"
          class="nav-screen-action-btn"
          :aria-pressed="editRequested"
          @click="handleNavScreenEdit"
        >
          <svg v-if="editRequested" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>
          </svg>
          <span>{{ editButtonTitle }}</span>
        </button>
        <button type="button" class="nav-screen-action-btn" @click="handleNavScreenCreate">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>新建文章</span>
        </button>
      </div>
    </template>

    <template #home-hero-before>
      <ArticleContent standalone-only />
    </template>

    <template #doc-before>
      <ArticleContent v-if="hasEditablePage && !isPhotoPage" />
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
html.is-editing-mode,
:root:has(.blog-editor) {
  .VPDoc .content-container > .main,
  .VPDoc .aside,
  .VPDocFooter,
  .VPDoc .doc-after,
  .tk-comment,
  .teek-comment {
    display: none !important;
  }
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
    padding-right: 8px !important;
    padding-left: 10px !important;
  }

  .VPNavBar .container > .title {
    flex: 0 1 auto;
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
    column-gap: 2px !important;
  }

  .VPNavBarHamburger {
    width: 36px !important;
    height: 36px !important;
    margin: 0 !important;
    flex-shrink: 0;
  }

  .VPNavBar .blog-search {
    padding-left: 0 !important;
    margin: 0 !important;
  }

  .VPNavBar .blog-search > .nav-search-btn-wait {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px !important;
    height: 36px !important;
    padding: 0 !important;
  }

  .nav-action-btn {
    width: 34px;
    height: 34px;
    margin: 0 1px;
    border-radius: 6px;
  }

  .nav-editor-actions {
    gap: 2px;
  }

  .nav-mobile-create {
    display: flex;
  }

  .nav-screen-editor-actions {
    display: grid;
    gap: 4px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--vp-c-divider);
  }

  .nav-screen-action-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1);
    font-size: 14px;
    text-align: left;
  }

  .nav-screen-action-btn:hover,
  .nav-screen-action-btn:focus-visible,
  .nav-screen-action-btn[aria-pressed="true"] {
    color: var(--vp-c-brand-1);
  }
}

@media (min-width: 768px) and (max-width: 959px) {
  .VPNavBar .blog-search {
    max-width: 220px;
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

</style>

<script setup lang="ts" name="TeekLayoutProvider">
import Teek from "vitepress-theme-teek";
import ContributeChart from "./ContributeChart.vue";
import NotFound from "./404.vue";
import ArticleContent from "./ArticleContent.vue";
import LoginButton from "./LoginButton.vue";
import NewArticleDialog from "./NewArticleDialog.vue";

import { ref, onMounted } from 'vue';
import { withBase } from 'vitepress';

const showNewDialog = ref(false);

onMounted(async () => {
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

</script>

<template>
  <Teek.Layout>
    <template #nav-bar-content-after>
      <LoginButton />
      <button class="new-article-btn" @click="showNewDialog = true" title="新建文章">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
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

  <NewArticleDialog v-model:visible="showNewDialog" />
</template>

<style lang="scss">
.tk-my.is-circle-bg {
  margin-bottom: 20px;

  .tk-my__avatar.circle-rotate {
    margin-top: 200px;
  }
}

.new-article-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  line-height: var(--vp-nav-height);
  font-size: 14px;
  font-weight: 500;
  border: none;
  background: none;
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: color 0.25s;
}

.new-article-btn:hover {
  color: var(--vp-c-brand-1);
}
</style>

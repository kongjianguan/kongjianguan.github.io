<script setup lang="ts" name="TeekLayoutProvider">
import Teek from "vitepress-theme-teek";
import ContributeChart from "./ContributeChart.vue";
import NotFound from "./404.vue";

// 看板娘配置
import { onMounted } from 'vue';
onMounted(async () => {
  const { loadOml2d } = await import('oh-my-live2d');
  loadOml2d({
    dockedPosition: 'left',
    primaryColor: '#A0C6F9', // 模型的主色调，默认为粉色
    mobileDisplay: false, // 是否在移动设备上显示模型，默认为 false
    models: [
      {
        path: '/rem/model.json',
      },
      {
        path: '/cat-black/model.json',
      },
    ],

    menus: {
      disable: false, // 禁用右键菜单
    },

    tips: {
      copyTips: { // 复制提示文本
        message: ['你复制了什么内容呢?记得注明出处哦~']
      },
    }

  });
});

</script>

<template>
  <Teek.Layout>
    <template #teek-archives-top-before>
      <ContributeChart />
    </template>

    <template #not-found>
      <NotFound />
    </template>

  </Teek.Layout>
</template>

<style lang="scss">
.tk-my.is-circle-bg {
  margin-bottom: 20px;

  .tk-my__avatar.circle-rotate {
    margin-top: 200px;
  }
}
</style>

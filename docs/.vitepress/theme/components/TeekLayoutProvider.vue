<script setup lang="ts" name="TeekLayoutProvider">
import Teek from "vitepress-theme-teek";
import ContributeChart from "./ContributeChart.vue";
import NotFound from "./404.vue";

// 看板娘配置
import { onMounted } from 'vue';
import { withBase } from 'vitepress';
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

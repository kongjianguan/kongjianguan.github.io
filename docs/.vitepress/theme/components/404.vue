
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vitepress";

const router = useRouter();
const goHome = () => router.go("/");

const count = ref(0);
const target = 404;

onMounted(() => {
  // 禁用整个页面滚动（404 页在视图内全屏展示）
  const html = document.documentElement;
  const body = document.body;
  const prevHtmlOverflow = html.style.overflow;
  const prevBodyOverflow = body.style.overflow;
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";

  const duration = 2000;
  const startTime = performance.now();

  const step = (now: number) => {
    const progress = Math.min((now - startTime) / duration, 1);
    count.value = Math.floor(target * progress);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);

  onBeforeUnmount(() => {
    html.style.overflow = prevHtmlOverflow;
    body.style.overflow = prevBodyOverflow;
  });
});
</script>

<template>
  <div class="error-page-2">
    <div class="container">
      <div class="row">
        <div class="xs-12 md-6 mx-auto">
          <div id="countUp">
            <div class="number">{{ count }}</div>
            <div class="text">页面未找到</div>
            <div class="text">请检查路径是否正确，或返回首页</div>
            <button class="home-btn" @click="goHome">返回首页</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.error-page-2 {
  position: fixed;
  top: var(--vp-nav-height);
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  display: flex;
  align-items: stretch;
  background-image: url("https://image.peterjxl.com/blog/andy-holmes-698828-unsplash.jpg");
  background-size: cover;
  background-repeat: no-repeat;
  color: rgba(255, 255, 255, 0.87);
  overflow: hidden;
}

.number{
  font-family: Consolas;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.container,
.container > .row,
.container > .row > div {
  height: 100%;
}

.container {
  width: 100%;
}

.row {
  display: flex;
  justify-content: center;
}

#countUp {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
}

#countUp .number {
  font-size: 4rem;
  font-weight: 500;
  margin-bottom: 2rem;
}

#countUp .text {
  font-weight: 300;
  text-align: center;
  margin-top: 0.8rem;
}

.home-btn {
  margin-top: 2rem;
  padding: 0.5rem 1.5rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.home-btn:hover {
  background-color: rgba(255, 255, 255, 0.35);
}
</style>


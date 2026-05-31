// .vitepress/theme/index.ts
import Teek from "vitepress-theme-teek";
import type { Theme } from 'vitepress';

// 引入样式
import "./style/index.scss";  // 自定义的全局样式
import "vitepress-theme-teek/index.css";
import "vitepress-theme-teek/theme-chalk/tk-nav-blur.css";          // 导航栏毛玻璃
import "vitepress-theme-teek/theme-chalk/tk-mark.css";        // <mark></mark> 样式
import "vitepress-theme-teek/theme-chalk/tk-blockquote.css";  // > 引用块样式
import "vitepress-theme-teek/theme-chalk/tk-aside.css";       // 右侧目录栏文字悬停和激活样式
import "vitepress-theme-teek/theme-chalk/tk-doc-fade-in.css"; // 文章页淡入效果
import "vitepress-theme-teek/theme-chalk/tk-nav-translation.css"; // 导航栏深色、浅色模式切换按钮样式

// 自定义组件，例如 404，贡献日历
import TeekLayoutProvider from "./components/TeekLayoutProvider.vue";

// mermaid 插件
import { initComponent } from 'vitepress-plugin-legend/component';

export default {
  extends: Teek,
  enhanceApp({ app }) {
    initComponent(app);
  },
  Layout: TeekLayoutProvider
} satisfies Theme;
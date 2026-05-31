//  社交图标，显示于博主信息栏和页脚栏  参考 https://vp.teek.top/guide/icon-use.html#社交图标-iconfont
import { github, bilibili } from "../theme/icon/icons";
import type { Social } from "vitepress-theme-teek/config";

export const SocialLinks: Social[] = [
  {
    name: "GitHub",
    icon: github,
    iconType: "component",
    link: "https://github.com/kongjianguan",
  },
  {
    name: "B站",
    icon: bilibili,
    iconType: "component",
    link: "https://space.bilibili.com/", // TODO: 替换为你的 B站空间 UID 链接
  },
];

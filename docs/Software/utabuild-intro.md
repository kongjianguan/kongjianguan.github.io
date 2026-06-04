---
title: UtaBuild - 给日语歌词标上注音
date: 2026-06-04 00:00:00
permalink: /Software
categories:
  - 软件
tags:
  - 项目
  - 工具
  - 学习
  - 娱乐
  - 日语
feed:
  enable: true
description: 一个日语歌词注音软件
---
# UtaBuild
## 做了一个小工具

一个鸽了很久的项目，终于给我肝出来了。

喜欢听ACG歌曲的人应该都知道[UtaTen](https://utaten.com)，这个网站提供大量歌曲的注音，以Ruby形式呈现。
## 起因
网站本身似乎只有一个在日本的服务器，但在国内访问速度不慢。但实际上，网站自带的各种广告在国内加载速度很慢，也就导致了整体的页面加载速度很慢。研究了一下这个网站后
，决定做一个工具来方便地获取歌词注音
## 过程
最初UtaBuild选择用Rust+Slint来做，因为没怎么了解过Rust的GUI框架，问Gemini后了解到Slint是跨平台跨框架，于是就选了Slint，然后捣鼓半天最终还是发现互操作逻辑有点复杂，Slint在Android上也是有一些不足，最终决定转向前端(js还是爽)技术栈，也就是Tauri。后面用Claude Code+DeepSeek捣鼓出了UtaBuild。最初只是一个UtaTen Wraper，后面借鉴[LDDC](https://github.com/chenmozhijin/LDDC)和[Lyrico](https://github.com/Replica0110/Lyrico)，支持了QQ和网易云的API(因为太懒所以写了几个测试样例后就让DeepSeek把解析器给搓出来了)。

用的是 Rust + Tauri 写的，所以打包出来体积不大。有两种使用方式：

- **CLI 命令行**：适合命令行操作和自动化，无状态适合Agent交互，搜索结果和歌词都以 JSON 格式输出
- **桌面 GUI**：后端还是CLI，支持Android和Windows(理论上也支持Mac OS和Linux)，搜歌、看歌词、调字号都有，内置一套缓存系统

下面是《春日影》的歌词效果，每个汉字上面会自动标注读音：

<div style="display: flex; gap: 16px;">
  <img src="/images/blog-attachment/歌词界面.jpg" alt="歌词界面" style="width: 49%;" />
  <img src="/images/blog-attachment/保存歌曲界面.jpg" alt="保存歌曲界面" style="width: 49%;" />
</div>
<br>
<div style="display: flex; gap: 16px;">
  <img src="/images/blog-attachment/搜索界面.jpg" alt="搜索界面" style="width: 49%;" />
  <img src="/images/blog-attachment/搜索结果界面.jpg" alt="搜索结果界面" style="width: 49%;" />
</div>

学日语的朋友应该能感受到这个有多方便。不用再去一个个查汉字读音了，整首歌的注音一目了然。不过本项目更面向于那些想唱歌却记不住这么多汉字的发音的人。(去K歌必备)

项目还在继续完善中。后面想加上歌词导出、通过LSPosed Hook和本地音乐播放器联动之类的功能。有兴趣的朋友可以去 GitHub 看看。

仓库地址：[github.com/kongjianguan/UtaBuild](https://github.com/kongjianguan/UtaBuild)

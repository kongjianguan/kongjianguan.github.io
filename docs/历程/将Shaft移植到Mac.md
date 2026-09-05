---
title: 把Shaft移植到Mac
date: 2026-07-06 22:14:00
categories:
  - 历程
tags:
  - 
feed:
  enable: true
description: 为什么，以及怎么做
---
## 起因
每天要往返在训练室和宿舍间，背着个大砖头太累了，所以买了MacBook Air。自此我就几乎只使用MacBook Air来干活了，无论是训练还是写一些小项目。我也热衷于把平时或者以前用到的软件移植到Mac上，比如Shaft。
## 什么是 Shaft
Shaft是一个第三方Pixiv Android客户端，没有使用UI框架，纯粹的传统原生安卓UI。因此移植到Mac上我选择了Compose Desktop。为什么会想到Compose Desktop呢？这是因为Salt Player(一个本地优先的音乐播放器，UI设计和功能都非常棒)的桌面端也是用Compose Desktop写的，所以我自然而然就想到了。这是Java生态的UI框架，对我来说还是十分陌生的（其实可以说完全没摸过），因此我是全权交给GLM5.2来设计移植方案，规划路线。我只负责打开应用测试，指出一些我比较熟悉的问题，然后顺手改一些比较浅显的bug。至于OAUTH，还有UI什么的，完全交给了GLM5.2来设计（话说这UI不就是material吗），最终执行的则是DeepSeek V4 Flash。
## 思考
说实话，我已经不是第一次体验到Agentic Coding的这种威力了，但是这样的交付质量，在国产模型上我确实是第一次遇到，这标志着我们的模型不仅仅是在跑分上好看，更通过后训练在交付质量上发力。希望我毕业时，国模能做到与Claude和GPT旗鼓相当甚至超越吧。
---
title: 使用Cloudflare建立静态站点
date: 2026-06-02 20:00:00
categories:
  - 教程
tags:
  - 工具配置
  - 教程
feed:
  enable: true
description: 使用 Cloudflare + Vercel 托管静态站点的完整过程
---

起因是发现GitHub Pages访问不太稳定，于是想借助cloudflare来托管。在网上找了很多教程，但都太老了，cloudflare的页面已经大不同了。迷了几次路后终于建好了。直接记录过程。
# 一、Cloudflare部署
## 登录
这个就不多讲了
## 打开Home页面
![cloudflare边栏页面](/images/blog-attachment/cloudflare边栏页面.png)
## 点击Add
![](/images/blog-attachment/cloudflare-Add.png)
这上面的*Connent a domain*就是绑定域名，*Pages*就是部署静态页面。
点击*Pages*，选择*Import an existing Git repository*，需要添加GitHub账户并选择一个仓库
## 配置build & deployment选项
我使用的是*vitepress*，没什么特别就直接如下
![](/images/blog-attachment/cloudflare建站选项.png)
接着*Save and Deploy*即可

不过实测cloudflare在国内的速度跟GitHub直连也是半斤半两，甚至大部分时候GitHub直连要更快。
所以我先后选择了使用*CDN*以及*Vercel*。CDN先后选择了jsdeliver和jsdmirror(还有一个ghproxy没用过)。jsdmirror最快。后面我选择Vercel，vercel的免费额度似乎是每月100G流量，足够我使用了，但有一个致命的缺点，vercel的默认域名vercel.app被DNS污染了，于是必须要买一个域名，也就是[我现在的域名](kongjianguan.pyi)。

# 二、获取域名并配置DNS

## 购买域名
国内的云服务器厂商（阿里云、腾讯云等）都有域名注册服务，不过一般需要实名和备案，我选择了 **Spaceship**，不用备案而且便宜省事。

## 将域名托管到 Cloudflare
买好域名后，回到 Cloudflare 首页，点击 **Add** 然后选择前面说到的**Connect a domain**，输入你刚买的域名。Cloudflare 会扫描现有 DNS （一般是spaceship自带的两个），然后提示你修改域名的 DNS 服务器，这一步要回到spaceship去改

```
carl.dns.cloudflare.com
zara.dns.cloudflare.com
```

修改后等待几分钟到几小时不等（实测一分钟内就搞定了）

## 添加 DNS 记录
域名托管到 Cloudflare 之后，点击Add record添加DNS记录

![](/images/blog-attachment/cloudflare-6.png)

开启代理（Proxied）后，Cloudflare 会隐藏你的真实源站 IP，还能提供 CDN 加速。

# 三、配置 Vercel 自定义域名
## 导入项目
与前面导入cloudflare如出一辙，在 Vercel 中新建项目，导入 GitHub 仓库。框架选择 VitePress，Vercel 会自动识别 build 命令和输出目录，确认无问题即可继续下一步。

## 绑定域名
项目部署成功后，进入项目设置 → **Domains**，这里会有一个默认域名，直接删掉新建。Vercel 会自动识别到这个域名正在被cloudflare代理，可以直接跳转到cloudflare修改DNS。改完后Vercel会验证 DNS 配置，验证通过后显示 **Valid** 状态即表示生效。

> 据说：Vercel 会自动申请和续期 SSL 证书，不需要自己折腾 HTTPS。

# 四、完成
等 DNS 生效、SSL 证书签发完成后，访问自己的域名就能享受秒进了。

总结一下最终方案：
- **源码托管**：GitHub
- **自动部署**：Vercel（关联 GitHub，push 自动触发）
- **域名**：Spaceship
- **DNS**：Vercel


## 参考

- [利用 Cloudflare 加速 GitHub 主页访问](https://qinyu.space/%E5%8D%9A%E5%AE%A2%E6%90%AD%E5%BB%BA/%E5%88%A9%E7%94%A8cloudflare%E5%8A%A0%E9%80%9Fgithub%E4%B8%BB%E9%A1%B5%E8%AE%BF%E9%97%AE/)
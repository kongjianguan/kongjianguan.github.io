// 主题配置文件，会被 ./config.mts 引用
import { defineTeekConfig } from "vitepress-theme-teek/config";
import { SocialLinks } from "./config/SocialLinks"; //导入社交链接配置
import { Imgs } from "./config/BackgroundImg";
import { vitepressPluginLegend } from 'vitepress-plugin-legend';

export const teekConfig = defineTeekConfig({

  teekTheme: true,          // 启用 teek 主题
  loading: "正在开门...", // Loading 动画，可直接配置 Loading 文案.为 false 则关闭
  pageStyle: "segment-nav",          // 文章页的样式风格 default, card, segment, card-nav, segment-nav
  homeCardListPosition: "left", // 首页卡片栏列表位置

  
  articleAnalyze: {
    imageViewer: {
      enabled: false, // 禁用图片查看器
    },
  },
  
  // 首页 Banner 配置
  banner: {
    enabled: true, // 是否启用 Banner
    name: "kongjianguan的日记", // Banner 标题，默认读取 vitepress 的 title 属性
    textColor: "#ffffff", // Banner 字体颜色，bgStyle 为 pure 时为 '#000000'，其他为 '#ffffff'
    titleFontSize: "3.2rem", // 标题字体大小
    descFontSize: "1.4rem", // 描述字体大小
    descStyle: "switch", // 描述信息风格：default 为纯文字渲染风格（如果 description 为数组，则取第一个），types 为文字打印风格，switch 为文字切换风格
    description: [
      "一生バンドしてくれる？-「迷途之子」",
      "为世界上一切美好而战！-「崩坏3rd」",
      "Get it pulverized - 「Interstellar Journey」"
      ], // 描述信息
    switchTime: 6000, // 描述信息切换间隔时间，单位：毫秒。descStyle 为 switch 时生效
    switchShuffle: true, // 描述信息是否随机切换，为 false 时按顺序切换。descStyle 为 switch 时生效
  },

  // 文章列表配置 https://vp.teek.top/reference/post-config.html#post
  post: {
    postStyle: "list", // 文章列表风格
    excerptPosition: "top", // 文章摘要位置
    showMore: true, // 是否显示更多按钮
    moreLabel: "阅读全文 >", // 更多按钮文字
    emptyLabel: "暂无文章", // 文章列表为空时的标签
    coverImgMode: "full", // 文章封面图模式
    showCapture: false, // 是否在摘要位置显示文章部分文字，当为 true 且不使用 frontmatter.describe 和 <!-- more --> 时，会自动截取前 300 个字符作为摘要
    splitSeparator: false, // 文章信息（作者、创建时间、分类、标签等信息）是否添加 | 分隔符
    transition: true, // 是否开启过渡动画
    transitionName: "tk-slide-fade", // 自定义过渡动画名称
    listStyleTitleTagPosition: "right", // 列表模式下的标题标签位置（postStyle 为 list）
    cardStyleTitleTagPosition: "left", // 卡片模式下的标题标签位置（postStyle 为 card）
    defaultCoverImg: Imgs, // 默认封面图地址，如果不设置封面图则使用默认封面图地址
  },

  // 页脚配置
  footerInfo: {
    // 博客版权配置
    copyright: {
      show: false, // 是否显示博客版权
      createYear: 2026, // 创建年份
      suffix: "kongjianguan", // 后缀
    },
  },

  // 标签卡片配置
  tag: {
    enabled: false
  },

  // 分类卡片配置
  category: {
    enabled: false
  },

    // 博主信息，显示在首页左边第一个卡片
  blogger: {
    name: "kongjianguan", // 博主昵称
    slogan: "学生, 编程爱好者, 爱看动漫和ACG Live, 有点弱鸡但正在努力中的的ACMer", // 博主签名
    avatar: "https://cdn.jsdmirror.com/gh/kongjianguan/images/avatar.jpg", // 博主头像（GitHub头像）
    shape: "circle", // 头像风格
    circleSize: 100, // 头像大小
    color: "#ffffff", // 字体颜色
  },

  social: SocialLinks,   // 社交图标，显示于博主信息栏和页脚栏。参考 https://vp.teek.top/guide/icon-use.html#社交图标-iconfont
  
  // 背景图配置，将整个网站的背景色改为图片
  bodyBgImg: {
    
    imgSrc: Imgs, // 背景图地址，支持单张或多张（数组形式）
    imgOpacity: 1, // 背景图透明度，选值 0.1 ~ 1.0
    imgInterval: 30000, //  当有多张背景图时（imgSrc 为数组），设置切换时间，单位：毫秒
    imgShuffle: true, // 是否随机切换
    mask: true // 背景图遮罩
  },   

  // 精选文章卡片配置
  topArticle: {
    enabled: true, // 是否启用精选文章卡片
    limit: 5, // 一页显示的数量
    autoPage: false, // 是否自动翻页
    dateFormat: "yyyy-MM-dd hh:mm:ss", // 精选文章的日期格式
  },

  // 友情链接卡片配置
  friendLink: {
    enabled: false, // 暂时关闭友情链接
    list: [],
  },

  // 右下角回到顶部配置
  backTop: {
    enabled: true, // 是否启动回到顶部功能
    content: "icon", // 回到顶部按钮的显示内容，可选配置 progress | icon
    done: TkMessage => TkMessage.success("返回顶部成功"), // 回到顶部后的回调
  },

  // 滚动到评论区配置
  toComment: {
    enabled: true, // 是否启动滚动到评论区功能
    done: TkMessage => TkMessage.success("滚动到评论区成功"), // 滚动到评论区后的回调
  },

  // 代码块配置
  codeBlock: {
    enabled: true, // 是否启用新版代码块
    collapseHeight: 700, // 超出高度后自动折叠，设置 true 则默认折叠，false 则默认不折叠
    overlay: true, // 代码块底部是否显示展开/折叠遮罩层
    overlayHeight: 400, // 当出现遮罩层时，指定代码块显示高度，当 overlay 为 true 时生效
    langTextTransform: "uppercase", // 语言文本显示样式，为 text-transform 的值:none, capitalize, lowercase, uppercase
    copiedDone: TkMessage => TkMessage.success("复制成功！"), // 复制代码完成后的回调
  },

  // 文章默认的作者信息
  author: {
    name: "kongjianguan",
  },

  // 站点信息卡片配置
  docAnalysis: {
    enabled: true, // 是否启用站点信息卡片
    createTime: "2026-05-30", // 站点创建时间
    wordCount: true, // 是否开启文章页的字数统计
    readingTime: false, // 是否开启文章页的阅读时长统计
    // 访问量、访客数统计配置
    statistics: {
      provider: "vercount", // 网站流量统计提供商
      siteView: true, // 是否开启首页的访问量和排名统计
      pageView: true, // 是否开启文章页的浏览量统计
      tryRequest: false, // 如果请求网站流量统计接口失败，是否重试
      tryCount: 5, // 重试次数，仅当 tryRequest 为 true 时有效
      tryIterationTime: 2000, // 重试间隔时间，单位：毫秒，仅当 tryRequest 为 true 时有效
      permalink: true, // 是否只统计永久链接的浏览量，如果为 false，则统计 VitePress 默认的文档目录链接
    },
    // 自定义现有信息
    overrideInfo: [
      {
        key: "lastActiveTime",
        label: "活跃时间",
        value: (_, currentValue) => (currentValue + "").replace("前", ""),
        show: true,
      },
    ],
  },

  // 赞赏功能配置 https://vp.teek.top/reference/article-config.html#appreciation
  // appreciation: {
  //   enabled: false,
  // },

  // 文章分享配置
  articleShare: {
    enabled: true, // 是否开启文章链接分享功能
    text: "分享此页面", // 分享按钮文本
    copiedText: "链接已复制", // 复制成功文本
    query: false, // 是否包含查询参数
    hash: false, // 是否包含哈希值
  },

  // 评论配置，内置 Giscus、Twikoo、Waline、Artalk 四种评论插件
  comment: {
    provider: "giscus",
    options: {
      repo: "kongjianguan/kongjianguan.github.io", // 博客仓库
      repoId: "R_kgDOSs5JFQ",
      category: "Announcements",
      categoryId: "DIC_kwDOSs5JFc4C-WK_",
      mapping: "pathname",
    },
  },

  // 内置 Vite 插件配置
  vitePlugins: {
    sidebarOption: {
      resolveRule: "rewrites", // 可选 rewrites, filePath 详见 https://vp.teek.top/guide/permalink.html
      collapsed: true, // 开启侧边栏折叠功能。true 默认折叠，false 默认不折叠
    },
  },

  // markdown.plugins, 加载第三方 Markdown-it 插件
  markdown: {
    config: md => {
      vitepressPluginLegend(md);  // 渲染 mermaid
    },
  }

});

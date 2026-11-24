// HTML head 标签信息
export const HeadData = [
  // CDN 预连接，降低首屏图床建连延迟
  ['link', { rel: 'dns-prefetch', href: 'https://cdn.jsdmirror.com' }],
  ['link', { rel: 'preconnect', href: 'https://cdn.jsdmirror.com', crossorigin: '' }],

  // 图标
  ['link', { rel: 'icon', href: 'https://cdn.jsdmirror.com/gh/kongjianguan/images/avatar.jpg' }],

  // 浏览器控制台输出
  [
    'script', {}, `
        console.info('%ckongjianguan', 'color: #007acc; font-size: 24px; font-weight: bold;');
      `
  ],
];

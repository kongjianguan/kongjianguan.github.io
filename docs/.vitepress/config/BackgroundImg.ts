// 博客背景图地址列表，也是默认封面图地址列表，导出给 teekConfig.ts 使用
// 设置 LOCALIMGSRC=1 则使用本地路径，否则使用 JSDMirror CDN

const imgBase = process.env.LOCALIMGSRC === '1' ? '/images' : 'https://cdn.jsdmirror.com/gh/kongjianguan/images';

export const OldImgs: Array<string> = [
  // `${imgBase}/129487999_p0.jpg`, // 菲比
  `${imgBase}/133464975_p0.jpg`, // 大昔涟
  `${imgBase}/X@226083260Bubai-20260513.jpg`, // 荧妹
  `${imgBase}/144852565.jpg`, // 绯英
  `${imgBase}/X@ZZZZZMjiangzz-20260513.jpg`, // 绯英
  `${imgBase}/X@FMakrZHnl46IP8D-20260513.jpg`, // 绯英
  `${imgBase}/X@yutttang-20260513.jpg`, // 绯英
  `${imgBase}/X@BUM_HICO_20260423.jpg`,  // 银狼
  `${imgBase}/144130853_p0.jpg`,  // 银狼
  `${imgBase}/143933879_p0.jpg`, // 银狼
  // `${imgBase}/144370432_p0.jpg`, //爱弥斯 漂泊者 合照
  // `${imgBase}/X@ddengart-2019818370867294543.jpg`,   // 爱弥斯
  // `${imgBase}/X@vvsimyeol-1874745010434068680.jpg`,  // 珂莱塔
  `${imgBase}/142653295_p0.jpg`, // 绝区零 妄想天使
  `${imgBase}/142097456_p0.jpg`, // 绝区零 妄想天使
  // `${imgBase}/140937524_p0.jpg`, // 鸣潮 爱弥斯
  // `${imgBase}/120189621_p0.jpg`, // 鸣潮 长离
  // `${imgBase}/142598882_p0.jpg`, // 鸣潮 西格莉卡
  `${imgBase}/120717943_p0.jpg`, // 绝区零 鲨鱼
  `${imgBase}/142788495_p0.jpg`, // 宇宙
  `${imgBase}/140381254_p0.jpg`, // 哥伦比娅
  `${imgBase}/129010553_p0.jpg`, // 遐蝶
  `${imgBase}/137205050_p0.jpg`, // 昔涟
  `${imgBase}/137094784_p0.jpg`, // 三月七组合
  `${imgBase}/142207274_p0.jpg`, // 火花
  `${imgBase}/141913369_p0.jpg`, // 花火火花
  `${imgBase}/134420820_p0.jpg`, // 流萤
  // `${imgBase}/142094263_p0.jpg`, // Fate
  `${imgBase}/2026-3-12-20.jpg`, // 绝区零 妄想天使
  `${imgBase}/2026-3-12-7.jpg`,  // 绝区零 妄想天使
  `${imgBase}/2026-02-23.jpg`,   // 绝区零 妄想天使
  `${imgBase}/140830123_p0.jpg`, // 绝区零 妄想天使
  `${imgBase}/142223607_p1.jpg`, // 初音
  `${imgBase}/142223607_p3.jpg`, // 初音
  `${imgBase}/141743180_p0.jpg`, // 初音
  `${imgBase}/96189957_p0.jpg`,  // 神子
  `${imgBase}/127166786_p0.jpg`, // 神子 瑞希
  `${imgBase}/128019376_p0.jpg`, // 鸣神 八条
  `${imgBase}/134732001_p0.jpg`, // 死之执政


  // `${imgBase}/142052076_p0.jpg`, // 爱弥斯
  // `${imgBase}/142210069_p0.jpg`, // 爱弥斯
  // `${imgBase}/140831812_p0.jpg`, // 鸣潮 爱弥斯
  `${imgBase}/140161372_p0.jpg`, // 原神群星 哥伦比娅
  `${imgBase}/141274290_p0.jpg`, // 哥伦比娅 & 桑多涅
  `${imgBase}/141050669_p0.jpg`, // 哥伦比娅
  `${imgBase}/140002549_p1.jpg`, // 哥伦比娅
  `${imgBase}/139811173_p0.jpg`, // 哥伦比娅
  `${imgBase}/138613692_p0.jpg`, // 哥伦比娅
  `${imgBase}/140014451_p0.jpg`, // 哥伦比娅
  `${imgBase}/139980512_p0.jpg`, // 哥伦比娅 雅珂达 派蒙

  // 原神
  // `${imgBase}/134.jpg`,          // 胡桃（原CDN不存在此文件）
  `${imgBase}/125077204_p0.jpg`, // 胡桃
  `${imgBase}/122658264_p0.jpg`, // 胡桃 & 芙芙 
  `${imgBase}/138439477_p0.jpg`, // 芙芙 
  `${imgBase}/136656625_p0.jpg`, // 芙芙
  `${imgBase}/102890180_p1.png`, // 莱依拉
  `${imgBase}/138422625_p0.jpg`, // 奈芙尔 原神 雅珂达 
  `${imgBase}/104486407_p0.jpg`, // 雷电将军
  `${imgBase}/131754182_p0.jpg`, // 丝柯克
  `${imgBase}/2026-02-04.jpg`,   // 兹白

  // 崩坏 3
  `${imgBase}/Elysia.jpg`,       // 爱莉
  `${imgBase}/100649660_p1.png`, // 爱莉
  `${imgBase}/124205470_p0.jpg`, // 爱莉
  `${imgBase}/101693777_p0.jpg`, // 爱莉
  `${imgBase}/134156383_p0.jpg`, // 爱莉
  `${imgBase}/140659332_p0.jpg`, // 爱莉希雅
  `${imgBase}/137445639_p0.jpg`, // 爱丽希雅 崩铁
  `${imgBase}/2024-6-2-9.png`,   // 松雀
  `${imgBase}/2024-11-10-12.png`,// 松雀
  `${imgBase}/2024-4-8-2.png`,   // 松雀和瑟莉姆
  `${imgBase}/2024-10-12.png`,   // 薇塔
  `${imgBase}/2024-09-26-3.png`, // 薇塔和花火
  `${imgBase}/2024-11-10-4.png`, // 薇塔和花火
  `${imgBase}/2024-11-10-6.png`, // 薇塔和花火
  `${imgBase}/2024-10-12-4.jpg`, // 格蕾修

  // 绝区零
  `${imgBase}/122710477_p0.jpg`,  // 妮可 & 鲨鱼妹
  `${imgBase}/X@rina_0A-2024-7-6.jpg`, // 妮可 超市
  `${imgBase}/121269323_p0.jpg`,  // 鲨鱼妹
  `${imgBase}/123353563_p0.png`,  // 柏妮思


  // 鸣潮
  // `${imgBase}/2025-6-12.jpg`,    // 卡提希娅 飘然远去的长梦-画师：撸卜
  // `${imgBase}/131473201_p0.jpg`, // 卡提希娅
  // `${imgBase}/2025-08-29.jpg`,   // 今汐
  // `${imgBase}/121206620_p1.png`, // 长离
  // `${imgBase}/120767239_p0.png`, // 长离
  // `${imgBase}/119879001_p0.png`, // 吟霖
  // `${imgBase}/125117828_p0.jpg`, // 吟霖
  // `${imgBase}/125670168_p0.jpg`, // 吟霖
  // `${imgBase}/134417892_p0.jpg`, // 奥古斯塔
  // `${imgBase}/134440043_p0.jpg`, // 奥古斯塔
  // `${imgBase}/134452846_p0.jpg`, // 奥古斯塔
  // `${imgBase}/2025-09-02.jpg`,   // 奥古斯塔
  // `${imgBase}/139955382_p0.jpg`, // 奥古斯塔
  // `${imgBase}/139955461_p0.jpg`, // 奥古斯塔
  // `${imgBase}/2025-04-07.jpg`,   // 坎特蕾拉
  // `${imgBase}/2025-3-23.jpg`,    // 坎特蕾拉
  // `${imgBase}/137499724_p0.jpg`, // 赞妮
  // `${imgBase}/139754531_p0.jpg`, // 琳奈
  // `${imgBase}/2025-12-25-2.jpg`, // 琳奈
  // `${imgBase}/2025-12-25-1.jpg`, // 琳奈

  // 星穹铁道    
  `${imgBase}/2025-05-04.jpg`,   // 遐蝶
  `${imgBase}/2025-02-07.jpg`,   // 遐蝶
  `${imgBase}/128181590_p0.jpg`, // 遐蝶
  `${imgBase}/128063483_p0.jpg`, // 遐蝶
  `${imgBase}/130724632_p2.jpg`, // 风堇
  `${imgBase}/121642710_p1.png`, // 云璃
  `${imgBase}/2025-12-31.jpg`,   // 流萤
  `${imgBase}/119791514_p0.jpg`, // 流萤
  `${imgBase}/116629910_p0.jpg`, // 流萤
  `${imgBase}/2025-09-05.jpg`,   // 海瑟音
  `${imgBase}/121154474_p11.jpg`,// Kafka
  `${imgBase}/111072628_p0.png`, // Kafka
  `${imgBase}/109349799_p0.jpg`, // Kafka      
  `${imgBase}/116526272_p0.jpg`, // 花火
  `${imgBase}/117466601_p0.png`, // 黄泉、花火
  `${imgBase}/139436858_p0.jpg`, // 花火
  `${imgBase}/124529422_p0.png`, // 三月七，星
  `${imgBase}/2025-10-17.jpg`,   // 三月七
  `${imgBase}/2025-09-30.jpg`,   // 长夜月
  `${imgBase}/2024-12-26-4.jpg`, // 知更鸟
  `${imgBase}/125643183_p0.png`, // 停云
  `${imgBase}/126508781_p0.jpg`, // 大黑塔
  `${imgBase}/2025-02-07-6.jpg`, // 大黑塔
  `${imgBase}/126424846_p0.jpg`, // 大黑塔
  `${imgBase}/129916649_p0.jpg`, // 缇宝
  `${imgBase}/131998699_p0.jpg`, // 缇宝

  // 日常
  // `${imgBase}/backgruond-city.jpg`,

  // re: zero
  `${imgBase}/re-background.jpg`,
  `${imgBase}/Emilia.jpg`,
  `${imgBase}/Emilia-2.jpg`,

  // Miku
  `${imgBase}/120586024_p0.png`,
  `${imgBase}/114179851_p0.jpg`,
  `${imgBase}/120814179_p0.jpg`,

  // 孤独摇滚
  `${imgBase}/112280380_p0.png`,
  `${imgBase}/103907445_p0.png`,
  `${imgBase}/109565821_p0.png`,

  // 二次元
  // `${imgBase}/180.jpg`,          // 下拉裙摆（原CDN不存在此文件）
  // `${imgBase}/4.2b.png`,         // 尼尔·机械纪元（原CDN不存在此文件）
  `${imgBase}/116406855_p0.png`, // 莉可莉丝
  `${imgBase}/2020-04-03_16-23-36.png`, // 鬼灭之刃
  `${imgBase}/114613535_p0.png`, // 葬送的芙莉莲
  `${imgBase}/76601747_p1.jpg`,  // 国家队
  `${imgBase}/62494753_p0.jpg`,  // 埃罗芒
  `${imgBase}/Mikasa.jpg`,       // 三笠
  `${imgBase}/saber.jpg`,        // fate
  `${imgBase}/123800363_p0.jpg`, // 夏日重现
  `${imgBase}/gojo-eyes-jujutsu-kaisen-hd-wallpaper-uhdpaper.com-208@2@a.jpg`, // 五条悟
  `${imgBase}/135718569_p0.jpg`, // 蕾塞

  // 冰菓
  `${imgBase}/690112.jpg`,
  `${imgBase}/bingguo.jpg`,

  `${imgBase}/MEME-Kaofish.jpg`, // 烤鱼
]
export const Imgs:Array<string> = [
  // 某科学的超电磁炮
  `${imgBase}/99605266.png`, // 四人组
  `${imgBase}/109932844.png`, // 蜂琴黑三人喝茶
  `${imgBase}/美琴微笑回首_Real-ESRGANv3-anime_0720_185651.png`,
]
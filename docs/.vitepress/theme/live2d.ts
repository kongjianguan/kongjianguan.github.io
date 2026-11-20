import { loadOml2d } from 'oh-my-live2d'
import { withBase } from 'vitepress'

export function loadLive2D() {
  return loadOml2d({
    dockedPosition: 'left',
    primaryColor: '#A0C6F9',
    mobileDisplay: true,
    models: [
      { path: withBase('/anon_037_live_default/model.json') },
    ],
    menus: {
      disable: false,
      items: items => items.map(item =>
        ['About', 'SwitchModel', 'SwitchModelClothes'].includes(item.id)
          ? { id: item.id, icon: item.icon, title: item.title }
          : item,
      ),
    },
    tips: {
      copyTips: { message: ['你复制了什么内容呢?记得注明出处哦~'] },
      style: {
        zIndex: 9999,
        top: 'auto',
        bottom: 'calc(100%)',
      },
    },
  })
}

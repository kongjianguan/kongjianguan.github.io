import { EditorSelection, type StateCommand } from '@codemirror/state'

/*
 * 空标记行上按一次回车就结束这个块。
 * CodeMirror 自带的 insertNewlineContinueMarkup 在空列表项上会先转成松散列表，
 * 在空引用行上要求连续两行为空才退出，因此需要按两次回车，并多留一个空行。
 */

/* 行内容只由列表标记或引用标记与空白组成时视为空标记行 */
const EMPTY_BLOCK = /^(\s*)(?:[-*+]|\d+[.)]|>)\s*$/

export const exitEmptyBlock: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main
  if (!range.empty) return false

  const line = state.doc.lineAt(range.from)
  if (!EMPTY_BLOCK.test(line.text)) return false

  // 清掉标记本身，光标留在这一行，这个块到此结束
  dispatch(state.update({
    changes: { from: line.from, to: line.to, insert: '' },
    selection: EditorSelection.cursor(line.from),
    scrollIntoView: true,
    userEvent: 'input',
  }))
  return true
}

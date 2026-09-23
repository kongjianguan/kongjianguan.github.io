import { EditorSelection, type StateCommand } from '@codemirror/state'

/*
 * 空列表项上按回车退出列表。
 * CodeMirror 自带的 insertNewlineContinueMarkup 会把空条目转成松散列表，
 * 于是要在同一个空条目上按两次回车才能退出，并多留一个空行。
 */

/* 行内容只由列表标记与空白组成时视为空条目 */
const EMPTY_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s*$/

export const exitEmptyListItem: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main
  if (!range.empty) return false

  const line = state.doc.lineAt(range.from)
  if (!EMPTY_ITEM.test(line.text)) return false

  // 清掉标记本身，光标留在这一行，列表到此结束
  dispatch(state.update({
    changes: { from: line.from, to: line.to, insert: '' },
    selection: EditorSelection.cursor(line.from),
    scrollIntoView: true,
    userEvent: 'input',
  }))
  return true
}

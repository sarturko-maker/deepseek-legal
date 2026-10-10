/** Typed copy for the native legal editor. */
export const NS = 'legalEditor'
/** English dictionary and key owner. */
export const en = {
  open: 'Open for redlining', title: 'Contract editor', loading: 'Opening contract editor…',
  failed: 'The editor could not open. Start the legal editor container, then retry.',
  retry: 'Retry', save: 'Save', close: 'Save and close', saving: 'Saving…', saved: 'Saved',
  saveFailed: 'Save was not confirmed. Keep the editor open and try again.',
  expired: 'Editor access expired. Reopen the saved working copy.',
  source: 'Working copy — original preserved',
  manual: 'Save before closing this tab. Close the editor before asking the agent to amend this contract.',
  missing: 'Open a DOCX preview and choose Open for redlining.',
  openFailed: 'The contract could not open. Check its path, filesystem permissions and whether this Session already owns another contract.',
}
/** Keys accepted by the legal editor copy namespace. */
export type LegalEditorKey = keyof typeof en
/** Chinese counterpart with the same key set. */
export const zh: Record<LegalEditorKey, string> = {
  open: '打开合同修订', title: '合同编辑器', loading: '正在打开合同编辑器…',
  failed: '无法打开编辑器。请启动合同编辑器容器后重试。', retry: '重试',
  save: '保存', close: '保存并关闭', saving: '正在保存…', saved: '已保存',
  saveFailed: '未确认保存成功。请保持编辑器打开并重试。',
  expired: '编辑器访问已过期。请重新打开已保存的工作副本。',
  source: '工作副本 — 原件已保留',
  manual: '关闭此标签页前请保存。让智能体修订合同前请关闭编辑器。',
  missing: '请打开 DOCX 预览并选择“打开合同修订”。',
  openFailed: '无法打开合同。请检查路径和文件权限，并确认本会话没有其他合同。',
}

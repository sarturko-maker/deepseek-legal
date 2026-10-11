/** Native sidebar title using the existing Word document icon. */
import type { ReactNode } from 'react'
import { FileTypeIcon } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from './locales.ts'
import css from './editor-pane.module.css'
import { editorFilename } from './editor-label.ts'

/**
 * @param props Normal sidebar tab hook and legal editor dictionary.
 * @returns Word icon, filename and localized working-copy label.
 */
export function EditorTitle(props: PropsRuntime<'sidebar.right.pane.tab.title'> & PropsLocale<typeof NS>): ReactNode {
  const params = props.useTabInfo().tab.navigation.params
  const filename = editorFilename(params !== undefined && 'path' in params ? params.path : undefined) || props.t('title')
  return <><FileTypeIcon kind="word" size={16} className={css.titleIcon} />
    <span className={css.tabTitle} title={`${filename} · ${props.t('workingCopy')}`}>
      {filename} · {props.t('workingCopy')}
    </span></>
}

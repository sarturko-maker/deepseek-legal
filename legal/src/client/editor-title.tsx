/** Native sidebar title using the existing Word document icon. */
import type { ReactNode } from 'react'
import { FileTypeIcon } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from './locales.ts'
import css from './editor-pane.module.css'

/**
 * @param props Normal sidebar tab hook and legal editor dictionary.
 * @returns Word icon and localized editor title.
 */
export function EditorTitle(props: PropsRuntime<'sidebar.right.pane.tab.title'> & PropsLocale<typeof NS>): ReactNode {
  return <><FileTypeIcon kind="word" size={16} className={css.titleIcon} />{props.t('title')}</>
}

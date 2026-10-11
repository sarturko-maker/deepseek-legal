/** Browser-side display name for a source selected through the preview. */

/**
 * @param path Windows or POSIX source path from the tab's navigation.
 * @returns The final nonempty filename, or an empty string for absent navigation.
 */
export function editorFilename(path: string | undefined): string {
  return path?.split(/[\\/]/u).filter(Boolean).at(-1) ?? ''
}

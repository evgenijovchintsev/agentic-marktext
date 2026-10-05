import { useAgentStore } from '@/store/agent'
import { useEditorStore } from '@/store/editor'
import { useProjectStore } from '@/store/project'

/**
 * Directory a new shell starts in.
 *
 * An opened folder wins, so `git init` lands on the folder the window owns.
 * A saved file with no folder uses that file's directory. A repository root
 * is only a fallback for a window that already resolved one.
 */
export const terminalDirectory = (): string => {
  const folder = useProjectStore().projectTree?.pathname
  if (folder) return folder
  const file = useEditorStore().currentFile?.pathname
  if (file) return window.path.dirname(file)
  const repo = useAgentStore().repoState
  return repo.kind === 'repo' ? repo.root : ''
}

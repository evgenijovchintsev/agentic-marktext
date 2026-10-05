import fs from 'node:fs'
import path from 'node:path'

/**
 * Working directory for a new shell.
 *
 * The window's opened folder always wins. Otherwise the renderer may name
 * the directory of the open file, and that path has to exist: a shell is
 * not started in a missing or non-directory path.
 */
export const resolveTerminalCwd = (openedFolder: string | null, requested: unknown): string | null => {
  if (openedFolder) return openedFolder
  if (typeof requested !== 'string' || requested.trim().length === 0) return null
  const dir = path.resolve(requested)
  try {
    if (!fs.statSync(dir).isDirectory()) return null
  } catch {
    return null
  }
  return dir
}

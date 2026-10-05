import os from 'os'
import path from 'path'
import fs from 'fs'
import { afterEach, describe, expect, it } from 'vitest'
import { PtyManager, PtyManagerError } from 'main_renderer/agent/terminal/ptyManager'

const windowId = 33
const dirs: string[] = []
const managers: PtyManager[] = []

afterEach(async() => {
  for (const manager of managers.splice(0)) await manager.disposeWindow(windowId)
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-pty-'))
  dirs.push(dir)
  return dir
}

const waitFor = async(ready: () => boolean, label: string): Promise<void> => {
  const started = Date.now()
  while (!ready()) {
    if (Date.now() - started > 5_000) throw new Error(label)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const open = (): { manager: PtyManager, output: string[], exits: { termId: string, code: number | null }[] } => {
  const output: string[] = []
  const exits: { termId: string, code: number | null }[] = []
  const manager = new PtyManager({
    shellPreference: () => '',
    newId: () => 'term-1',
    onData: (_windowId, _termId, data) => {
      output.push(data)
    },
    onExit: (_windowId, termId, code) => {
      exits.push({ termId, code })
    }
  })
  managers.push(manager)
  return { manager, output, exits }
}

describe('ptyManager', () => {
  it('rejects create when the window has no directory', () => {
    const manager = new PtyManager({
      shellPreference: () => '',
      newId: () => 'term-1',
      onData: () => undefined,
      onExit: () => undefined
    })
    expect(() => manager.create(windowId, { cols: 80, rows: 24, cwd: '  ' })).toThrow(PtyManagerError)
  })

  it('prints its working directory, accepts a resize, and exits when killed', async() => {
    const root = tempDir()
    const { manager, output, exits } = open()
    const created = manager.create(windowId, { cols: 80, rows: 24, cwd: root })
    expect(created.termId).toBe('term-1')
    expect(created.shell.includes('/') || created.shell.includes('\\')).toBe(false)

    const command = process.platform === 'win32' ? 'echo $PWD\r' : 'echo $PWD\n'
    manager.input(windowId, created.termId, command)
    await waitFor(() => {
      const text = output.join('')
      return process.platform === 'win32'
        ? text.toLowerCase().includes(root.toLowerCase())
        : text.includes(root)
    }, 'the shell did not print its working directory')

    expect(() => manager.resize(windowId, created.termId, 100, 40)).not.toThrow()
    manager.kill(windowId, created.termId)
    await waitFor(() => exits.some((event) => event.termId === created.termId), 'the pty did not exit')
  })
})

import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveTerminalCwd } from 'main_renderer/agent/terminal/terminalCwd'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('resolveTerminalCwd', () => {
  it('uses the opened folder even when the renderer names another directory', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-cwd-'))
    dirs.push(folder)
    expect(resolveTerminalCwd(folder, os.tmpdir())).toBe(folder)
  })

  it('accepts an existing directory when no folder is open', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-cwd-'))
    dirs.push(folder)
    expect(resolveTerminalCwd(null, folder)).toBe(path.resolve(folder))
  })

  it('rejects a missing path and a file', () => {
    expect(resolveTerminalCwd(null, path.join(os.tmpdir(), 'mt-cwd-missing'))).toBeNull()
    const file = path.join(os.tmpdir(), `mt-cwd-file-${process.pid}`)
    fs.writeFileSync(file, '')
    dirs.push(file)
    expect(resolveTerminalCwd(null, file)).toBeNull()
    expect(resolveTerminalCwd(null, '   ')).toBeNull()
  })
})

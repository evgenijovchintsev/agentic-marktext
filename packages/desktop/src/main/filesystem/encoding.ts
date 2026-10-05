import { createRequire } from 'node:module'
import log from 'electron-log'
import type { Encoding } from 'common/encoding'

type CedDetect = (buffer: Buffer) => string

const require = createRequire(import.meta.url)
let cedDetect: CedDetect | null | undefined

// A Windows package built on Linux still contains the host `ced.node`.
// Loading that ELF aborts the main process ("not a valid Win32 application"),
// so a failed load falls back to UTF-8 instead of crashing.
const loadCed = (): CedDetect | null => {
  if (cedDetect !== undefined) return cedDetect
  try {
    cedDetect = require('ced') as CedDetect
  } catch (error) {
    cedDetect = null
    log.error('ced encoding detector is unavailable:', error)
  }
  return cedDetect
}

const CED_ICONV_ENCODINGS: Record<string, string> = {
  'BIG5-CP950': 'big5',
  KSC: 'euckr',
  'ISO-2022-KR': 'euckr',
  GB: 'gb2312',
  ISO_2022_CN: 'gb2312',

  Unicode: 'utf8',

  // Map ASCII / subsets of UTF-8 to UTF-8.
  JIS: 'utf8',
  SJS: 'utf8',
  shiftjis: 'utf8',
  'ASCII-7-bit': 'utf8',
  ASCII: 'utf8',
  MACINTOSH: 'utf8'
}

// Byte Order Marks to detect endianness and encoding.
const BOM_ENCODINGS: Record<string, number[]> = {
  utf8: [0xef, 0xbb, 0xbf],
  utf16be: [0xfe, 0xff],
  utf16le: [0xff, 0xfe]
}

const checkSequence = (buffer: Buffer, sequence: number[]): boolean => {
  if (buffer.length < sequence.length) {
    return false
  }
  return sequence.every((v, i) => v === buffer[i])
}

// `ced` occasionally misdetects a valid UTF-8 file as a legacy double-byte
// encoding (notably GBK), mojibaking multi-byte text — e.g. Greek µ/κ/α become
// CJK 碌/魏/伪 (#3151). A NUL byte signals binary / BOM-less UTF-16, not a UTF-8
// text file.
const isLikelyUtf8 = (buffer: Buffer): boolean => {
  if (buffer.includes(0)) {
    return false
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return true
  } catch {
    return false
  }
}

/**
 * Guess the encoding from the buffer.
 */
export const guessEncoding = (buffer: Buffer, autoGuessEncoding: boolean): Encoding => {
  const isBom = false
  let encoding = 'utf8'

  // Detect UTF8- and UTF16-BOM encodings.
  for (const [key, value] of Object.entries(BOM_ENCODINGS)) {
    if (checkSequence(buffer, value)) {
      return { encoding: key, isBom: true }
    }
  }

  // Auto guess encoding, otherwise use UTF-8.
  if (autoGuessEncoding) {
    // A file that is already valid UTF-8 must be decoded as UTF-8, regardless
    // of what `ced` heuristically guesses (#3151).
    if (isLikelyUtf8(buffer)) {
      return { encoding: 'utf8', isBom }
    }
    const detect = loadCed()
    if (!detect) return { encoding: 'utf8', isBom }
    encoding = detect(buffer)
    if (CED_ICONV_ENCODINGS[encoding]) {
      encoding = CED_ICONV_ENCODINGS[encoding]
    } else {
      encoding = encoding.toLowerCase().replace(/-_/g, '')
    }
  }
  return { encoding, isBom }
}

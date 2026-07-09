import type { ParsedFile, ConfigSetting, ConfigSection, ConfigFileType } from '../types'

function humanizeKey(key: string): string {
  return key
    .replace(/^_+/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Index of the first '#' that sits outside any quoted string, or -1. */
export function findCommentStart(s: string): number {
  let inStr: '"' | "'" | null = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (c === '\\' && inStr === '"') { i++; continue }
      if (c === inStr) inStr = null
    } else if (c === '"' || c === "'") {
      inStr = c
    } else if (c === '#') {
      return i
    }
  }
  return -1
}

/** Net count of '[' minus ']' outside quoted strings. */
function bracketBalance(s: string): number {
  let inStr: '"' | "'" | null = null
  let bal = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (c === '\\' && inStr === '"') { i++; continue }
      if (c === inStr) inStr = null
    } else if (c === '"' || c === "'") {
      inStr = c
    } else if (c === '[') {
      bal++
    } else if (c === ']') {
      bal--
    }
  }
  return bal
}

function parseRawValue(raw: string): Pick<ConfigSetting, 'value' | 'valueType'> {
  const t = raw.trim()
  if (t === 'true') return { value: true, valueType: 'boolean' }
  if (t === 'false') return { value: false, valueType: 'boolean' }
  if (/^-?\d+$/.test(t)) return { value: parseInt(t, 10), valueType: 'integer' }
  if (/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(t)) return { value: parseFloat(t), valueType: 'float' }
  if (t.startsWith('[')) return { value: t, valueType: 'array' }
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return { value: t.slice(1, -1), valueType: 'string' }
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return { value: t.slice(1, -1), valueType: 'string' }
  return { value: t, valueType: 'string' }
}

function extractMeta(comments: string[]): Pick<ConfigSetting, 'description' | 'defaultValue' | 'range' | 'allowedValues'> {
  const descLines: string[] = []
  let defaultValue: string | null = null
  let range: { min: number; max: number } | null = null
  let allowedValues: string[] | null = null

  for (const raw of comments) {
    const line = raw.replace(/^#+\s*/, '').trim()
    if (line === '.' || line === '') continue

    const defM = line.match(/^Default:\s*(.+)/i)
    if (defM) { defaultValue = defM[1].trim(); continue }

    const rangeM = line.match(/^Range:\s*(-?[\d.eE+]+)\s*~\s*(-?[\d.eE+]+)/i)
    if (rangeM) { range = { min: parseFloat(rangeM[1]), max: parseFloat(rangeM[2]) }; continue }

    const rangeMinM = line.match(/^Range:\s*[>=]+\s*(-?[\d.eE+]+)/i)
    if (rangeMinM) { range = { min: parseFloat(rangeMinM[1]), max: Infinity }; continue }

    const allowedM = line.match(/^(?:Allowed Values|Possible values):\s*(.+)/i)
    if (allowedM) { allowedValues = allowedM[1].split(',').map((v) => v.trim()); continue }

    // Old-Forge inline style: "Description [range: 0.0 ~ 1.0, default: 0.5]"
    const inlineRange = line.match(/\[range:\s*(-?[\d.eE+]+)\s*~\s*(-?[\d.eE+]+)/i)
    const inlineDef = line.match(/default:\s*([^\],]+)\]?\s*$/i)
    if (inlineRange || (inlineDef && /\[[^\]]*default:/i.test(line))) {
      if (inlineRange) range = { min: parseFloat(inlineRange[1]), max: parseFloat(inlineRange[2]) }
      if (inlineDef) defaultValue = inlineDef[1].trim()
      const desc = line.replace(/\[(?:range|default)[^\]]*\]/gi, '').trim()
      if (desc) descLines.push(desc)
      continue
    }

    descLines.push(line)
  }

  return { description: descLines.join(' ').trim(), defaultValue, range, allowedValues }
}

// ─── TOML ───────────────────────────────────────────────────────────────────

export function parseToml(raw: string, filePath: string): ParsedFile {
  const lines = raw.split('\n')
  const sections: ConfigSection[] = []
  let sectionPath: string[] = []
  let pending: string[] = []

  function getSection(path: string[]): ConfigSection {
    const key = path.join('\x00')
    let s = sections.find((x) => x.path.join('\x00') === key)
    if (!s) {
      s = { path, label: humanizeKey(path[path.length - 1] ?? '') || 'General', settings: [] }
      sections.push(s)
    }
    return s
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()

    if (t.startsWith('#')) { pending.push(t); continue }
    if (t === '') { pending = []; continue }

    const secM = t.match(/^\[([^\]]+)\]$/)
    if (secM) { sectionPath = secM[1].split('.'); getSection(sectionPath); pending = []; continue }

    // Bare keys may contain dashes; keys may also be quoted ("key name" = …)
    const kvM = t.match(/^(?:([\w-]+)|"([^"]+)")\s*=\s*(.*)$/)
    if (kvM) {
      const keyName = kvM[1] ?? kvM[2]
      // Strip inline comment (quote-aware) so `speed = 1.5 # note` stays a float
      let rawVal = kvM[3]
      const ci = findCommentStart(rawVal)
      if (ci !== -1) rawVal = rawVal.slice(0, ci)
      rawVal = rawVal.trim()

      // Multi-line array: consume following lines until brackets balance
      let endLine = i
      if (rawVal.startsWith('[') && bracketBalance(rawVal) > 0) {
        const parts = [rawVal]
        let bal = bracketBalance(rawVal)
        let j = i
        while (bal > 0 && j + 1 < lines.length) {
          j++
          let seg = lines[j]
          const ci2 = findCommentStart(seg)
          if (ci2 !== -1) seg = seg.slice(0, ci2)
          seg = seg.trim()
          parts.push(seg)
          bal += bracketBalance(seg)
        }
        if (bal <= 0) {
          rawVal = parts.join(' ').trim()
          endLine = j
        }
      }

      const meta = extractMeta(pending)
      const parsed = parseRawValue(rawVal)
      getSection(sectionPath).settings.push({
        key: keyName,
        label: humanizeKey(keyName),
        rawValue: rawVal,
        sectionPath: [...sectionPath],
        lineIndex: i,
        endLineIndex: endLine,
        ...meta,
        ...parsed,
      })
      pending = []
      i = endLine
    }
  }

  return { fileName: filePath.split(/[\\/]/).pop() ?? filePath, filePath, fileType: 'toml', sections, raw, modified: false }
}

// ─── .properties ────────────────────────────────────────────────────────────

export function parseProperties(raw: string, filePath: string): ParsedFile {
  const lines = raw.split('\n')
  const section: ConfigSection = { path: [], label: 'Settings', settings: [] }
  let labelOverride = ''
  let pending: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()

    if (t.startsWith('#') || t.startsWith('!')) {
      const content = t.replace(/^[#!]\s*/, '').trim()
      const bracketM = content.match(/^\[(.+)\]$/)
      if (bracketM) { labelOverride = bracketM[1]; continue }
      pending.push(t)
      continue
    }
    if (t === '') { if (!labelOverride) pending = []; continue }

    const kvM = t.match(/^([^=:]+)[=:](.*)$/)
    if (kvM) {
      const key = kvM[1].trim()
      const meta = extractMeta(pending)
      const parsed = parseRawValue(kvM[2].trim())
      section.settings.push({
        key,
        label: labelOverride || humanizeKey(key),
        rawValue: kvM[2].trim(),
        sectionPath: [],
        lineIndex: i,
        ...meta,
        ...parsed,
      })
      labelOverride = ''
      pending = []
    }
  }

  return { fileName: filePath.split(/[\\/]/).pop() ?? filePath, filePath, fileType: 'properties', sections: section.settings.length ? [section] : [], raw, modified: false }
}

// ─── .cfg / .ini ────────────────────────────────────────────────────────────

export function parseCfg(raw: string, filePath: string): ParsedFile {
  const lines = raw.split('\n')
  const sections: ConfigSection[] = []
  // INI-style [section] and old-Forge `name { … }` blocks share one section stack
  let stack: string[] = []
  let pending: string[] = []

  function getSection(path: string[]): ConfigSection {
    const key = path.join('\x00')
    let s = sections.find((x) => x.path.join('\x00') === key)
    if (!s) {
      const label = path.length ? humanizeKey(path[path.length - 1]) : 'General'
      s = { path, label, settings: [] }
      sections.push(s)
    }
    return s
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()

    if (t.startsWith('#') || t.startsWith(';') || t.startsWith('~')) { pending.push(t); continue }
    if (t === '') { pending = []; continue }

    const secM = t.match(/^\[(.+)\]$/)
    if (secM) { stack = [secM[1]]; getSection(stack); pending = []; continue }

    // Old-Forge nested block: `general {`
    const blockM = t.match(/^"?([^"{}=]+?)"?\s*\{$/)
    if (blockM) { stack = [...stack, blockM[1].trim()]; getSection(stack); pending = []; continue }
    if (t === '}') { stack = stack.slice(0, -1); pending = []; continue }

    // Old-Forge multi-line list: `S:blacklist <` … `>` — not editable, skip it
    if (/<\s*$/.test(t)) {
      while (i + 1 < lines.length && lines[i + 1].trim() !== '>') i++
      i++ // consume the closing '>'
      pending = []
      continue
    }

    const kvM = t.match(/^(?:([BIDS]):)?("?)([^="]+)\2\s*=(.*)$/)
    if (kvM) {
      const typePrefix = kvM[1] as 'B' | 'I' | 'D' | 'S' | undefined
      const keyName = kvM[3].trim()
      // Key must stay unique & serializable — keep the raw form before '='
      const key = (typePrefix ? `${typePrefix}:` : '') + keyName
      const rawVal = kvM[4].trim()
      const meta = extractMeta(pending)
      const parsed = parseRawValue(rawVal)

      // Type prefix (old Forge) is authoritative when present
      let typed: Pick<ConfigSetting, 'value' | 'valueType'> = parsed
      if (typePrefix === 'B') typed = { value: rawVal === 'true', valueType: 'boolean' }
      else if (typePrefix === 'I') typed = { value: parseInt(rawVal, 10), valueType: 'integer' }
      else if (typePrefix === 'D') typed = { value: parseFloat(rawVal), valueType: 'float' }
      else if (typePrefix === 'S') typed = { value: rawVal, valueType: 'string' }
      else {
        // 0/1 integers in CFG files are usually booleans
        const isBoolInt = parsed.valueType === 'integer' && (parsed.value === 0 || parsed.value === 1)
          && !meta.range && !meta.allowedValues
        if (isBoolInt) typed = { value: parsed.value === 1, valueType: 'boolean' }
      }

      getSection(stack).settings.push({
        key,
        label: humanizeKey(keyName),
        rawValue: rawVal,
        sectionPath: [...stack],
        lineIndex: i,
        ...meta,
        ...typed,
      })
      pending = []
    }
  }

  return { fileName: filePath.split(/[\\/]/).pop() ?? filePath, filePath, fileType: 'cfg', sections, raw, modified: false }
}

// ─── JSON ────────────────────────────────────────────────────────────────────

function parseJsonValue(val: unknown): Pick<ConfigSetting, 'value' | 'valueType' | 'rawValue'> {
  if (typeof val === 'boolean') return { value: val, valueType: 'boolean', rawValue: String(val) }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { value: val, valueType: 'integer', rawValue: String(val) }
    return { value: val, valueType: 'float', rawValue: String(val) }
  }
  if (typeof val === 'string') return { value: val, valueType: 'string', rawValue: val }
  if (Array.isArray(val)) return { value: JSON.stringify(val), valueType: 'array', rawValue: JSON.stringify(val) }
  return { value: JSON.stringify(val), valueType: 'array', rawValue: JSON.stringify(val) }
}

function jsonObjectToSettings(obj: Record<string, unknown>, sectionPath: string[]): ConfigSetting[] {
  const settings: ConfigSetting[] = []
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) continue
    settings.push({
      key,
      label: humanizeKey(key),
      ...parseJsonValue(val),
      description: '',
      defaultValue: null,
      range: null,
      allowedValues: null,
      sectionPath,
      lineIndex: -1,
    })
  }
  return settings
}

const MAX_JSON_DEPTH = 5

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function walkJson(obj: Record<string, unknown>, path: string[], sections: ConfigSection[]): void {
  const settings = jsonObjectToSettings(obj, path)
  if (settings.length > 0) {
    sections.push({
      path,
      label: path.length ? humanizeKey(path[path.length - 1]) : 'General',
      settings,
    })
  }
  if (path.length >= MAX_JSON_DEPTH) return
  for (const [key, val] of Object.entries(obj)) {
    if (isPlainObject(val)) walkJson(val, [...path, key], sections)
  }
}

export function parseJson(raw: string, filePath: string): ParsedFile {
  const sections: ConfigSection[] = []
  try {
    const data = JSON.parse(raw)
    if (isPlainObject(data)) walkJson(data, [], sections)
  } catch { /* invalid JSON */ }
  return { fileName: filePath.split(/[\\/]/).pop() ?? filePath, filePath, fileType: 'json', sections, raw, modified: false }
}

// ─── JSON5 (line-based, preserves formatting on save) ───────────────────────

/** Index of the first '//' outside quoted strings, or -1. */
export function findLineCommentStart(s: string): number {
  let inStr: '"' | "'" | null = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (c === '\\') { i++; continue }
      if (c === inStr) inStr = null
    } else if (c === '"' || c === "'") {
      inStr = c
    } else if (c === '/' && s[i + 1] === '/') {
      return i
    }
  }
  return -1
}

export function parseJson5(raw: string, filePath: string): ParsedFile {
  const lines = raw.split('\n')
  const sections: ConfigSection[] = []
  let stack: string[] = []
  let pending: string[] = []

  function getSection(path: string[]): ConfigSection {
    const key = path.join('\x00')
    let s = sections.find((x) => x.path.join('\x00') === key)
    if (!s) {
      s = { path, label: path.length ? humanizeKey(path[path.length - 1]) : 'General', settings: [] }
      sections.push(s)
    }
    return s
  }

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()

    if (t.startsWith('//')) { pending.push('#' + t.slice(2)); continue }
    if (t === '' || t === '{' || t === '/*' || t.startsWith('*')) { if (t === '') pending = []; continue }
    if (t === '}' || t === '},') { stack = stack.slice(0, -1); pending = []; continue }

    // Quoted keys may contain any chars (e.g. "minecraft:diamond"); bare keys are word-ish
    let keyName: string | null = null
    let rest = ''
    let m = t.match(/^(["'])([^"']+)\1\s*:\s*(.*)$/)
    if (m) { keyName = m[2]; rest = m[3] }
    else {
      m = t.match(/^([\w$.-]+)\s*:\s*(.*)$/)
      if (m) { keyName = m[1]; rest = m[2] }
    }
    if (keyName === null) continue

    // Nested object opens
    const restNoComment = (() => {
      const ci = findLineCommentStart(rest)
      return (ci !== -1 ? rest.slice(0, ci) : rest).trim()
    })()
    if (restNoComment === '{' ) {
      stack = [...stack, keyName]
      getSection(stack)
      pending = []
      continue
    }
    if (restNoComment.startsWith('{')) { pending = []; continue }  // inline object — not editable

    // Value (possibly a multi-line array)
    let rawVal = restNoComment
    let endLine = i
    if (rawVal.startsWith('[') && bracketBalance(rawVal) > 0) {
      const parts = [rawVal]
      let bal = bracketBalance(rawVal)
      let j = i
      while (bal > 0 && j + 1 < lines.length) {
        j++
        let seg = lines[j]
        const ci = findLineCommentStart(seg)
        if (ci !== -1) seg = seg.slice(0, ci)
        seg = seg.trim()
        parts.push(seg)
        bal += bracketBalance(seg)
      }
      if (bal <= 0) { rawVal = parts.join(' ').trim(); endLine = j }
    }
    rawVal = rawVal.replace(/,\s*$/, '').trim()

    const meta = extractMeta(pending)
    const parsed = parseRawValue(rawVal)
    getSection(stack).settings.push({
      key: keyName,
      label: humanizeKey(keyName),
      rawValue: rawVal,
      sectionPath: [...stack],
      lineIndex: i,
      endLineIndex: endLine,
      ...meta,
      ...parsed,
    })
    pending = []
    i = endLine
  }

  return { fileName: filePath.split(/[\\/]/).pop() ?? filePath, filePath, fileType: 'json5', sections, raw, modified: false }
}

// ─── dispatcher ─────────────────────────────────────────────────────────────

export function parseConfig(raw: string, filePath: string, fileType: ConfigFileType): ParsedFile {
  switch (fileType) {
    case 'toml': return parseToml(raw, filePath)
    case 'properties': return parseProperties(raw, filePath)
    case 'cfg': return parseCfg(raw, filePath)
    case 'json': return parseJson(raw, filePath)
    case 'json5': return parseJson5(raw, filePath)
    default: return parseToml(raw, filePath)
  }
}

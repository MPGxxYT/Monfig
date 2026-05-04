import type { ParsedFile, ConfigSetting, ConfigSection, ConfigFileType } from '../types'

function humanizeKey(key: string): string {
  return key
    .replace(/^_+/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseRawValue(raw: string): Pick<ConfigSetting, 'value' | 'valueType'> {
  const t = raw.trim()
  if (t === 'true') return { value: true, valueType: 'boolean' }
  if (t === 'false') return { value: false, valueType: 'boolean' }
  if (/^-?\d+$/.test(t)) return { value: parseInt(t, 10), valueType: 'integer' }
  if (/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(t)) return { value: parseFloat(t), valueType: 'float' }
  if (t.startsWith('[')) return { value: t, valueType: 'array' }
  if (t.startsWith('"') && t.endsWith('"')) return { value: t.slice(1, -1), valueType: 'string' }
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

    const kvM = t.match(/^(\w+)\s*=\s*(.*)$/)
    if (kvM) {
      const meta = extractMeta(pending)
      const parsed = parseRawValue(kvM[2])
      getSection(sectionPath).settings.push({
        key: kvM[1],
        label: humanizeKey(kvM[1]),
        rawValue: kvM[2].trim(),
        sectionPath: [...sectionPath],
        lineIndex: i,
        ...meta,
        ...parsed,
      })
      pending = []
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
  let sectionPath: string[] = []
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

    if (t.startsWith('#') || t.startsWith(';')) { pending.push(t); continue }
    if (t === '') { pending = []; continue }

    const secM = t.match(/^\[(.+)\]$/)
    if (secM) { sectionPath = [secM[1]]; getSection(sectionPath); pending = []; continue }

    const kvM = t.match(/^([^=]+)=(.*)$/)
    if (kvM) {
      const key = kvM[1].trim()
      const rawVal = kvM[2].trim()
      const meta = extractMeta(pending)
      const parsed = parseRawValue(rawVal)

      // 0/1 integers in CFG files are usually booleans
      const isBoolInt = parsed.valueType === 'integer' && (parsed.value === 0 || parsed.value === 1)
        && !meta.range && !meta.allowedValues

      getSection(sectionPath).settings.push({
        key,
        label: humanizeKey(key),
        rawValue: rawVal,
        sectionPath: [...sectionPath],
        lineIndex: i,
        ...meta,
        ...(isBoolInt ? { value: parsed.value === 1, valueType: 'boolean' as const } : parsed),
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

export function parseJson(raw: string, filePath: string): ParsedFile {
  const sections: ConfigSection[] = []
  try {
    const data = JSON.parse(raw)
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { fileName: filePath.split(/[\\/]/).pop() ?? filePath, filePath, fileType: 'json', sections: [], raw, modified: false }
    }
    const rootSettings = jsonObjectToSettings(data as Record<string, unknown>, [])
    if (rootSettings.length > 0) {
      sections.push({ path: [], label: 'General', settings: rootSettings })
    }
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const nested = jsonObjectToSettings(val as Record<string, unknown>, [key])
        if (nested.length > 0) {
          sections.push({ path: [key], label: humanizeKey(key), settings: nested })
        }
      }
    }
  } catch { /* invalid JSON */ }
  return { fileName: filePath.split(/[\\/]/).pop() ?? filePath, filePath, fileType: 'json', sections, raw, modified: false }
}

// ─── dispatcher ─────────────────────────────────────────────────────────────

export function parseConfig(raw: string, filePath: string, fileType: ConfigFileType): ParsedFile {
  switch (fileType) {
    case 'toml': return parseToml(raw, filePath)
    case 'properties': return parseProperties(raw, filePath)
    case 'cfg': return parseCfg(raw, filePath)
    case 'json': return parseJson(raw, filePath)
    default: return parseToml(raw, filePath)
  }
}

import type { ConfigSetting, ConfigFileType } from '../types'
import { findCommentStart, findLineCommentStart } from './parser'

function formatValue(value: boolean | number | string, setting: ConfigSetting, fileType: ConfigFileType): string {
  const { valueType } = setting
  if (valueType === 'float') {
    // Preserve the TOML float type: 2 → "2.0"
    const s = String(value)
    return /^-?\d+$/.test(s) ? s + '.0' : s
  }
  if (valueType === 'string') {
    // TOML/JSON5 strings must be quoted; other formats only if the original was
    if (fileType === 'toml' || fileType === 'json5' || setting.rawValue.trim().startsWith('"')) {
      return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    }
    return String(value)
  }
  return String(value)
}

/** Length of the value at the start of `rest`, respecting quotes, brackets and TOML comments. */
function findValueEnd(rest: string, fileType: ConfigFileType): number {
  if (rest.startsWith('"') || rest.startsWith("'")) {
    const q = rest[0]
    for (let i = 1; i < rest.length; i++) {
      if (q === '"' && rest[i] === '\\') { i++; continue }
      if (rest[i] === q) return i + 1
    }
    return rest.length
  }
  if (rest.startsWith('[')) {
    let bal = 0
    let inStr: '"' | "'" | null = null
    for (let i = 0; i < rest.length; i++) {
      const c = rest[i]
      if (inStr) {
        if (c === '\\' && inStr === '"') { i++; continue }
        if (c === inStr) inStr = null
      } else if (c === '"' || c === "'") {
        inStr = c
      } else if (c === '[') {
        bal++
      } else if (c === ']') {
        bal--
        if (bal === 0) return i + 1
      }
    }
    return rest.length
  }
  // Bare value: in TOML it ends at an inline comment, in JSON5 at ',' or '//',
  // elsewhere at end of line
  let end = rest.length
  if (fileType === 'toml') {
    const ci = findCommentStart(rest)
    if (ci !== -1) end = ci
  } else if (fileType === 'json5') {
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === ',' || (rest[i] === '/' && rest[i + 1] === '/')) { end = i; break }
    }
  }
  while (end > 0 && /\s/.test(rest[end - 1])) end--
  return end
}

function applyJsonChange(raw: string, setting: ConfigSetting, newValue: boolean | number | string): string {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    let target = data
    for (const key of setting.sectionPath) {
      target = target[key] as Record<string, unknown>
    }
    if (setting.valueType === 'array') {
      try { target[setting.key] = JSON.parse(String(newValue)) }
      catch { target[setting.key] = newValue }
    } else {
      target[setting.key] = newValue
    }
    // Match the file's existing indentation and trailing newline
    const indent = raw.match(/^([ \t]+)["}\]]/m)?.[1] ?? '  '
    const out = JSON.stringify(data, null, indent)
    return raw.endsWith('\n') ? out + '\n' : out
  } catch {
    return raw
  }
}

export function applyChange(raw: string, setting: ConfigSetting, newValue: boolean | number | string, fileType: ConfigFileType): string {
  if (setting.lineIndex === -1) return applyJsonChange(raw, setting, newValue)

  const lines = raw.split('\n')
  const line = lines[setting.lineIndex]
  if (line === undefined) return raw
  const formatted = formatValue(newValue, setting, fileType)

  // Locate the key/value separator (properties also allows ':'; JSON5 uses ':'
  // and the quoted key may itself contain ':')
  let sepIdx = -1
  if (fileType === 'properties') {
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '=' || line[i] === ':') { sepIdx = i; break }
    }
  } else if (fileType === 'json5') {
    let start = line.length - line.trimStart().length
    const q = line[start]
    if (q === '"' || q === "'") {
      for (let i = start + 1; i < line.length; i++) {
        if (line[i] === '\\') { i++; continue }
        if (line[i] === q) { start = i + 1; break }
      }
    }
    sepIdx = line.indexOf(':', start)
  } else {
    sepIdx = line.indexOf('=')
  }
  if (sepIdx === -1) return raw

  let vs = sepIdx + 1
  while (vs < line.length && (line[vs] === ' ' || line[vs] === '\t')) vs++
  const prefix = line.slice(0, vs)

  // Value spanning multiple lines (multi-line array): collapse the span,
  // keeping whatever follows the closing bracket on the last line (',', comments)
  const endLine = setting.endLineIndex ?? setting.lineIndex
  if (endLine > setting.lineIndex) {
    const lastLine = lines[endLine]
    const ci = fileType === 'json5' ? findLineCommentStart(lastLine)
      : fileType === 'toml' ? findCommentStart(lastLine)
      : -1
    const codePart = ci !== -1 ? lastLine.slice(0, ci) : lastLine
    const close = codePart.lastIndexOf(']')
    const suffix = close !== -1 ? lastLine.slice(close + 1) : ''
    lines.splice(setting.lineIndex, endLine - setting.lineIndex + 1, prefix + formatted + suffix)
    return lines.join('\n')
  }

  const rest = line.slice(vs)
  const ve = findValueEnd(rest, fileType)
  lines[setting.lineIndex] = prefix + formatted + rest.slice(ve)
  return lines.join('\n')
}

export function parseDefaultValue(defaultStr: string, type: ConfigSetting['valueType']): boolean | number | string {
  switch (type) {
    case 'boolean': return defaultStr.trim() === 'true'
    case 'integer': return parseInt(defaultStr.trim(), 10)
    case 'float': return parseFloat(defaultStr.trim())
    default: return defaultStr.replace(/^"|"$/g, '')
  }
}

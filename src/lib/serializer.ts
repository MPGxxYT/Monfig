import type { ConfigSetting } from '../types'

function formatValue(value: boolean | number | string, type: ConfigSetting['valueType']): string {
  if (type === 'boolean') return String(value)
  if (type === 'integer') return String(value)
  if (type === 'float') return String(value)
  if (type === 'string') return `"${value}"`
  return String(value)
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
    return JSON.stringify(data, null, 2)
  } catch {
    return raw
  }
}

export function applyChange(raw: string, setting: ConfigSetting, newValue: boolean | number | string): string {
  if (setting.lineIndex === -1) return applyJsonChange(raw, setting, newValue)

  const lines = raw.split('\n')
  const line = lines[setting.lineIndex]
  if (line === undefined) return raw
  const formatted = formatValue(newValue, setting.valueType)
  lines[setting.lineIndex] = line.replace(/([\s]*\w+\s*=\s*)(.+?)(\s*(#.*)?)$/, `$1${formatted}$3`)
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

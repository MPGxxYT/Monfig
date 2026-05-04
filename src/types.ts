export type ConfigFileType = 'toml' | 'properties' | 'cfg' | 'json' | 'unknown'
export type SettingValueType = 'boolean' | 'integer' | 'float' | 'string' | 'array'
export type ModVariant = 'client' | 'server' | 'common' | 'other'

export interface Modpack {
  id: string
  name: string
  configPath: string
  addedAt: number
}

export interface ConfigSetting {
  key: string
  label: string
  value: boolean | number | string
  rawValue: string
  valueType: SettingValueType
  description: string
  defaultValue: string | null
  range: { min: number; max: number } | null
  allowedValues: string[] | null
  sectionPath: string[]
  lineIndex: number
}

export interface ConfigSection {
  path: string[]
  label: string
  settings: ConfigSetting[]
}

export interface ParsedFile {
  fileName: string
  filePath: string
  fileType: ConfigFileType
  sections: ConfigSection[]
  raw: string
  modified: boolean
}

export interface ModFile {
  modName: string
  displayName: string
  variant: ModVariant
  fileName: string
  filePath: string
  fileType: ConfigFileType
}

export interface ModGroup {
  id: string
  displayName: string
  files: ModFile[]
}

export interface HighlightedSetting {
  filePath: string
  key: string
  sectionPath: string[]
  label: string
  ts: number
}

export function isSettingChanged(s: ConfigSetting): boolean {
  if (s.defaultValue === null || s.defaultValue === undefined) return false
  if (s.valueType === 'integer' || s.valueType === 'float') {
    const cur = parseFloat(String(s.value))
    const def = parseFloat(s.defaultValue)
    if (!isNaN(cur) && !isNaN(def)) return cur !== def
  }
  return String(s.value) !== String(s.defaultValue)
}

export function detectFileType(name: string): ConfigFileType {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'toml': return 'toml'
    case 'properties': return 'properties'
    case 'cfg':
    case 'conf':
    case 'ini': return 'cfg'
    case 'json': return 'json'
    default: return 'unknown'
  }
}

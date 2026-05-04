import type { ModFile, ModGroup } from '../types'
import { detectFileType } from '../types'

function humanize(s: string): string {
  return s
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function groupFilesByMod(files: { name: string; path: string }[]): ModGroup[] {
  const map = new Map<string, ModGroup>()

  for (const { name, path } of files) {
    const baseName = name.replace(/\.[^.]+$/, '')
    const ext = name.split('.').pop()?.toLowerCase() ?? ''
    if (!['toml', 'properties', 'cfg', 'conf', 'ini', 'json'].includes(ext)) continue
    if (name.endsWith('.bak')) continue

    let modName = baseName
    let variant: ModFile['variant'] = 'other'

    const match = baseName.match(/^(.+?)(?:-(\d+-)?)?(client|server|common)(?:-\d+)?$/i)
    if (match) {
      modName = match[1]
      variant = match[3].toLowerCase() as ModFile['variant']
    }

    const file: ModFile = {
      modName,
      displayName: humanize(modName),
      variant,
      fileName: name,
      filePath: path,
      fileType: detectFileType(name),
    }

    const group = map.get(modName)
    if (group) {
      group.files.push(file)
    } else {
      map.set(modName, { id: modName, displayName: humanize(modName), files: [file] })
    }
  }

  const variantOrder: Record<string, number> = { client: 0, common: 1, server: 2, other: 3 }

  return Array.from(map.values())
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((g) => ({
      ...g,
      files: g.files.sort((a, b) => variantOrder[a.variant] - variantOrder[b.variant]),
    }))
}

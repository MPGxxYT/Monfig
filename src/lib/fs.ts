import { readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-dialog'

export async function pickFolder(): Promise<string | null> {
  const result = await open({ directory: true, multiple: false })
  return typeof result === 'string' ? result : null
}

const MAX_DEPTH = 3

/** Lists files recursively; `name` is the path relative to the config root ('/' separated). */
export async function listConfigFiles(dirPath: string, prefix = '', depth = 0): Promise<{ name: string; path: string }[]> {
  const entries = await readDir(dirPath)
  const result: { name: string; path: string }[] = []

  for (const entry of entries) {
    if (entry.isFile) {
      result.push({ name: prefix + entry.name, path: `${dirPath}/${entry.name}` })
    } else if (entry.isDirectory && depth < MAX_DEPTH && !entry.name.startsWith('.')) {
      try {
        result.push(...await listConfigFiles(`${dirPath}/${entry.name}`, `${prefix}${entry.name}/`, depth + 1))
      } catch { /* unreadable subdir — skip */ }
    }
  }

  return result
}

export async function readFile(path: string): Promise<string> {
  return readTextFile(path)
}

export async function saveFile(path: string, content: string): Promise<void> {
  return writeTextFile(path, content)
}

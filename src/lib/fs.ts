import { readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-dialog'

export async function pickFolder(): Promise<string | null> {
  const result = await open({ directory: true, multiple: false })
  return typeof result === 'string' ? result : null
}

export async function listConfigFiles(dirPath: string): Promise<{ name: string; path: string }[]> {
  const entries = await readDir(dirPath)
  const result: { name: string; path: string }[] = []

  for (const entry of entries) {
    if (!entry.isFile) continue
    result.push({ name: entry.name, path: `${dirPath}/${entry.name}` })
  }

  return result
}

export async function readFile(path: string): Promise<string> {
  return readTextFile(path)
}

export async function saveFile(path: string, content: string): Promise<void> {
  return writeTextFile(path, content)
}

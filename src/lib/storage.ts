import type { Modpack } from '../types'

const KEY = 'monfig_modpacks'
const PINNED_KEY = 'monfig_pinned_mods'

export function loadModpacks(): Modpack[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Modpack[]) : []
  } catch {
    return []
  }
}

export function saveModpacks(modpacks: Modpack[]): void {
  localStorage.setItem(KEY, JSON.stringify(modpacks))
}

export function loadPinnedMods(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(PINNED_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

export function savePinnedMods(pinned: Record<string, string[]>): void {
  localStorage.setItem(PINNED_KEY, JSON.stringify(pinned))
}

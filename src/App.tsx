import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Save, CheckCircle2, AlertCircle, Search, Undo2, Redo2 } from 'lucide-react'
import type { Modpack, ModGroup, ModFile, ParsedFile, ConfigSection, HighlightedSetting } from './types'
import { detectFileType, isSettingChanged } from './types'
import { loadModpacks, saveModpacks, loadPinnedMods, savePinnedMods } from './lib/storage'
import { pickFolder, listConfigFiles, readFile, saveFile } from './lib/fs'
import { groupFilesByMod } from './lib/grouping'
import { parseConfig } from './lib/parser'
import { applyChange, parseDefaultValue } from './lib/serializer'
import { Sidebar } from './components/Sidebar'
import { SettingsPage } from './components/SettingsPage'
import type { SettingsPageHandle } from './components/SettingsPage'
import { ModPage } from './components/ModPage'
import { WelcomeScreen } from './components/WelcomeScreen'
import { GlobalSearch } from './components/GlobalSearch'
import { ToastContainer, useToasts } from './components/Toast'
import './index.css'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type ActiveView = { type: 'file'; file: ModFile } | { type: 'mod'; modId: string } | null

interface HistoryFrame { raw: string; sections: ConfigSection[] }
interface FileHistory { past: HistoryFrame[]; future: HistoryFrame[] }

interface SettingDiff {
  key: string
  sectionPath: string[]
  label: string
  fromVal: string
  toVal: string
}

function diffFrames(from: ConfigSection[], to: ConfigSection[]): SettingDiff[] {
  const changes: SettingDiff[] = []
  for (const toSec of to) {
    const fromSec = from.find((s) => s.path.join('\x00') === toSec.path.join('\x00'))
    for (const toSet of toSec.settings) {
      const fromSet = fromSec?.settings.find((s) => s.key === toSet.key)
      if (fromSet && String(fromSet.value) !== String(toSet.value)) {
        changes.push({
          key: toSet.key,
          sectionPath: toSet.sectionPath,
          label: toSet.label,
          fromVal: String(fromSet.value),
          toVal: String(toSet.value),
        })
      }
    }
  }
  return changes
}

export default function App() {
  const [modpacks, setModpacks] = useState<Modpack[]>(() => loadModpacks())
  const [activeId, setActiveId] = useState<string | null>(() => {
    const s = loadModpacks(); return s.length > 0 ? s[0].id : null
  })
  const [modGroups, setModGroups] = useState<ModGroup[]>([])
  const [allFiles, setAllFiles] = useState<ModFile[]>([])
  const [activeView, setActiveView] = useState<ActiveView>(null)
  const [fileCache, setFileCache] = useState<Map<string, ParsedFile>>(new Map())
  const [originalRaws, setOriginalRaws] = useState<Map<string, string>>(new Map())
  const [fileHistories, setFileHistories] = useState<Map<string, FileHistory>>(new Map())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInitialQuery, setSearchInitialQuery] = useState('')
  const [indexing, setIndexing] = useState(false)
  const [indexProgress, setIndexProgress] = useState({ done: 0, total: 0 })
  const [pinnedMods, setPinnedMods] = useState<Record<string, string[]>>(() => loadPinnedMods())
  const [highlightedSetting, setHighlightedSetting] = useState<HighlightedSetting | null>(null)
  const indexAbortRef = useRef(false)
  const settingsPageRef = useRef<SettingsPageHandle>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { toasts, addToast, dismissToast } = useToasts()

  const activeModpack = modpacks.find((m) => m.id === activeId) ?? null
  const selectedFile = activeView?.type === 'file' ? activeView.file : null
  const selectedModId = activeView?.type === 'mod' ? activeView.modId : null
  const parsedFile = selectedFile ? (fileCache.get(selectedFile.filePath) ?? null) : null
  const modifiedPaths = new Set(Array.from(fileCache.values()).filter((f) => f.modified).map((f) => f.filePath))
  const parsedCounts = new Map(Array.from(fileCache.entries()).map(([p, f]) => [p, f.sections.reduce((n, s) => n + s.settings.length, 0)]))
  const activePinnedIds = activeId ? (pinnedMods[activeId] ?? []) : []

  const currentHistory = selectedFile ? (fileHistories.get(selectedFile.filePath) ?? { past: [], future: [] }) : null
  const canUndo = (currentHistory?.past.length ?? 0) > 0
  const canRedo = (currentHistory?.future.length ?? 0) > 0

  // Compute which mods have any setting changed from its default
  const modsWithChanges = useMemo(() => {
    const result = new Set<string>()
    for (const group of modGroups) {
      for (const file of group.files) {
        const parsed = fileCache.get(file.filePath)
        if (parsed?.sections.some((sec) => sec.settings.some((s) => isSettingChanged(s)))) {
          result.add(group.id)
          break
        }
      }
    }
    return result
  }, [modGroups, fileCache])

  // Load + index modpack
  useEffect(() => {
    if (!activeModpack) { setModGroups([]); setAllFiles([]); return }
    indexAbortRef.current = true
    setFileCache(new Map()); setOriginalRaws(new Map()); setFileHistories(new Map())
    setActiveView(null)

    listConfigFiles(activeModpack.configPath).then((files) => {
      const groups = groupFilesByMod(files)
      const flat = groups.flatMap((g) => g.files)
      setModGroups(groups); setAllFiles(flat)
      indexAbortRef.current = false
      setIndexing(true); setIndexProgress({ done: 0, total: flat.length })

      const run = async () => {
        const cache = new Map<string, ParsedFile>()
        const originals = new Map<string, string>()
        for (let i = 0; i < flat.length; i++) {
          if (indexAbortRef.current) return
          try {
            const raw = await readFile(flat[i].filePath)
            const parsed = parseConfig(raw, flat[i].filePath, detectFileType(flat[i].fileName))
            cache.set(flat[i].filePath, parsed)
            originals.set(flat[i].filePath, raw)
          } catch { /* skip */ }
          setIndexProgress({ done: i + 1, total: flat.length })
        }
        setFileCache(cache); setOriginalRaws(originals); setIndexing(false)
      }
      run()
    }).catch(() => { setModGroups([]); setAllFiles([]) })
  }, [activeModpack?.configPath])

  // ── Helpers ──────────────────────────────────────────────────────────────

  function pushHistory(filePath: string, frame: HistoryFrame) {
    setFileHistories((prev) => {
      const h = prev.get(filePath) ?? { past: [], future: [] }
      return new Map(prev).set(filePath, {
        past: [...h.past.slice(-49), frame],
        future: [],
      })
    })
  }

  // Trigger a highlight on a setting and clear it after 2s
  function triggerHighlight(filePath: string, key: string, sectionPath: string[], label: string) {
    clearTimeout(highlightTimerRef.current)
    setHighlightedSetting({ filePath, key, sectionPath, label, ts: Date.now() })
    highlightTimerRef.current = setTimeout(() => setHighlightedSetting(null), 2200)
  }

  // Navigate to a setting: open the file if needed, then highlight it
  const navigateToSetting = useCallback((filePath: string, key: string, sectionPath: string[], label: string) => {
    const file = allFiles.find((f) => f.filePath === filePath)
    if (file && selectedFile?.filePath !== filePath) {
      setActiveView({ type: 'file', file })
    }
    triggerHighlight(filePath, key, sectionPath, label)
  }, [allFiles, selectedFile])

  // ── Settings change ───────────────────────────────────────────────────────

  const handleChangeSetting = useCallback((
    key: string, sectionPath: string[], value: boolean | number | string, filePath?: string,
  ) => {
    const path = filePath ?? selectedFile?.filePath
    if (!path) return
    setFileCache((prev) => {
      const current = prev.get(path)
      if (!current) return prev
      pushHistory(path, { raw: current.raw, sections: current.sections })
      const secKey = sectionPath.join('\x00')
      const section = current.sections.find((s) => s.path.join('\x00') === secKey)
      const setting = section?.settings.find((s) => s.key === key)
      if (!setting) return prev
      const newRaw = applyChange(current.raw, setting, value)
      const sections = current.sections.map((sec) =>
        sec.path.join('\x00') !== secKey ? sec : {
          ...sec, settings: sec.settings.map((s) => s.key !== key ? s : { ...s, value, rawValue: String(value) }),
        }
      )
      const orig = originalRaws.get(path) ?? current.raw
      return new Map(prev).set(path, { ...current, raw: newRaw, sections, modified: newRaw !== orig })
    })
  }, [selectedFile, originalRaws])

  // ── Reset helpers ─────────────────────────────────────────────────────────

  const handleResetSetting = useCallback((key: string, sectionPath: string[], filePath?: string) => {
    const path = filePath ?? selectedFile?.filePath
    if (!path) return
    const f = fileCache.get(path)
    const sec = f?.sections.find((s) => s.path.join('\x00') === sectionPath.join('\x00'))
    const setting = sec?.settings.find((s) => s.key === key)
    if (!setting?.defaultValue) return
    const def = parseDefaultValue(setting.defaultValue, setting.valueType)
    handleChangeSetting(key, sectionPath, def, path)
  }, [selectedFile, fileCache, handleChangeSetting])

  const handleResetSection = useCallback((sectionPath: string[], filePath?: string) => {
    const path = filePath ?? selectedFile?.filePath
    if (!path) return
    const f = fileCache.get(path)
    const sec = f?.sections.find((s) => s.path.join('\x00') === sectionPath.join('\x00'))
    if (!sec) return
    for (const s of sec.settings) {
      if (s.defaultValue !== null) handleResetSetting(s.key, sectionPath, path)
    }
  }, [selectedFile, fileCache, handleResetSetting])

  const handleResetFile = useCallback((filePath?: string) => {
    const path = filePath ?? selectedFile?.filePath
    if (!path) return
    const f = fileCache.get(path)
    if (!f) return
    for (const sec of f.sections) handleResetSection(sec.path, path)
  }, [selectedFile, fileCache, handleResetSection])

  const handleResetMod = useCallback((modId: string) => {
    const group = modGroups.find((g) => g.id === modId)
    if (!group) return
    for (const file of group.files) handleResetFile(file.filePath)
  }, [modGroups, handleResetFile])

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (!selectedFile) return
    const path = selectedFile.filePath
    const h = fileHistories.get(path)
    const current = fileCache.get(path)
    if (!h || h.past.length === 0 || !current) return

    const previous = h.past[h.past.length - 1]
    const changes = diffFrames(current.sections, previous.sections)

    const orig = originalRaws.get(path) ?? previous.raw
    setFileCache((prev) => {
      const f = prev.get(path)
      if (!f) return prev
      return new Map(prev).set(path, { ...f, raw: previous.raw, sections: previous.sections, modified: previous.raw !== orig })
    })
    setFileHistories((prev) => {
      const h2 = prev.get(path)
      if (!h2) return prev
      return new Map(prev).set(path, {
        past: h2.past.slice(0, -1),
        future: [...h2.future, { raw: current.raw, sections: current.sections }],
      })
    })

    if (changes.length > 0) {
      const c = changes[0]
      const msg = `Undo: "${c.label}" ${c.fromVal} → ${c.toVal}`
      addToast({
        message: msg,
        action: { label: 'Go to setting', onClick: () => navigateToSetting(path, c.key, c.sectionPath, c.label) },
        duration: 5000,
      })
      triggerHighlight(path, c.key, c.sectionPath, c.label)
    }
  }, [selectedFile, fileCache, fileHistories, originalRaws, addToast, navigateToSetting])

  const handleRedo = useCallback(() => {
    if (!selectedFile) return
    const path = selectedFile.filePath
    const h = fileHistories.get(path)
    const current = fileCache.get(path)
    if (!h || h.future.length === 0 || !current) return

    const next = h.future[h.future.length - 1]
    const changes = diffFrames(current.sections, next.sections)

    const orig = originalRaws.get(path) ?? next.raw
    setFileCache((prev) => {
      const f = prev.get(path)
      if (!f) return prev
      return new Map(prev).set(path, { ...f, raw: next.raw, sections: next.sections, modified: next.raw !== orig })
    })
    setFileHistories((prev) => {
      const h2 = prev.get(path)
      if (!h2) return prev
      return new Map(prev).set(path, {
        past: [...h2.past, { raw: current.raw, sections: current.sections }],
        future: h2.future.slice(0, -1),
      })
    })

    if (changes.length > 0) {
      const c = changes[0]
      const msg = `Redo: "${c.label}" ${c.fromVal} → ${c.toVal}`
      addToast({
        message: msg,
        action: { label: 'Go to setting', onClick: () => navigateToSetting(path, c.key, c.sectionPath, c.label) },
        duration: 5000,
      })
      triggerHighlight(path, c.key, c.sectionPath, c.label)
    }
  }, [selectedFile, fileCache, fileHistories, originalRaws, addToast, navigateToSetting])

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!parsedFile || !parsedFile.modified) return
    setSaveStatus('saving')
    try {
      await saveFile(parsedFile.filePath, parsedFile.raw)
      setFileCache((prev) => {
        const f = prev.get(parsedFile.filePath)!
        return new Map(prev).set(parsedFile.filePath, { ...f, modified: false })
      })
      setOriginalRaws((prev) => new Map(prev).set(parsedFile.filePath, parsedFile.raw))
      setSaveStatus('saved')
    } catch { setSaveStatus('error') }
  }, [parsedFile])

  // ── Modpack management ────────────────────────────────────────────────────

  const handleAddModpack = useCallback(async () => {
    const path = await pickFolder()
    if (!path) return
    const parts = path.replace(/\\/g, '/').split('/')
    const last = parts[parts.length - 1]
    const name = last.toLowerCase() === 'config' ? (parts[parts.length - 2] ?? last) : last
    const pack: Modpack = { id: crypto.randomUUID(), name, configPath: path, addedAt: Date.now() }
    const next = [...modpacks, pack]
    setModpacks(next); saveModpacks(next); setActiveId(pack.id)
  }, [modpacks])

  const handleRemoveModpack = useCallback((id: string) => {
    const next = modpacks.filter((m) => m.id !== id)
    setModpacks(next); saveModpacks(next)
    if (activeId === id) { setActiveId(next[0]?.id ?? null); setActiveView(null) }
  }, [modpacks, activeId])

  // ── Pin management ────────────────────────────────────────────────────────

  const handleTogglePin = useCallback((modId: string) => {
    if (!activeId) return
    setPinnedMods((prev) => {
      const current = prev[activeId] ?? []
      const next = current.includes(modId)
        ? current.filter((id) => id !== modId)
        : [...current, modId]
      const updated = { ...prev, [activeId]: next }
      savePinnedMods(updated)
      return updated
    })
  }, [activeId])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === 's') { e.preventDefault(); handleSave(); return }
      if (ctrl && !e.shiftKey && e.key === 'z') { e.preventDefault(); handleUndo(); return }
      if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); handleRedo(); return }
      if (ctrl && e.key === 'f') { e.preventDefault(); if (activeModpack) setSearchOpen(true); return }

      // Typing with nothing focused → open search
      if (ctrl || e.altKey || e.metaKey) return
      if (e.key.length !== 1) return  // not a printable character
      const active = document.activeElement
      const isInput = active?.tagName === 'INPUT'
        || active?.tagName === 'TEXTAREA'
        || active?.tagName === 'SELECT'
        || (active as HTMLElement | null)?.isContentEditable
      if (isInput) return

      if (!activeModpack) return
      e.preventDefault()

      if (activeView?.type === 'file') {
        settingsPageRef.current?.focusSearch(e.key)
      } else {
        // Mod view or no view — open global search with the key as initial query
        setSearchInitialQuery(e.key)
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleSave, handleUndo, handleRedo, activeModpack, activeView])

  useEffect(() => {
    if (saveStatus === 'saved' || saveStatus === 'error') {
      const t = setTimeout(() => setSaveStatus('idle'), 2000); return () => clearTimeout(t)
    }
  }, [saveStatus])

  // Reset initialQuery when search closes
  useEffect(() => {
    if (!searchOpen) setSearchInitialQuery('')
  }, [searchOpen])

  const selectedModGroup = activeView?.type === 'mod'
    ? modGroups.find((g) => g.id === activeView.modId) ?? null
    : null

  return (
    <div className="flex flex-col h-screen bg-[#f6f2ec]">
      {/* Header */}
      <header className="h-12 flex items-center px-5 gap-4 border-b border-[#dbd2c7] bg-[#ede8e1] flex-shrink-0">
        <div className="flex items-baseline gap-2.5">
          <span className="font-bold text-[#f97316] text-lg tracking-wide">Monfig</span>
          <span className="text-sm text-[#a07850]">Modpack Config Editor</span>
        </div>

        {activeView?.type === 'file' && (
          <>
            <div className="w-px h-4 bg-[#dbd2c7]" />
            <span className="text-sm text-[#7a5530] truncate max-w-sm">{activeView.file.fileName}</span>
          </>
        )}
        {activeView?.type === 'mod' && (
          <>
            <div className="w-px h-4 bg-[#dbd2c7]" />
            <span className="text-sm text-[#7a5530]">{selectedModGroup?.displayName} — all files</span>
          </>
        )}

        <div className="flex-1" />

        {selectedFile && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className={`p-1.5 rounded transition-colors ${canUndo ? 'text-[#7a5530] hover:text-[#5a3a1a] hover:bg-[#dbd2c7]' : 'text-[#c0aa90] cursor-default'}`}
            >
              <Undo2 size={15} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className={`p-1.5 rounded transition-colors ${canRedo ? 'text-[#7a5530] hover:text-[#5a3a1a] hover:bg-[#dbd2c7]' : 'text-[#c0aa90] cursor-default'}`}
            >
              <Redo2 size={15} />
            </button>
          </div>
        )}

        {activeModpack && (
          <button
            onClick={() => setSearchOpen(true)}
            title="Search modpack (Ctrl+F)"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#7a5530] hover:text-[#5a3a1a] bg-white border border-[#dbd2c7] hover:border-[#c0aa90] transition-all"
          >
            <Search size={13} />
            <span>Search</span>
            <span className="text-xs text-[#a07850] border border-[#dbd2c7] rounded px-1">Ctrl+F</span>
          </button>
        )}

        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1.5 text-sm text-[#16a34a]"><CheckCircle2 size={13} /> Saved</span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-1.5 text-sm text-[#dc2626]"><AlertCircle size={13} /> Save failed</span>
        )}
        {parsedFile && (
          <button
            onClick={handleSave}
            disabled={!parsedFile.modified || saveStatus === 'saving'}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
              parsedFile.modified
                ? 'bg-[#f97316] hover:bg-[#ea6c0a] border-[#f97316] text-white'
                : 'bg-[#ede8e1] border-[#dbd2c7] text-[#c0aa90] cursor-default'
            }`}
          >
            <Save size={13} />
            {saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        <Sidebar
          modpacks={modpacks}
          activeModpackId={activeId}
          modGroups={modGroups}
          selectedFilePath={selectedFile?.filePath ?? null}
          selectedModId={selectedModId}
          modifiedPaths={modifiedPaths}
          parsedCounts={parsedCounts}
          pinnedModIds={activePinnedIds}
          modsWithChanges={modsWithChanges}
          onSelectModpack={(id) => { setActiveId(id); setActiveView(null) }}
          onAddModpack={handleAddModpack}
          onRemoveModpack={handleRemoveModpack}
          onSelectFile={(file) => setActiveView({ type: 'file', file })}
          onSelectMod={(modId) => setActiveView({ type: 'mod', modId })}
          onResetMod={handleResetMod}
          onTogglePin={handleTogglePin}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-[#f6f2ec]">
          {parsedFile ? (
            <SettingsPage
              ref={settingsPageRef}
              file={parsedFile}
              onChangeSetting={handleChangeSetting}
              onResetSetting={handleResetSetting}
              onResetSection={handleResetSection}
              onResetFile={() => handleResetFile()}
              highlightedSetting={highlightedSetting?.filePath === selectedFile?.filePath ? highlightedSetting : null}
            />
          ) : selectedModGroup ? (
            <ModPage
              group={selectedModGroup}
              parsedFiles={fileCache}
              onChangeSetting={(key, path, value) => handleChangeSetting(key, path, value)}
              onResetSetting={handleResetSetting}
              onResetSection={handleResetSection}
              onResetFile={handleResetFile}
              onOpenFile={(file) => setActiveView({ type: 'file', file })}
              highlightedSetting={highlightedSetting}
            />
          ) : (
            <WelcomeScreen hasModpacks={modpacks.length > 0} onAddModpack={handleAddModpack} />
          )}
        </main>
      </div>

      <GlobalSearch
        isOpen={searchOpen}
        isLoading={indexing}
        loadingProgress={indexProgress}
        allFiles={allFiles}
        parsedFiles={fileCache}
        initialQuery={searchInitialQuery}
        onClose={() => setSearchOpen(false)}
        onNavigate={(file, sectionPath) => {
          setActiveView({ type: 'file', file })
          void sectionPath
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

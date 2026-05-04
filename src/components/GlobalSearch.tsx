import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Loader2, FileText, X, ArrowRight } from 'lucide-react'
import type { ParsedFile, ModFile } from '../types'

export interface SearchResult {
  settingKey: string
  settingLabel: string
  settingDescription: string
  settingValue: string
  sectionLabel: string
  sectionPath: string[]
  file: ModFile
}

interface Props {
  isOpen: boolean
  isLoading: boolean
  loadingProgress: { done: number; total: number }
  allFiles: ModFile[]
  parsedFiles: Map<string, ParsedFile>
  initialQuery?: string
  onClose: () => void
  onNavigate: (file: ModFile, sectionPath: string[]) => void
}

const VARIANT_COLOR: Record<string, string> = {
  client: '#3b82f6', server: '#f59e0b', common: '#16a34a', other: '#64748b',
}

export function GlobalSearch({ isOpen, isLoading, loadingProgress, parsedFiles, allFiles, initialQuery, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery ?? '')
      setTimeout(() => {
        inputRef.current?.focus()
        // Place cursor at end if there's an initial character
        if (initialQuery) inputRef.current?.setSelectionRange(initialQuery.length, initialQuery.length)
      }, 50)
    }
  }, [isOpen])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isOpen, onClose])

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim()
    if (!q) return []
    const out: SearchResult[] = []
    for (const [, pf] of parsedFiles) {
      const modFile = allFiles.find((f) => f.filePath === pf.filePath)
      if (!modFile) continue
      for (const sec of pf.sections) {
        const secLabel = sec.path.length
          ? sec.path.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' › ')
          : 'General'
        for (const s of sec.settings) {
          if (s.label.toLowerCase().includes(q) || s.key.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) {
            out.push({
              settingKey: s.key, settingLabel: s.label,
              settingDescription: s.description, settingValue: String(s.value),
              sectionLabel: secLabel, sectionPath: sec.path, file: modFile,
            })
          }
        }
      }
    }
    return out.slice(0, 80)
  }, [query, parsedFiles, allFiles])

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>()
    for (const r of results) {
      const list = map.get(r.file.filePath) ?? []
      list.push(r)
      map.set(r.file.filePath, list)
    }
    return Array.from(map.entries())
  }, [results])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white border border-[#dbd2c7] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#e8e2da]">
          {isLoading
            ? <Loader2 size={18} className="text-[#f97316] animate-spin flex-shrink-0" />
            : <Search size={18} className="text-[#a07850] flex-shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            placeholder={isLoading
              ? `Indexing… (${loadingProgress.done}/${loadingProgress.total})`
              : 'Search all settings in this modpack…'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-base text-[#1a1108] placeholder-[#a07850] focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#a07850] hover:text-[#5a3a1a]"><X size={15} /></button>
          )}
          <button onClick={onClose} className="text-xs text-[#a07850] hover:text-[#5a3a1a] border border-[#dbd2c7] rounded px-1.5 py-0.5">esc</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {!query && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Search size={28} className="text-[#dbd2c7]" strokeWidth={1.5} />
              <p className="text-sm text-[#a07850]">
                {isLoading
                  ? `Indexing ${loadingProgress.done} of ${loadingProgress.total} files…`
                  : `${parsedFiles.size} files indexed — start typing`
                }
              </p>
            </div>
          )}
          {query && results.length === 0 && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-base text-[#7a5530]">No results for "{query}"</p>
            </div>
          )}
          {grouped.map(([, fileResults]) => {
            const file = fileResults[0].file
            const color = VARIANT_COLOR[file.variant] ?? VARIANT_COLOR.other
            return (
              <div key={file.filePath} className="border-b border-[#e8e2da] last:border-0">
                <div className="flex items-center gap-2 px-5 py-2 bg-[#f6f2ec]/60">
                  <FileText size={13} className="text-[#a07850]" />
                  <span className="text-sm font-semibold text-[#5a3a1a]">{file.displayName}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ color, backgroundColor: `${color}20` }}>
                    {file.variant}
                  </span>
                  <span className="text-xs text-[#a07850] ml-auto">{fileResults.length} match{fileResults.length !== 1 ? 'es' : ''}</span>
                </div>
                {fileResults.map((r) => (
                  <button
                    key={r.settingKey + r.sectionLabel}
                    onClick={() => { onNavigate(r.file, r.sectionPath); onClose() }}
                    className="w-full flex items-start gap-4 px-5 py-3 hover:bg-black/[0.03] transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-[#1a1108]">{r.settingLabel}</span>
                        <span className="text-xs text-[#a07850]">{r.sectionLabel}</span>
                      </div>
                      {r.settingDescription && (
                        <p className="text-sm text-[#7a5530] mt-0.5 truncate">{r.settingDescription}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                      <span className="text-xs font-mono text-[#7a5530] bg-[#f6f2ec] border border-[#dbd2c7] rounded px-2 py-0.5">
                        {r.settingValue.length > 20 ? r.settingValue.slice(0, 20) + '…' : r.settingValue}
                      </span>
                      <ArrowRight size={13} className="text-[#a07850]" />
                    </div>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

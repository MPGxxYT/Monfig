import { useState, useMemo } from 'react'
import { Plus, Trash2, ChevronRight, ChevronDown, Package, FileText, Search, Layers, Pin, PinOff } from 'lucide-react'
import type { Modpack, ModGroup, ModFile } from '../types'
import { ResetButton } from './ResetButton'

interface Props {
  modpacks: Modpack[]
  activeModpackId: string | null
  modGroups: ModGroup[]
  selectedFilePath: string | null
  selectedModId: string | null
  modifiedPaths: Set<string>
  parsedCounts: Map<string, number>
  pinnedModIds: string[]
  modsWithChanges: Set<string>
  onSelectModpack: (id: string) => void
  onAddModpack: () => void
  onRemoveModpack: (id: string) => void
  onSelectFile: (file: ModFile) => void
  onSelectMod: (modId: string) => void
  onResetMod: (modId: string) => void
  onTogglePin: (modId: string) => void
}

const VARIANT_COLOR: Record<string, string> = {
  client: '#3b82f6',
  server: '#f59e0b',
  common: '#16a34a',
  other:  '#64748b',
}

function ModGroupItem({
  group, selectedFilePath, selectedModId, modifiedPaths, parsedCounts,
  hideEmpty, variantFilter, isPinned, hasChanges,
  onSelectFile, onSelectMod, onResetMod, onTogglePin,
}: {
  group: ModGroup
  selectedFilePath: string | null
  selectedModId: string | null
  modifiedPaths: Set<string>
  parsedCounts: Map<string, number>
  hideEmpty: boolean
  variantFilter: string
  isPinned: boolean
  hasChanges: boolean
  onSelectFile: (f: ModFile) => void
  onSelectMod: (id: string) => void
  onResetMod: (id: string) => void
  onTogglePin: (id: string) => void
}) {
  const visibleFiles = group.files.filter((f) => {
    if (variantFilter !== 'all' && f.variant !== variantFilter) return false
    if (hideEmpty) {
      const count = parsedCounts.get(f.filePath)
      if (count === 0) return false
    }
    return true
  })
  if (visibleFiles.length === 0) return null

  const isModActive = selectedModId === group.id
  const isFileActive = group.files.some((f) => f.filePath === selectedFilePath)
  const isActive = isModActive || isFileActive
  const [open, setOpen] = useState(isActive)

  return (
    <div>
      <div className="flex items-center group/mod">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
            isActive ? 'text-[#5a3a1a]' : 'text-[#7a5530] hover:text-[#5a3a1a]'
          } hover:bg-black/[0.04]`}
        >
          <span className="text-[#a07850] flex-shrink-0">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <Package size={14} className={`flex-shrink-0 ${isActive ? 'text-[#f97316]' : 'text-[#a07850]'}`} />
          <span className="truncate flex-1 text-sm font-semibold">{group.displayName}</span>
          {isPinned && <Pin size={10} className="flex-shrink-0 text-[#f97316]" />}
          <span className="text-xs text-[#a07850]">{visibleFiles.length}</span>
        </button>

        <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover/mod:opacity-100 transition-opacity">
          <button
            onClick={() => onTogglePin(group.id)}
            title={isPinned ? 'Unpin mod' : 'Pin to top'}
            className={`p-1 rounded transition-colors ${
              isPinned ? 'text-[#f97316]' : 'text-[#a07850] hover:text-[#5a3a1a] hover:bg-[#dbd2c7]'
            }`}
          >
            {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <button
            onClick={() => onSelectMod(group.id)}
            title="View all settings for this mod"
            className={`p-1 rounded transition-colors ${
              isModActive ? 'text-[#f97316]' : 'text-[#a07850] hover:text-[#5a3a1a] hover:bg-[#dbd2c7]'
            }`}
          >
            <Layers size={13} />
          </button>
          {hasChanges && (
            <ResetButton onConfirm={() => onResetMod(group.id)} label={group.displayName} />
          )}
        </div>
      </div>

      {open && (
        <div className="ml-5 mb-1 space-y-0.5">
          {visibleFiles.map((file) => {
            const color = VARIANT_COLOR[file.variant] ?? VARIANT_COLOR.other
            const isSelected = file.filePath === selectedFilePath
            const isDirty = modifiedPaths.has(file.filePath)
            const count = parsedCounts.get(file.filePath)

            return (
              <button
                key={file.filePath}
                onClick={() => onSelectFile(file)}
                className={`w-full flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-md text-left transition-colors ${
                  isSelected
                    ? 'bg-[#f97316]/10 text-[#5a3a1a]'
                    : 'text-[#a07850] hover:text-[#5a3a1a] hover:bg-black/[0.04]'
                }`}
              >
                <FileText size={12} className="flex-shrink-0 text-[#a07850]" />
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                  style={{ color, backgroundColor: `${color}20` }}
                >
                  {file.variant}
                </span>
                {count !== undefined && (
                  <span className="text-[11px] text-[#a07850] ml-auto">{count}</span>
                )}
                {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#e879a0] flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar({
  modpacks, activeModpackId, modGroups, selectedFilePath, selectedModId,
  modifiedPaths, parsedCounts, pinnedModIds, modsWithChanges,
  onSelectModpack, onAddModpack, onRemoveModpack, onSelectFile, onSelectMod, onResetMod, onTogglePin,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [modSearch, setModSearch] = useState('')
  const [hideEmpty, setHideEmpty] = useState(false)
  const [variantFilter, setVariantFilter] = useState('all')

  const filteredGroups = useMemo(() => {
    const q = modSearch.toLowerCase().trim()
    const matched = modGroups.filter((g) =>
      !q ||
      g.displayName.toLowerCase().includes(q) ||
      g.files.some((f) => f.fileName.toLowerCase().includes(q))
    )
    return [...matched].sort((a, b) => {
      const ap = pinnedModIds.includes(a.id) ? 0 : 1
      const bp = pinnedModIds.includes(b.id) ? 0 : 1
      return ap - bp
    })
  }, [modGroups, modSearch, pinnedModIds])

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col border-r border-[#dbd2c7] bg-[#ede8e1] min-h-0">
      {/* Modpacks */}
      <div className="flex-shrink-0 border-b border-[#dbd2c7]">
        <div className="flex items-center px-4 pt-3 pb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#a07850] flex-1">Modpacks</span>
          <button
            onClick={onAddModpack}
            title="Add modpack"
            className="w-6 h-6 flex items-center justify-center rounded text-[#a07850] hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="pb-3 px-2 space-y-0.5">
          {modpacks.length === 0 && (
            <p className="text-xs text-[#a07850] text-center py-2">
              Click <span className="text-[#5a3a1a]">+</span> to add a modpack
            </p>
          )}
          {modpacks.map((mp) => (
            <div
              key={mp.id}
              className="relative group/mp"
              onMouseEnter={() => setHoveredId(mp.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => onSelectModpack(mp.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                  activeModpackId === mp.id
                    ? 'bg-[#f97316]/10 text-[#5a3a1a]'
                    : 'text-[#7a5530] hover:text-[#5a3a1a] hover:bg-black/[0.04]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                  activeModpackId === mp.id ? 'bg-[#f97316]' : 'bg-[#dbd2c7]'
                }`} />
                <span className="truncate flex-1 font-medium">{mp.name}</span>
              </button>
              {hoveredId === mp.id && (
                <button
                  onClick={() => onRemoveModpack(mp.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a07850] hover:text-[#dc2626] transition-colors p-1"
                  title="Remove"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Files */}
      {activeModpackId && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2 border-b border-[#d0c8be]">
            <div className="flex items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-[#a07850] flex-1">Files</span>
              <span className="text-xs text-[#a07850]">{modGroups.length} mods</span>
            </div>

            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a07850]" />
              <input
                type="text"
                placeholder="Filter mods…"
                value={modSearch}
                onChange={(e) => setModSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-sm bg-white border border-[#dbd2c7] rounded-lg text-[#1a1108] placeholder-[#a07850] focus:outline-none focus:border-[#f97316]/40 transition-colors"
              />
            </div>

            <button
              onClick={() => setHideEmpty((v) => !v)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors w-full text-left ${
                hideEmpty
                  ? 'bg-[#fff3e8] border-[#f97316]/40 text-[#f97316] font-medium'
                  : 'bg-white border-[#dbd2c7] text-[#7a5530] hover:text-[#5a3a1a]'
              }`}
            >
              {hideEmpty ? '✓ ' : ''}Hide empty configs
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07850] mb-1 block">Variant</span>
              <div className="flex rounded-lg border border-[#dbd2c7] overflow-hidden">
                {['all', 'client', 'server', 'common'].map((v, i) => (
                  <button
                    key={v}
                    onClick={() => setVariantFilter(v)}
                    className={`flex-1 py-1.5 text-xs capitalize transition-colors ${
                      i > 0 ? 'border-l border-[#dbd2c7]' : ''
                    } ${
                      variantFilter === v
                        ? 'bg-[#f97316] text-white font-semibold'
                        : 'bg-white text-[#7a5530] hover:bg-[#f6f2ec]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-1 space-y-0.5">
            {filteredGroups.length === 0 && (
              <p className="text-sm text-[#a07850] text-center py-6">
                {modSearch ? 'No mods match your search' : 'No config files found'}
              </p>
            )}
            {filteredGroups.map((g) => (
              <ModGroupItem
                key={g.id}
                group={g}
                selectedFilePath={selectedFilePath}
                selectedModId={selectedModId}
                modifiedPaths={modifiedPaths}
                parsedCounts={parsedCounts}
                hideEmpty={hideEmpty}
                variantFilter={variantFilter}
                isPinned={pinnedModIds.includes(g.id)}
                hasChanges={modsWithChanges.has(g.id)}
                onSelectFile={onSelectFile}
                onSelectMod={onSelectMod}
                onResetMod={onResetMod}
                onTogglePin={onTogglePin}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

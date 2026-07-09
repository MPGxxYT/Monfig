import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import type { ConfigSetting } from '../types'

function parseItems(rawValue: string): string[] {
  if (!rawValue || rawValue === '[]') return []
  try {
    const parsed = JSON.parse(rawValue)
    // Objects/nested arrays keep their JSON form so round-tripping doesn't mangle them
    if (Array.isArray(parsed)) return parsed.map((v) => typeof v === 'string' ? v : JSON.stringify(v))
  } catch { /* fall through */ }
  const trimmed = rawValue.replace(/^\[|\]$/g, '').trim()
  if (!trimmed) return []
  return trimmed.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))
}

function serializeItems(items: string[], originalRaw: string): string {
  let original: unknown[] = []
  try {
    const parsed = JSON.parse(originalRaw)
    if (Array.isArray(parsed)) original = parsed
  } catch { /* fall through */ }

  const allNumbers = original.length > 0 && original.every((v) => typeof v === 'number')
  const allStrings = original.length === 0 || original.every((v) => typeof v === 'string')

  const values = items.map((s) => {
    if (allNumbers) { const n = Number(s); return isNaN(n) ? s : n }
    if (allStrings) return s
    // Mixed/object arrays: restore each item's JSON value where possible
    try { return JSON.parse(s) } catch { return s }
  })
  return JSON.stringify(values)
}

interface Props {
  setting: ConfigSetting
  anchorRect: DOMRect
  onSave: (key: string, sectionPath: string[], value: string) => void
  onClose: () => void
}

export function ArrayEditor({ setting, anchorRect, onSave, onClose }: Props) {
  const [items, setItems] = useState<string[]>(() => parseItems(setting.rawValue))
  const [newItem, setNewItem] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Position below the anchor, clamped to viewport
  const gap = 6
  const panelW = 288
  const panelMaxH = 320
  const vw = window.innerWidth
  const vh = window.innerHeight
  const top = anchorRect.bottom + gap + panelMaxH > vh
    ? Math.max(8, anchorRect.top - panelMaxH - gap)
    : anchorRect.bottom + gap
  const left = Math.min(Math.max(8, anchorRect.left), vw - panelW - 8)

  function addItem() {
    const v = newItem.trim()
    if (!v) return
    setItems((prev) => [...prev, v])
    setNewItem('')
    newInputRef.current?.focus()
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, val: string) {
    setItems((prev) => prev.map((s, idx) => (idx === i ? val : s)))
  }

  function handleSave() {
    onSave(setting.key, setting.sectionPath, serializeItems(items, setting.rawValue))
    onClose()
  }

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" />

      <div
        ref={panelRef}
        className="fixed z-50 bg-white border border-[#dbd2c7] rounded-xl shadow-2xl flex flex-col"
        style={{ top, left, width: panelW }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[#dbd2c7]">
          <span className="text-sm font-semibold text-[#1a1108] flex-1 truncate">{setting.label}</span>
          <button onClick={onClose} className="text-[#a07850] hover:text-[#1a1108] transition-colors p-0.5">
            <X size={13} />
          </button>
        </div>

        {/* Item list */}
        <div className="overflow-y-auto px-2 py-2 space-y-1.5" style={{ maxHeight: 200 }}>
          {items.length === 0 && (
            <p className="text-xs text-[#a07850] text-center py-3">No items — add one below</p>
          )}
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#c0aa90] w-5 text-right flex-shrink-0 font-mono select-none">{i + 1}</span>
              <input
                type="text"
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') newInputRef.current?.focus() }}
                className="flex-1 px-2.5 py-1.5 text-sm bg-[#eee8e0] text-[#1a1108] font-mono rounded-lg border border-transparent focus:outline-none focus:border-[#f97316]/50 transition-colors"
              />
              <button
                onClick={() => removeItem(i)}
                className="flex-shrink-0 text-[#c0aa90] hover:text-[#dc2626] transition-colors p-0.5"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Add new item */}
        <div className="px-2 pt-1.5 pb-2 border-t border-[#dbd2c7] space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#c0aa90] w-5 text-right flex-shrink-0 font-mono select-none">+</span>
            <input
              ref={newInputRef}
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
              placeholder="New item…"
              className="flex-1 px-2.5 py-1.5 text-sm bg-[#eee8e0] text-[#1a1108] font-mono rounded-lg border border-transparent focus:outline-none focus:border-[#f97316]/50 transition-colors placeholder-[#a07850]"
            />
            <button
              onClick={addItem}
              disabled={!newItem.trim()}
              className="flex-shrink-0 p-1.5 rounded-lg bg-[#f97316] text-white hover:bg-[#ea6c0a] disabled:opacity-40 disabled:cursor-default transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>

          <div className="flex gap-2 px-0.5">
            <button
              onClick={onClose}
              className="flex-1 py-1.5 text-xs text-[#7a5530] rounded-lg border border-[#dbd2c7] hover:bg-[#f6f2ec] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-1.5 text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea6c0a] rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

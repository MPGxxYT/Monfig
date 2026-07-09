import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ConfigSetting } from '../types'

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = '0px'
  el.style.height = `${el.scrollHeight + 2}px`
}

interface Props {
  setting: ConfigSetting
  anchorRect: DOMRect
  onSave: (value: string) => void
  onClose: () => void
}

export function StringEditor({ setting, anchorRect, onSave, onClose }: Props) {
  const [value, setValue] = useState(String(setting.value))
  const panelRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Focus with the cursor at the end, sized to fit the content
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    autoGrow(el)
  }, [])

  // Position below the anchor, clamped to viewport
  const gap = 6
  const panelW = Math.min(Math.max(anchorRect.width, 300), 480)
  const estH = 150
  const vw = window.innerWidth
  const vh = window.innerHeight
  const top = anchorRect.bottom + gap + estH > vh
    ? Math.max(8, anchorRect.top - estH - gap)
    : anchorRect.bottom + gap
  const left = Math.min(Math.max(8, anchorRect.left), vw - panelW - 8)

  function handleSave() {
    onSave(value)
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

        {/* Value */}
        <div className="px-2 pt-2">
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={(e) => { setValue(e.target.value.replace(/\n/g, '')); autoGrow(e.target) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
            className="w-full px-2.5 py-1.5 text-sm bg-[#eee8e0] text-[#1a1108] font-mono rounded-lg border border-transparent focus:outline-none focus:border-[#f97316]/50 transition-colors resize-none overflow-hidden [overflow-wrap:anywhere]"
            style={{ maxHeight: 220 }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-2 pt-1.5 pb-2">
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
    </>
  )
}

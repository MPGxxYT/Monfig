import { useState, useRef, useEffect } from 'react'
import type { ConfigSetting } from '../types'
import { OverlayPanel } from './OverlayPanel'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus with the cursor at the end, sized to fit the content
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    autoGrow(el)
  }, [])

  // Re-fit when the panel is resized horizontally
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    let lastW = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastW) {
        lastW = el.clientWidth
        autoGrow(el)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function handleSave() {
    onSave(value)
    onClose()
  }

  return (
    <OverlayPanel
      title={setting.label}
      anchorRect={anchorRect}
      initialWidth={Math.min(Math.max(anchorRect.width, 300), 480)}
      onClose={onClose}
      footer={
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
      }
    >
      <div className="px-2 pt-2 pb-1">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          onChange={(e) => { setValue(e.target.value.replace(/\n/g, '')); autoGrow(e.target) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
          className="w-full px-2.5 py-1.5 text-sm bg-[#eee8e0] text-[#1a1108] font-mono rounded-lg border border-transparent focus:outline-none focus:border-[#f97316]/50 transition-colors resize-none overflow-hidden [overflow-wrap:anywhere]"
        />
      </div>
    </OverlayPanel>
  )
}

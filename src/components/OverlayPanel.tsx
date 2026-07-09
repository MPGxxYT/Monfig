import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

const MIN_W = 260
const MIN_H = 150

interface Props {
  title: string
  anchorRect: DOMRect
  initialWidth: number
  onClose: () => void
  /** Pinned below the scrollable body (action buttons, add-item rows). */
  footer?: React.ReactNode
  children: React.ReactNode
}

/**
 * Floating editor panel anchored to a field: drag the header to move it,
 * drag the corner triangle to resize. Body scrolls; footer stays pinned.
 */
export function OverlayPanel({ title, anchorRect, initialWidth, onClose, footer, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(() => {
    const gap = 6
    const estH = 320
    const vw = window.innerWidth
    const vh = window.innerHeight
    const top = anchorRect.bottom + gap + estH > vh
      ? Math.max(8, anchorRect.top - estH - gap)
      : anchorRect.bottom + gap
    const left = Math.min(Math.max(8, anchorRect.left), vw - initialWidth - 8)
    return { top, left }
  })
  // h === null → auto height (body capped); set once the user resizes
  const [size, setSize] = useState<{ w: number; h: number | null }>({ w: initialWidth, h: null })

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

  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startPos = pos
    const w = panelRef.current?.getBoundingClientRect().width ?? initialWidth
    const move = (ev: MouseEvent) => {
      setPos({
        // Keep at least a grabbable sliver of the header on screen
        top: Math.min(Math.max(0, startPos.top + ev.clientY - startY), window.innerHeight - 40),
        left: Math.min(Math.max(60 - w, startPos.left + ev.clientX - startX), window.innerWidth - 60),
      })
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const rect = panelRef.current!.getBoundingClientRect()
    const startW = rect.width
    const startH = rect.height
    const move = (ev: MouseEvent) => {
      setSize({
        w: Math.max(MIN_W, startW + ev.clientX - startX),
        h: Math.max(MIN_H, startH + ev.clientY - startY),
      })
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" />

      <div
        ref={panelRef}
        className="fixed z-50 bg-white border border-[#dbd2c7] rounded-xl shadow-2xl flex flex-col"
        style={{ top: pos.top, left: pos.left, width: size.w, height: size.h ?? undefined }}
      >
        {/* Header — drag to move */}
        <div
          onMouseDown={startDrag}
          title="Drag to move"
          className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[#dbd2c7] cursor-move select-none flex-shrink-0"
        >
          <span className="text-sm font-semibold text-[#1a1108] flex-1 truncate">{title}</span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="text-[#a07850] hover:text-[#1a1108] transition-colors p-0.5 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ maxHeight: size.h === null ? 240 : undefined }}
        >
          {children}
        </div>

        {footer && <div className="flex-shrink-0">{footer}</div>}

        {/* Resize grip */}
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 cursor-nwse-resize text-[#c0aa90] hover:text-[#7a5530] transition-colors"
        >
          <svg viewBox="0 0 10 10" className="w-full h-full">
            <path d="M10 2 L10 10 L2 10 Z" fill="currentColor" />
          </svg>
        </div>
      </div>
    </>
  )
}

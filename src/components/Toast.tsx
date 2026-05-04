import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

export interface ToastData {
  id: string
  message: string
  action?: { label: string; onClick: () => void }
  duration?: number
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), toast.duration ?? 4500)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  return (
    <div className="animate-toast-in flex items-center gap-3 bg-[#1c1208] text-[#f6f2ec] pl-4 pr-3 py-3 rounded-xl shadow-2xl max-w-xs text-sm border border-white/10">
      <span className="flex-1 leading-snug">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => { toast.action!.onClick(); onDismiss(toast.id) }}
          className="flex-shrink-0 text-[#f97316] hover:text-[#fba85a] font-semibold whitespace-nowrap transition-colors text-xs"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-0.5 text-[#6b5540] hover:text-[#f6f2ec] transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  )
}

interface ContainerProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ContainerProps) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[60] pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const addToast = useCallback((data: Omit<ToastData, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...data, id }])
    return id
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}

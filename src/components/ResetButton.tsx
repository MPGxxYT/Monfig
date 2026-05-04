import { useState, useEffect, useRef } from 'react'
import { RotateCcw } from 'lucide-react'

interface Props {
  onConfirm: () => void
  label?: string
  disabled?: boolean
  className?: string
}

export function ResetButton({ onConfirm, label, disabled, className = '' }: Props) {
  const [pending, setPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (disabled) return
    if (pending) {
      clearTimeout(timer.current)
      setPending(false)
      onConfirm()
    } else {
      setPending(true)
      timer.current = setTimeout(() => setPending(false), 2500)
    }
  }

  if (disabled) return null

  return (
    <button
      onClick={handleClick}
      title={pending ? 'Click again to confirm reset' : label ? `Reset ${label} to defaults` : 'Reset to default'}
      className={`flex items-center gap-1 transition-all rounded px-1.5 py-0.5 text-xs ${
        pending
          ? 'text-[#f97316] bg-[#fff3e8] border border-[#f97316]/30'
          : 'text-[#a07850] hover:text-[#5a3a1a] hover:bg-[#dbd2c7]'
      } ${className}`}
    >
      <RotateCcw size={11} className={pending ? 'animate-spin' : ''} style={{ animationDuration: '1s' }} />
      {pending && <span>{label ? `Reset ${label}?` : 'Confirm?'}</span>}
    </button>
  )
}

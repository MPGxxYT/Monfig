import { useEffect, useRef, useState } from 'react'
import { Edit3 } from 'lucide-react'
import type { ConfigSetting } from '../types'
import { isSettingChanged } from '../types'
import { ResetButton } from './ResetButton'
import { ArrayEditor } from './ArrayEditor'

function Tip({ label, children, padClass = 'px-2.5' }: {
  label: string
  children: React.ReactNode
  padClass?: string
}) {
  return (
    <span className={`relative group/tip flex items-center h-full ${padClass}`}>
      {children}
      <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-[#1a1108] text-[#f6f2ec] text-[11px] font-mono rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-30 shadow-lg">
        {label}
      </span>
    </span>
  )
}

function truncateNum(n: number, maxLen = 5): string {
  if (!isFinite(n)) return '∞'
  const s = String(n)
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s
}

interface Props {
  setting: ConfigSetting
  onChange: (key: string, sectionPath: string[], value: boolean | number | string) => void
  onReset?: (key: string, sectionPath: string[]) => void
  highlighted?: boolean
}

export function SettingField({ setting, onChange, onReset, highlighted }: Props) {
  const [localStr, setLocalStr] = useState(String(setting.value))
  const [arrayEditorOpen, setArrayEditorOpen] = useState(false)
  const arrayAnchorRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Stable id for scroll-to targeting
  const settingId = `setting-${setting.sectionPath.join('_')}_${setting.key}`.replace(/[^a-zA-Z0-9_-]/g, '_')

  useEffect(() => {
    if (setting.valueType === 'integer' || setting.valueType === 'float') {
      const parsed = parseFloat(localStr)
      if (!isNaN(parsed) && parsed === setting.value) return
    }
    setLocalStr(String(setting.value))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setting.value, setting.key, setting.sectionPath.join('.')])

  // Re-trigger card flash whenever highlighted flips to true
  useEffect(() => {
    if (!highlighted || !cardRef.current) return
    const el = cardRef.current
    el.classList.remove('animate-card-flash')
    // Force reflow so removing+re-adding the class actually restarts the animation
    void el.offsetWidth
    el.classList.add('animate-card-flash')
  }, [highlighted])

  function emit(v: boolean | number | string) {
    onChange(setting.key, setting.sectionPath, v)
  }

  function handleNumberChange(s: string) {
    setLocalStr(s)
    const n = parseFloat(s)
    if (!isNaN(n)) emit(n)
  }

  const { valueType, allowedValues, description, defaultValue, range } = setting
  const isBoolean = valueType === 'boolean'
  const isNumber = valueType === 'integer' || valueType === 'float'
  const hasOptions = allowedValues && allowedValues.length > 0
  const isArray = valueType === 'array'
  const isChanged = isSettingChanged(setting)

  const rangeInfo = range ? (() => {
    const minStr = String(range.min)
    const maxFull = isFinite(range.max) ? String(range.max) : '∞'
    const maxShort = truncateNum(isFinite(range.max) ? range.max : Infinity)
    const truncated = maxShort !== maxFull
    return { display: `${minStr} – ${maxShort}`, full: `${minStr} – ${maxFull}`, truncated }
  })() : null

  const rightSection = (rangeInfo || defaultValue) ? (
    <div className="flex items-stretch divide-x divide-[#c8bfb5] bg-[#d9d0c5] border-l border-[#c8bfb5] rounded-r-lg flex-shrink-0">
      {rangeInfo && (
        rangeInfo.truncated ? (
          <Tip label={rangeInfo.full}>
            <span className="text-xs text-[#5a4030] whitespace-nowrap">{rangeInfo.display}</span>
          </Tip>
        ) : (
          <span className="flex items-center px-2.5 text-xs text-[#5a4030] whitespace-nowrap">
            {rangeInfo.display}
          </span>
        )
      )}
      {defaultValue && (
        <Tip label={`Default: ${defaultValue}`} padClass="px-2">
          <span className="text-xs font-mono text-[#7a5530] hover:text-[#5a3a1a] cursor-default select-none">D</span>
        </Tip>
      )}
    </div>
  ) : null

  const barLeft = rightSection ? 'rounded-l-lg' : 'rounded-lg'

  return (
    <div
      id={settingId}
      ref={cardRef}
      className="bg-white border border-[#dbd2c7] rounded-xl p-4 flex flex-col gap-3 hover:border-[#c0aa90] hover:shadow-sm transition-all"
    >
      {/* Title + description */}
      <div className="flex-1">
        <p title={setting.key} className="text-[15px] font-bold text-[#1a1108] leading-snug">
          {setting.label}
        </p>
        {description && (
          <p className="text-[13px] text-[#7a5530] mt-1.5 leading-relaxed line-clamp-3">
            {description}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">

        {isBoolean && (
          <>
            <button
              onClick={() => emit(!setting.value)}
              className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] ${
                setting.value ? 'bg-[#4ade80]' : 'bg-[#f87171]'
              }`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                setting.value ? 'left-[calc(100%-24px)]' : 'left-1'
              }`} />
            </button>
            {defaultValue && (
              <div className="flex rounded-lg border border-[#dbd2c7] h-9">
                <Tip label={`Default: ${defaultValue}`} padClass="px-2">
                  <span className="text-xs font-mono text-[#7a5530] hover:text-[#5a3a1a] cursor-default select-none">D</span>
                </Tip>
              </div>
            )}
          </>
        )}

        {isNumber && !hasOptions && (
          <div className="flex-1 flex h-9 rounded-lg border border-[#dbd2c7]">
            <div className={`flex-1 overflow-hidden ${barLeft}`}>
              <input
                type="number"
                value={localStr}
                min={range?.min}
                max={range && isFinite(range.max) ? range.max : undefined}
                step="any"
                onChange={(e) => handleNumberChange(e.target.value)}
                className="w-full h-full px-3 text-sm bg-[#eee8e0] text-[#1a1108] font-mono focus:outline-none"
              />
            </div>
            {rightSection}
          </div>
        )}

        {hasOptions && !isBoolean && (
          <div className="flex-1 flex h-9 rounded-lg border border-[#dbd2c7]">
            <div className={`flex-1 overflow-hidden ${barLeft}`}>
              <select
                value={String(setting.value)}
                onChange={(e) => emit(e.target.value)}
                className="w-full h-full px-3 text-sm bg-[#eee8e0] text-[#1a1108] focus:outline-none"
              >
                {allowedValues!.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {rightSection}
          </div>
        )}

        {!isBoolean && !isNumber && !hasOptions && !isArray && (
          <div className="flex-1 flex h-9 rounded-lg border border-[#dbd2c7]">
            <div className={`flex-1 overflow-hidden ${barLeft}`}>
              <input
                type="text"
                value={localStr}
                onChange={(e) => { setLocalStr(e.target.value); emit(e.target.value) }}
                className="w-full h-full px-3 text-sm bg-[#eee8e0] text-[#1a1108] font-mono focus:outline-none"
              />
            </div>
            {rightSection}
          </div>
        )}

        {isArray && (
          <div className="flex-1 flex h-9 rounded-lg border border-[#dbd2c7] relative" ref={arrayAnchorRef}>
            <button
              onClick={() => setArrayEditorOpen((o) => !o)}
              className={`flex-1 flex items-center gap-2 px-3 text-sm bg-[#eee8e0] rounded-l-lg hover:bg-[#e5ddd5] transition-colors text-left group/arr ${rightSection ? '' : 'rounded-r-lg'}`}
              title="Click to edit array"
            >
              <span className="flex-1 font-mono text-[#1a1108] truncate">
                {setting.rawValue.length > 22 ? setting.rawValue.slice(0, 22) + '…' : setting.rawValue || '[]'}
              </span>
              <Edit3 size={11} className="text-[#a07850] group-hover/arr:text-[#5a3a1a] transition-colors flex-shrink-0" />
            </button>
            {rightSection}
            {arrayEditorOpen && arrayAnchorRef.current && (
              <ArrayEditor
                setting={setting}
                anchorRect={arrayAnchorRef.current.getBoundingClientRect()}
                onSave={(_key, _path, value) => emit(value)}
                onClose={() => setArrayEditorOpen(false)}
              />
            )}
          </div>
        )}

        {onReset && isChanged && (
          <ResetButton
            onConfirm={() => onReset(setting.key, setting.sectionPath)}
            className="flex-shrink-0"
          />
        )}
      </div>
    </div>
  )
}

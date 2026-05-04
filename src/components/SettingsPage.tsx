import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Search, FileX } from 'lucide-react'
import type { ParsedFile, ConfigSection, HighlightedSetting } from '../types'
import { isSettingChanged } from '../types'
import { SettingField } from './SettingField'
import { ResetButton } from './ResetButton'

interface Props {
  file: ParsedFile
  onChangeSetting: (key: string, sectionPath: string[], value: boolean | number | string) => void
  onResetSetting: (key: string, sectionPath: string[]) => void
  onResetSection: (sectionPath: string[]) => void
  onResetFile: () => void
  searchQuery?: string
  highlightedSetting?: HighlightedSetting | null
}

export interface SettingsPageHandle {
  focusSearch: (initialChar?: string) => void
}

interface SectionGroup {
  topKey: string
  label: string
  sections: ConfigSection[]
  totalSettings: number
}

function buildGroups(sections: ConfigSection[]): SectionGroup[] {
  const map = new Map<string, SectionGroup>()
  for (const sec of sections) {
    const topKey = sec.path[0] ?? '__root__'
    const label = topKey === '__root__' ? 'General'
      : topKey.charAt(0).toUpperCase() + topKey.slice(1)
    const g = map.get(topKey)
    if (g) { g.sections.push(sec); g.totalSettings += sec.settings.length }
    else map.set(topKey, { topKey, label, sections: [sec], totalSettings: sec.settings.length })
  }
  return Array.from(map.values()).filter((g) => g.totalSettings > 0)
}

function SectionBlock({ section, searchQuery, highlightKey, onChangeSetting, onResetSetting, onResetSection }: {
  section: ConfigSection
  searchQuery: string
  highlightKey?: string | null
  onChangeSetting: Props['onChangeSetting']
  onResetSetting: Props['onResetSetting']
  onResetSection: Props['onResetSection']
}) {
  const q = searchQuery.toLowerCase()
  const visible = section.settings.filter((s) => {
    if (!q) return true
    return s.label.toLowerCase().includes(q)
      || s.key.toLowerCase().includes(q)
      || s.description.toLowerCase().includes(q)
      || String(s.value).toLowerCase().includes(q)
  })
  if (visible.length === 0) return null
  const hasSectionChanges = visible.some((s) => isSettingChanged(s))

  return (
    <div className="mb-4">
      {section.path.length > 1 && (
        <div className="flex items-center gap-3 px-5 pt-3 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#a07850]">
            {section.path.join(' › ')}
          </span>
          {hasSectionChanges && (
            <ResetButton
              onConfirm={() => onResetSection(section.path)}
              label="section"
            />
          )}
        </div>
      )}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {visible.map((setting) => (
          <SettingField
            key={setting.key}
            setting={setting}
            onChange={onChangeSetting}
            onReset={onResetSetting}
            highlighted={highlightKey === setting.key}
          />
        ))}
      </div>
    </div>
  )
}

export const SettingsPage = forwardRef<SettingsPageHandle, Props>(function SettingsPage(
  { file, onChangeSetting, onResetSetting, onResetSection, onResetFile, searchQuery = '', highlightedSetting },
  ref,
) {
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [localSearch, setLocalSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const groups = useMemo(() => buildGroups(file.sections), [file.sections])
  const currentTab = (activeTab && groups.find((g) => g.topKey === activeTab))
    ? activeTab : (groups[0]?.topKey ?? null)

  const effectiveSearch = searchQuery || localSearch
  const groupsToShow = effectiveSearch ? groups : groups.filter((g) => g.topKey === currentTab)
  const totalSettings = file.sections.reduce((n, s) => n + s.settings.length, 0)
  const hasAnyChanged = file.sections.some((s) => s.settings.some((st) => isSettingChanged(st)))

  // Expose focus method to parent via ref
  useImperativeHandle(ref, () => ({
    focusSearch: (initialChar?: string) => {
      if (initialChar !== undefined) setLocalSearch(initialChar)
      requestAnimationFrame(() => searchInputRef.current?.focus())
    },
  }), [])

  // Navigate to highlighted setting: switch tab + scroll to card
  useEffect(() => {
    if (!highlightedSetting || highlightedSetting.filePath !== file.filePath) return

    const tabKey = highlightedSetting.sectionPath[0] ?? '__root__'
    const matchingGroup = groups.find((g) => g.topKey === tabKey)
    if (matchingGroup) setActiveTab(matchingGroup.topKey)

    // Clear local search so the card is visible, then scroll to it
    setLocalSearch('')

    const settingId = `setting-${highlightedSetting.sectionPath.join('_')}_${highlightedSetting.key}`.replace(/[^a-zA-Z0-9_-]/g, '_')
    setTimeout(() => {
      const el = document.getElementById(settingId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }, [highlightedSetting])  // eslint-disable-line react-hooks/exhaustive-deps

  if (totalSettings === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <FileX size={44} className="text-[#dbd2c7]" strokeWidth={1.5} />
        <p className="text-lg font-semibold text-[#7a5530]">No editable settings</p>
        <p className="text-sm text-[#a07850] max-w-sm leading-relaxed">
          {file.fileType === 'json'
            ? 'This JSON file has no primitive settings — it may contain only nested objects or arrays.'
            : 'This file has no recognisable key-value settings, or contains only unsupported structures like arrays.'}
        </p>
        <code className="text-xs text-[#a07850] bg-[#f6f2ec] border border-[#dbd2c7] rounded px-3 py-1.5">
          {file.fileName}
        </code>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-0 border-b border-[#dbd2c7]">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-[#1a1108]">{file.fileName}</h2>
          <span className="text-sm text-[#7a5530] bg-[#f6f2ec] border border-[#dbd2c7] rounded-full px-2.5 py-0.5">
            {totalSettings} settings
          </span>
          {file.modified && (
            <span className="text-sm text-[#e879a0] bg-[#e879a0]/10 border border-[#e879a0]/30 rounded-full px-2.5 py-0.5">
              unsaved
            </span>
          )}
          {hasAnyChanged && (
            <ResetButton onConfirm={onResetFile} label="file" className="ml-1" />
          )}

          <div className="relative ml-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a07850]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search settings…"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm bg-[#f6f2ec] border border-[#dbd2c7] rounded-lg text-[#1a1108] placeholder-[#a07850] focus:outline-none focus:border-[#f97316]/50 w-48 transition-colors"
            />
          </div>
        </div>

        {!effectiveSearch && groups.length > 1 && (
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {groups.map((g) => {
              const active = currentTab === g.topKey
              return (
                <button
                  key={g.topKey}
                  onClick={() => setActiveTab(g.topKey)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'text-[#f97316] border-[#f97316]'
                      : 'text-[#a07850] border-transparent hover:text-[#5a3a1a] hover:border-[#dbd2c7]'
                  }`}
                >
                  {g.label}
                  <span className={`text-xs rounded-full px-1.5 py-0.5 transition-colors ${
                    active ? 'bg-[#fff3e8] text-[#f97316]' : 'bg-[#f6f2ec] text-[#a07850]'
                  }`}>
                    {g.totalSettings}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {!effectiveSearch && groups.length === 1 && (() => {
          const g = groups[0]
          const sectionHasChanges = g.sections.some((s) => s.settings.some((st) => isSettingChanged(st)))
          return (
            <div className="pb-0.5 flex items-center gap-2">
              <span className="text-sm font-medium text-[#a07850]">{g.label}</span>
              {sectionHasChanges && (
                <ResetButton onConfirm={() => onResetSection(g.sections[0].path)} label="section" />
              )}
            </div>
          )
        })()}
        {effectiveSearch && (
          <div className="pb-2">
            <span className="text-sm text-[#7a5530]">
              Results for{' '}
              <span className="text-[#f97316] font-semibold">"{effectiveSearch}"</span>
              {' '}across all sections
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {groupsToShow.map((g) =>
          g.sections.map((sec) => (
            <SectionBlock
              key={sec.path.join('\x00')}
              section={sec}
              searchQuery={effectiveSearch}
              highlightKey={
                highlightedSetting?.filePath === file.filePath
                && highlightedSetting.sectionPath.join('\x00') === sec.path.join('\x00')
                  ? highlightedSetting.key
                  : null
              }
              onChangeSetting={onChangeSetting}
              onResetSetting={onResetSetting}
              onResetSection={onResetSection}
            />
          ))
        )}
        {effectiveSearch && groupsToShow.every((g) =>
          g.sections.every((s) => {
            const q = effectiveSearch.toLowerCase()
            return s.settings.every((st) =>
              !st.label.toLowerCase().includes(q) &&
              !st.key.toLowerCase().includes(q) &&
              !st.description.toLowerCase().includes(q)
            )
          })
        ) && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Search size={32} className="text-[#dbd2c7]" strokeWidth={1.5} />
            <p className="text-base text-[#7a5530]">No settings match "{effectiveSearch}"</p>
          </div>
        )}
      </div>
    </div>
  )
})

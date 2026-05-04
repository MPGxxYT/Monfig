import type { ParsedFile, ModFile, ModGroup, HighlightedSetting } from '../types'
import { SettingsPage } from './SettingsPage'
import { Layers } from 'lucide-react'

interface Props {
  group: ModGroup
  parsedFiles: Map<string, ParsedFile>
  onChangeSetting: (key: string, sectionPath: string[], value: boolean | number | string) => void
  onResetSetting: (key: string, sectionPath: string[]) => void
  onResetSection: (sectionPath: string[]) => void
  onResetFile: (filePath: string) => void
  onOpenFile: (file: ModFile) => void
  highlightedSetting?: HighlightedSetting | null
}

export function ModPage({ group, parsedFiles, onChangeSetting, onResetSetting, onResetSection, onResetFile, onOpenFile, highlightedSetting }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-[#dbd2c7]">
        <div className="flex items-center gap-3">
          <Layers size={18} className="text-[#f97316]" />
          <h2 className="text-xl font-bold text-[#1a1108]">{group.displayName}</h2>
          <span className="text-sm text-[#7a5530] bg-[#f6f2ec] border border-[#dbd2c7] rounded-full px-2.5 py-0.5">
            {group.files.length} files
          </span>
        </div>
      </div>

      {group.files.map((file) => {
        const parsed = parsedFiles.get(file.filePath)
        const total = parsed?.sections.reduce((n, s) => n + s.settings.length, 0) ?? 0
        if (!parsed || total === 0) return null

        return (
          <div key={file.filePath} className="border-b border-[#dbd2c7] last:border-0">
            <button
              onClick={() => onOpenFile(file)}
              className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-black/[0.03] transition-colors"
            >
              <span className="text-base font-bold text-[#1a1108]">{file.fileName}</span>
              <span className="text-xs text-[#7a5530] bg-[#f6f2ec] border border-[#dbd2c7] rounded-full px-2 py-0.5">
                {total} settings
              </span>
              {parsed.modified && (
                <span className="text-xs text-[#e879a0] bg-[#e879a0]/10 border border-[#e879a0]/30 rounded-full px-2 py-0.5">
                  unsaved
                </span>
              )}
            </button>

            <SettingsPage
              file={parsed}
              onChangeSetting={onChangeSetting}
              onResetSetting={onResetSetting}
              onResetSection={onResetSection}
              onResetFile={() => onResetFile(file.filePath)}
              highlightedSetting={highlightedSetting?.filePath === file.filePath ? highlightedSetting : null}
            />
          </div>
        )
      })}
    </div>
  )
}

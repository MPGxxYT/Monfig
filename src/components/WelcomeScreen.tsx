import { FolderOpen, Plus } from 'lucide-react'

interface Props {
  hasModpacks: boolean
  onAddModpack: () => void
}

export function WelcomeScreen({ hasModpacks, onAddModpack }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-12">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-[#1a1108] mb-3 tracking-tight">Monfig</h1>
        <p className="text-base text-[#7a5530]">
          {hasModpacks ? 'Select a modpack from the sidebar to get started.' : 'Add your first modpack to begin.'}
        </p>
      </div>

      <button
        onClick={onAddModpack}
        className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed border-[#dbd2c7] hover:border-[#f97316]/50 bg-white hover:bg-[#fff3e8] transition-all w-80 shadow-sm"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#f6f2ec] group-hover:bg-[#f97316]/10 flex items-center justify-center transition-colors">
          {hasModpacks
            ? <Plus size={32} className="text-[#f97316]" />
            : <FolderOpen size={32} className="text-[#f97316]" />
          }
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-[#1a1108] mb-1">Add Modpack</p>
          <p className="text-sm text-[#7a5530]">
            Point to your modpack's{' '}
            <code className="bg-[#f6f2ec] px-1.5 py-0.5 rounded text-[#5a3a1a] font-mono">\config</code>{' '}
            folder
          </p>
        </div>
      </button>

      <div className="flex flex-wrap gap-2 justify-center">
        {['TOML', 'JSON', 'Properties', 'CFG', 'INI'].map((fmt) => (
          <span key={fmt} className="px-3 py-1 rounded-full text-sm bg-white border border-[#dbd2c7] text-[#a07850]">
            {fmt}
          </span>
        ))}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSystemStatus } from '@/lib/system-status-context'

export function ServerStatusOverlay() {
  const { isOnline, isLoopActive } = useSystemStatus()
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissal when system comes back online
  useEffect(() => {
    if (isOnline && isLoopActive) {
      setDismissed(false)
    }
  }, [isOnline, isLoopActive])

  if (dismissed || (isOnline && isLoopActive)) return null

  const reason = !isOnline ? 'server' : 'loop'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
      <div className="w-full max-w-md p-6 bg-black border-2 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.2)] font-mono relative overflow-hidden">
        {/* Terminal Header */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-yellow-500/20 flex items-center px-2 gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/40" />
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-yellow-500 animate-pulse">&gt;&gt;&gt;</span>
            <h2 className="text-xl font-bold text-yellow-500 uppercase tracking-tighter">
              {reason === 'server' ? 'Inference Server Offline' : 'Dialogue Loop Inactive'}
            </h2>
          </div>

          <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 text-[11px] leading-relaxed text-yellow-500/80">
            <p>CRITICAL_ERROR: Connection to the symbolic processing unit has been lost. Autonomous dialogue generation is suspended.</p>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-terminal-green hover:underline uppercase tracking-widest font-bold"
            >
              [dismiss & view history]
            </button>
            <Link
              href="/about"
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors uppercase tracking-widest font-bold"
            >
              [about]
            </Link>
            <Link
              href="/archive"
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors uppercase tracking-widest font-bold"
            >
              [archive]
            </Link>
          </div>
        </div>

        {/* Scanline effect for this specific box */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </div>
    </div>
  )
}

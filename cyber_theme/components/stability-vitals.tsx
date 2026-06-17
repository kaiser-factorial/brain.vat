'use client'

import { cn } from '@/lib/utils'
import { useSystemStatus } from '@/lib/system-status-context'

interface StabilityVitalsProps {
  bot?: 'a' | 'b'
  className?: string
}

export function StabilityVitals({ bot, className }: StabilityVitalsProps) {
  const { isOnline, settings, isInitializing } = useSystemStatus()

  if (isInitializing) {
    return (
      <div className={cn("flex items-center gap-1 font-mono text-[10px] uppercase opacity-30", className)}>
        <span className="text-muted-foreground mr-2">connection:</span>
        <span className="text-amber-500 font-bold animate-pulse">connecting_</span>
      </div>
    )
  }

  if (!isOnline || !settings) {
    return (
      <div className={cn("flex items-center gap-1 font-mono text-[10px] uppercase opacity-30", className)}>
        <span className="text-muted-foreground mr-2">connection:</span>
        <span className="text-red-500 font-bold">offline</span>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase", className)}>
      {(!bot || bot === 'a') && (
        <div className="flex items-center gap-1 group">
          <span className="text-muted-foreground opacity-50">temp_a:</span>
          <span className="text-mauk animate-pulse font-bold">{settings.temperature_a.toFixed(2)}</span>
        </div>
      )}
      {(!bot || bot === 'b') && (
        <div className="flex items-center gap-1 group">
          <span className="text-muted-foreground opacity-50">temp_b:</span>
          <span className="text-abaci animate-pulse font-bold">{settings.temperature_b.toFixed(2)}</span>
        </div>
      )}
      <div className="flex items-center gap-1 group">
        <span className="text-muted-foreground opacity-50">top_p:</span>
        <span className="text-terminal-green/80">{settings.top_p.toFixed(2)}</span>
      </div>
      {!bot && (
        <div className="hidden sm:block ml-2 px-1 bg-terminal-green/10 text-terminal-green scale-75 border border-terminal-green/30">
          stable_state
        </div>
      )}
    </div>
  )
}

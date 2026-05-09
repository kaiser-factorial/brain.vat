'use client'

import { useVoiceMode } from './voice-mode-context'

export function VoiceToggle() {
  const { isVoiceActive, toggleVoice } = useVoiceMode()

  return (
    <button
      onClick={toggleVoice}
      className={`flex items-center gap-1.5 text-xs font-mono transition-colors cursor-pointer ${
        isVoiceActive
          ? 'text-amber-400 hover:text-amber-300'
          : 'text-muted-foreground hover:text-primary'
      }`}
      title={isVoiceActive ? 'Voice mode on — click to disable' : 'Click to enable voice mode'}
    >
      {isVoiceActive && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
      )}
      {isVoiceActive ? '[voice: on]' : '[voice: off]'}
    </button>
  )
}

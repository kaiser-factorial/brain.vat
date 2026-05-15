'use client'

import { useVoiceMode } from './voice-mode-context'
import { CyberCheckbox } from 'ccru/components'

export function VoiceToggle() {
  const { isVoiceActive, toggleVoice } = useVoiceMode()

  return (
    <CyberCheckbox
      checked={isVoiceActive}
      onChange={toggleVoice}
      label="Voice Mode"
      accent="#10ff50"
    />
  )
}

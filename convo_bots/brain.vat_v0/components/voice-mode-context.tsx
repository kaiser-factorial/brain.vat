'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { Message } from '@/lib/types'

// ── Context shape ─────────────────────────────────────────────────────────────

interface VoiceModeContextValue {
  isVoiceActive: boolean
  toggleVoice: () => void
  speakMessage: (message: Message) => void
}

const VoiceModeContext = createContext<VoiceModeContextValue>({
  isVoiceActive: false,
  toggleVoice:   () => {},
  speakMessage:  () => {},
})

// ── Provider ──────────────────────────────────────────────────────────────────

export function VoiceModeProvider({ children }: { children: React.ReactNode }) {
  const [isVoiceActive, setIsVoiceActive] = useState(false)

  // Ref mirror so closures inside realtime callbacks never go stale
  const isVoiceActiveRef = useRef(false)

  // Simple sequential queue — one bot can be speaking while another waits
  const queue           = useRef<Message[]>([])
  const isPlaying       = useRef(false)
  const currentAudio    = useRef<HTMLAudioElement | null>(null)
  const currentBlobUrl  = useRef<string | null>(null)

  // ── Playback ────────────────────────────────────────────────────────────────

  const playNext = useCallback(async () => {
    if (isPlaying.current || queue.current.length === 0) return
    if (!isVoiceActiveRef.current) {
      queue.current = []
      return
    }

    isPlaying.current = true
    const message = queue.current.shift()!

    console.log(`[Voice] 🔊 Fetching TTS for ${message.speaker}: "${message.text.slice(0, 60)}..."`)

    try {
      const res = await fetch('/api/tts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: message.text, speaker: message.speaker }),
      })

      console.log(`[Voice] ← /api/tts status=${res.status} content-type=${res.headers.get('content-type')}`)

      if (!res.ok) {
        // Try to read the error JSON from our updated route
        const errBody = await res.text().catch(() => '<unreadable>')
        console.error(`[Voice] ❌ TTS API error (${res.status}):`, errBody)
        isPlaying.current = false
        playNext()
        return
      }

      if (!isVoiceActiveRef.current) {
        isPlaying.current = false
        return
      }

      const blob = await res.blob()
      console.log(`[Voice] ✅ Got audio blob size=${blob.size} type=${blob.type}`)

      if (blob.size === 0) {
        console.error('[Voice] ❌ Empty audio blob received!')
        isPlaying.current = false
        playNext()
        return
      }

      const url   = URL.createObjectURL(blob)
      currentBlobUrl.current = url
      const audio = new Audio(url)
      currentAudio.current = audio

      audio.onended = () => {
        console.log(`[Voice] ✅ Playback finished for ${message.speaker}`)
        URL.revokeObjectURL(url)
        currentBlobUrl.current = null
        currentAudio.current   = null
        isPlaying.current      = false
        playNext()
      }

      audio.onerror = (e) => {
        console.error('[Voice] ❌ Audio playback error:', e)
        URL.revokeObjectURL(url)
        currentBlobUrl.current = null
        currentAudio.current   = null
        isPlaying.current      = false
        playNext()
      }

      console.log(`[Voice] ▶ Playing audio for ${message.speaker}...`)
      await audio.play()
    } catch (err) {
      console.error('[Voice] ❌ Unexpected error in playNext:', err)
      isPlaying.current = false
      playNext()
    }
  }, [])

  // ── Toggle ─────────────────────────────────────────────────────────────────

  const toggleVoice = useCallback(() => {
    setIsVoiceActive(prev => {
      const next = !prev
      isVoiceActiveRef.current = next
      console.log(`[Voice] 🎙 Voice mode ${next ? 'ON' : 'OFF'}`)
      if (!next) {
        queue.current = []
        if (currentAudio.current) {
          currentAudio.current.pause()
          currentAudio.current = null
        }
        if (currentBlobUrl.current) {
          URL.revokeObjectURL(currentBlobUrl.current)
          currentBlobUrl.current = null
        }
        isPlaying.current = false
      }
      return next
    })
  }, [])

  // ── speakMessage ───────────────────────────────────────────────────────────

  const speakMessage = useCallback((message: Message) => {
    console.log(`[Voice] speakMessage called | voiceActive=${isVoiceActiveRef.current} role=${message.role} speaker=${message.speaker}`)
    if (!isVoiceActiveRef.current) return
    if (message.role !== 'bot') return
    if (message.speaker !== 'MAUK' && message.speaker !== 'ABACI') return

    queue.current.push(message)
    playNext()
  }, [playNext])

  return (
    <VoiceModeContext.Provider value={{ isVoiceActive, toggleVoice, speakMessage }}>
      {children}
    </VoiceModeContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVoiceMode() {
  return useContext(VoiceModeContext)
}

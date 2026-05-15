'use client'

import React, { createContext, useCallback, useContext, useRef, useState, useEffect } from 'react'
import type { Message } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

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
  const supabase = createClient()

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

    try {
      const res = await fetch('/api/tts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: message.text, speaker: message.speaker }),
      })

      if (!res.ok) {
        isPlaying.current = false
        playNext()
        return
      }

      if (!isVoiceActiveRef.current) {
        isPlaying.current = false
        return
      }

      const blob = await res.blob()
      if (blob.size === 0) {
        isPlaying.current = false
        playNext()
        return
      }

      const url   = URL.createObjectURL(blob)
      currentBlobUrl.current = url
      const audio = new Audio(url)
      currentAudio.current = audio

      audio.onended = () => {
        URL.revokeObjectURL(url)
        currentBlobUrl.current = null
        currentAudio.current   = null
        isPlaying.current      = false
        playNext()
      }

      audio.onerror = () => {
        URL.revokeObjectURL(url)
        currentBlobUrl.current = null
        currentAudio.current   = null
        isPlaying.current      = false
        playNext()
      }

      await audio.play()
    } catch (err) {
      isPlaying.current = false
      playNext()
    }
  }, [])

  // ── Toggle ─────────────────────────────────────────────────────────────────

  const toggleVoice = useCallback(() => {
    setIsVoiceActive(prev => {
      const next = !prev
      isVoiceActiveRef.current = next
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
    if (!isVoiceActiveRef.current) return
    if (message.role !== 'bot') return
    if (message.speaker !== 'MAUK' && message.speaker !== 'ABACI') return

    queue.current.push(message)
    playNext()
  }, [playNext])

  // ── Background Subscription ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('global-voice')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message
          speakMessage(newMsg)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, speakMessage])

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

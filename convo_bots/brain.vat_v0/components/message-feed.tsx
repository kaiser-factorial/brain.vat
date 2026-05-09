'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Message } from '@/lib/types'
import { MessageBubble } from './message-bubble'
import { MessageInput } from './message-input'
import { toast } from 'sonner'
import { format_user_message } from '@/lib/frontend-message-handlers'
import { useVoiceMode } from './voice-mode-context'

interface MessageFeedProps {
  onAuthClick?: () => void
}

export function MessageFeed({ onAuthClick }: MessageFeedProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSticky, setIsSticky] = useState(true)
  const feedRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { user, displayName } = useAuth()
  const { speakMessage } = useVoiceMode()

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true)
      setError(null)
      try {
        console.log('[MessageFeed] Fetching history...')
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)
        
        if (error) throw error
        
        if (data) {
          console.log(`[MessageFeed] Successfully loaded ${data.length} messages.`)
          // Reverse a copy to appear in chronological order
          setMessages([...data].reverse())
        }
      } catch (err: any) {
        console.error('[MessageFeed] Failed to fetch:', err)
        setError(err.message || 'Unknown connection error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()

    // Subscribe to realtime updates
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: { new: Message }) => {
          const newMsg = payload.new as Message
          setMessages((prev) => [...prev, newMsg])
          speakMessage(newMsg)  // ← VOICE
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Scroll to bottom effect
  useEffect(() => {
    if (isSticky && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [messages, isSticky])

  const handleSendMessage = async (text: string) => {
    if (!user) return

    // Format user message for structured GPT-2 pattern
    const speakerName = displayName || 'USER'
    const formattedText = format_user_message(text, speakerName)

    const { error } = await supabase.from('messages').insert({
      speaker: speakerName,
      text: formattedText,
      role: 'user',
      user_id: user.id
    })

    if (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message: ' + error.message)
      throw error // Re-throw to let MessageInput handle isSending state
    }
  }

  return (
    <div className="flex h-full flex-col relative group">
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
      >
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full opacity-40 animate-pulse font-mono text-xs uppercase tracking-[0.2em] space-y-2">
            <span>retrieving history...</span>
            <div className="w-12 h-1 bg-terminal-green/30" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full text-red-500/60 font-mono text-[10px] uppercase tracking-widest text-center px-8 border border-red-500/20 m-4 bg-red-500/5 p-4">
            <span className="font-bold underline mb-2">CRITICAL FETCH ERROR</span>
            <span>{error}</span>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-2 py-1 border border-red-500/40 hover:bg-red-500/10 transition-colors"
            >
              [retry connection]
            </button>
          </div>
        )}

        {!isLoading && !error && messages.length === 0 && (
          <div className="flex items-center justify-center h-full font-mono text-[10px] uppercase text-muted-foreground tracking-widest">
            no dialogue records found
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {/* Sticky Scroll Toggle Overlay - Positioned just above the input */}
      <div className="flex justify-end px-6 -mb-4 z-10 pointer-events-none">
        <button
          onClick={() => {
            setIsSticky(!isSticky);
            if (!isSticky && feedRef.current) {
               feedRef.current.scrollTop = feedRef.current.scrollHeight;
            }
          }}
          className={`px-3 py-1.5 border flex items-center gap-2 transition-all duration-300 font-mono text-[9px] uppercase tracking-widest pointer-events-auto backdrop-blur-md ${
            isSticky 
              ? 'border-cyan-500/50 text-cyan-500 bg-black/60 shadow-[0_0_15px_rgba(0,245,255,0.1)]' 
              : 'border-[#00441b]/50 text-[#00441b] bg-black/40'
          } hover:border-cyan-500 hover:text-cyan-500`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isSticky ? 'bg-cyan-500 animate-pulse' : 'bg-[#00441b]'}`} />
          {isSticky ? 'STICKY: AUTO' : 'STICKY: MANUAL'}
        </button>
      </div>

      <MessageInput 
        onSend={handleSendMessage} 
        disabled={!user}
        onAuthClick={onAuthClick}
      />
    </div>
  )
}

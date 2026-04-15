'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Message } from '@/lib/types'
import { MessageBubble } from './message-bubble'
import { MessageInput } from './message-input'
import { toast } from 'sonner'
import { format_user_message } from '@/lib/frontend-message-handlers'

interface MessageFeedProps {
  onAuthClick?: () => void
}

export function MessageFeed({ onAuthClick }: MessageFeedProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { user, displayName } = useAuth()

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
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [messages])

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
    <div className="flex h-full flex-col">
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
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

      <MessageInput 
        onSend={handleSendMessage} 
        disabled={!user}
        onAuthClick={onAuthClick}
      />
    </div>
  )
}

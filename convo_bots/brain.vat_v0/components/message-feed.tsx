'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Message } from '@/lib/types'
import { MessageBubble } from './message-bubble'
import { MessageInput } from './message-input'

interface MessageFeedProps {
  onAuthClick?: () => void
}

export function MessageFeed({ onAuthClick }: MessageFeedProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const feedRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { user, displayName } = useAuth()

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)
      
      if (data) {
        setMessages(data)
      }
      setIsLoading(false)
    }

    fetchMessages()

    // Subscribe to realtime updates
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
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

    await supabase.from('messages').insert({
      speaker: displayName || 'anon',
      text,
      role: 'user',
      user_id: user.id
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
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

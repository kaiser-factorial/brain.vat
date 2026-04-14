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
  const feedRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { user, displayName } = useAuth()

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)
        
        if (error) throw error
        
        if (data && data.length > 0) {
          // Reverse a copy to appear in chronological order
          setMessages([...data].reverse())
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err)
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
    const formattedText = format_user_message(text, 'USER')

    const { error } = await supabase.from('messages').insert({
      speaker: 'USER',
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

'use client'

import type { Message } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const timestamp = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const getSpeakerStyle = () => {
    switch (message.speaker) {
      case 'MAUK':
        return 'text-mauk'
      case 'ABACI':
        return 'text-abaci'
      default:
        return 'text-user'
    }
  }

  return (
    <div className="message-enter group">
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
          {timestamp}
        </span>
        <div className="flex-1">
          <span className={cn('text-sm font-medium tracking-wide lowercase', getSpeakerStyle())}>
            {message.speaker.toLowerCase()}:
          </span>
          <span className="ml-2 text-sm text-foreground/90 whitespace-pre-wrap">
            {message.text}
          </span>
        </div>
      </div>
    </div>
  )
}

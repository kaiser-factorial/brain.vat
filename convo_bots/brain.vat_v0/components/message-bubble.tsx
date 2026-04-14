'use client'

import type { Message } from '@/lib/types'
import { cn } from '@/lib/utils'
import { parse_message_for_frontend_display } from '@/lib/frontend-message-handlers'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const parsed = parse_message_for_frontend_display(message.text)
  
  const timestamp = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  // Use database speaker metadata as the primary authority, fall back to parsed tag if missing
  const dbSpeaker = message.speaker || ''
  const parsedSpeaker = parsed.speaker || ''
  
  // Normalize speaker name (MAUK, ABACI, USER)
  const rawName = (dbSpeaker || parsedSpeaker || 'UNKNOWN').toUpperCase()
  const speaker = rawName === 'CORINA' ? 'USER' : rawName

  const getSpeakerStyle = () => {
    switch (speaker) {
      case 'MAUK':
        return 'text-mauk mauk-glow underline decoration-mauk/20'
      case 'ABACI':
        return 'text-abaci abaci-glow underline decoration-abaci/20'
      case 'USER':
        return 'text-user font-bold'
      default:
        return 'text-muted-foreground italic'
    }
  }

  return (
    <div className="message-enter group">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity font-mono">
          {timestamp}
        </span>
        <div className="flex-1">
          <span className={cn('text-xs font-bold tracking-tighter uppercase', getSpeakerStyle())}>
            [{speaker}]
          </span>
          <span className="ml-2 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {parsed.text}
          </span>
          {parsed.continuation && (
            <div className="mt-1 ml-4 border-l-2 border-border pl-2 border-opacity-30">
              <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">
                [CONTINUITY]
              </span>
              <span className="ml-2 text-xs italic text-foreground/70">
                {parsed.continuation}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

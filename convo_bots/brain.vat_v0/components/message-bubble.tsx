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
  let speaker = (dbSpeaker || parsedSpeaker || 'UNKNOWN').toUpperCase()

  // HARD OVERRIDE: Final safety net for the 'Corina' ghost
  if (speaker === 'CORINA') {
    speaker = 'BRICK.FACTORIAL'
  }

  const getSpeakerStyle = () => {
    switch (speaker) {
      case 'MAUK':
        return 'text-mauk'
      case 'ABACI':
        return 'text-abaci'
      default:
        return 'text-user' // blood red for brick.factorial / user
    }
  }

  return (
    <div className="message-enter group">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity font-mono">
          {timestamp}
        </span>
        <div className="flex-1">
          <span className={cn('text-sm font-mono lowercase', getSpeakerStyle())}>
            {speaker.toLowerCase()}:
          </span>
          <div className="ml-2 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {parsed.text.split(/(<think>[\s\S]*?(?:<\/think>|$))/gi).map((part, index) => {
              if (part.toLowerCase().startsWith('<think>')) {
                const thoughtText = part.replace(/<think>/i, '').replace(/<\/think>/i, '');
                return (
                  <span key={index} className="font-bold italic text-foreground/60">
                    {thoughtText}
                  </span>
                );
              }
              return <span key={index}>{part}</span>;
            })}
          </div>
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

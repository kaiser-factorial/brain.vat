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
  
  // Normalize speaker name (MAUK, ABACI, ARCHITECT, ARCHIE, USER)
  let speaker = (dbSpeaker || parsedSpeaker || 'UNKNOWN').toUpperCase()

  // Handle nicknames and overrides
  if (speaker === 'ARCHITECT') {
    speaker = 'ARCHIE'
  }
  if (speaker === 'CORINA') {
    speaker = 'BRICK.FACTORIAL'
  }

  const getSpeakerStyle = () => {
    switch (speaker) {
      case 'MAUK':
        return 'text-mauk'
      case 'ABACI':
        return 'text-abaci'
      case 'ARCHIE':
        return 'text-white font-bold tracking-tight'
      default:
        return 'text-user'
    }
  }

  return (
    <div className="message-enter group">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity font-mono">
          {timestamp}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-mono lowercase', getSpeakerStyle())}>
              {speaker.toLowerCase()}:
            </span>
            {speaker === 'ARCHIE' && (
              <span className="text-[9px] bg-white text-black px-1 font-bold uppercase tracking-tighter">
                architect
              </span>
            )}
          </div>
          
          <span className="ml-2 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {parsed.text}
          </span>

          {/* Archie's Thoughts - Simplified & Structural */}
          {message.thoughts && (
            <div className="mt-2 mb-1 space-y-1">
              {message.thoughts.split('\n').map((thought, i) => {
                const isThinkIn = thought.includes('<think-in>');
                const isThinkOut = thought.includes('<think-out>');
                
                if (!isThinkIn && !isThinkOut) return null;

                const cleanThought = thought.replace(/<[^>]+>/g, '').trim();
                if (!cleanThought) return null;

                return (
                  <div 
                    key={i}
                    className="p-2 bg-foreground text-background italic text-[11px] font-mono leading-tight border-l-4 border-white shadow-inner"
                  >
                    <div className="not-italic font-bold text-[8px] opacity-60 mb-1 tracking-[0.2em] uppercase">
                      ARCHITECT_THOUGHTS
                    </div>
                    {isThinkIn ? (
                      <span className="font-bold">[{cleanThought}]</span>
                    ) : (
                      <span>{cleanThought}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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

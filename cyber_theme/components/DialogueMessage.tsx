'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Speaker = 'MAUK' | 'ABACI' | 'USER' | 'SYSTEM' | string

export interface DialogueMessageProps {
  // Required
  speaker: Speaker          // Who's speaking
  content: string | ReactNode  // Message content

  // Optional appearance
  accentColor?: string      // Speaker color (auto-set if speaker is MAUK/ABACI/USER)
  align?: 'left' | 'right' | 'center'  // Message alignment (default: 'left')
  variant?: 'default' | 'highlight' | 'system'  // Message style (default: 'default')

  // Optional metadata
  timestamp?: Date | string  // Message timestamp
  metadata?: Record<string, string>  // Additional metadata
  emoji?: string            // Optional emoji/icon prefix

  // Optional styling
  className?: string
  contentClassName?: string
  showGlow?: boolean        // Glow effect (default: true)
  showBorder?: boolean      // Border effect (default: true)
}

export function DialogueMessage({
  speaker,
  content,
  accentColor,
  align = 'left',
  variant = 'default',
  timestamp,
  metadata,
  emoji,
  className,
  contentClassName,
  showGlow = true,
  showBorder = true,
}: DialogueMessageProps) {
  // Auto-detect speaker colors for brain.vat bots
  const speakerColor = accentColor || getSpeakerColor(speaker)
  const glowClass = getSpeakerGlow(speaker)

  const alignClasses = {
    left: 'text-left flex-row',
    right: 'text-right flex-row-reverse',
    center: 'text-center justify-center',
  }[align]

  return (
    <div className={cn('flex gap-4 animate-in fade-in slide-in-from-bottom-2', alignClasses, className)}>
      {/* Speaker label */}
      <div
        className="flex-shrink-0 w-24 pt-1"
        style={{
          color: speakerColor,
        }}>
        <div className="text-xs font-bold uppercase tracking-wider">
          {emoji && <span className="mr-1">{emoji}</span>}
          {speaker}
        </div>
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'backdrop-blur-md border rounded-lg p-4 transition-all',
            showGlow && glowClass,
            variant === 'system' && 'italic'
          )}
          style={{
            borderColor: showBorder ? speakerColor : 'transparent',
            backgroundColor: variant === 'system'
              ? 'rgba(234, 179, 8, 0.15)'
              : `${speakerColor}15`,
          }}>
          {/* Message text */}
          <div
            className={cn(
              'text-sm leading-relaxed font-mono',
              contentClassName
            )}>
            {typeof content === 'string' ? (
              <p>{content}</p>
            ) : (
              content
            )}
          </div>

          {/* Timestamp and metadata */}
          {(timestamp || metadata) && (
            <div className="mt-3 pt-3 border-t border-border/30 space-y-1">
              {timestamp && (
                <div className="text-[10px] text-muted-foreground font-mono">
                  {typeof timestamp === 'string'
                    ? timestamp
                    : timestamp.toLocaleTimeString()}
                </div>
              )}
              {metadata && (
                <div className="space-y-0.5">
                  {Object.entries(metadata).map(([key, value]) => (
                    <div key={key} className="text-[10px] text-muted-foreground flex justify-between font-mono">
                      <span className="opacity-60">{key}:</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function to get speaker color
function getSpeakerColor(speaker: Speaker): string {
  switch (speaker) {
    case 'MAUK':
      return '#03A6A1' // Cyan
    case 'ABACI':
      return '#FF9D23' // Orange
    case 'USER':
      return '#E63946' // Red
    case 'SYSTEM':
      return '#EAB308' // Yellow
    default:
      return '#00ff41' // Green
  }
}

// Helper function to get speaker glow class
function getSpeakerGlow(speaker: Speaker): string {
  switch (speaker) {
    case 'MAUK':
      return 'mauk-glow'
    case 'ABACI':
      return 'abaci-glow'
    case 'USER':
      return 'user-glow'
    default:
      return ''
  }
}

// Conversation thread display
export interface ConversationThreadProps {
  messages: DialogueMessageProps[]
  className?: string
}

export function ConversationThread({
  messages,
  className,
}: ConversationThreadProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {messages.map((msg, idx) => (
        <DialogueMessage
          key={`${msg.speaker}-${idx}-${msg.timestamp || ''}`}
          {...msg}
        />
      ))}
    </div>
  )
}

'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TimelineEvent {
  id: string
  title: string
  content?: string | ReactNode
  timestamp?: Date | string
  icon?: string
  color?: string
  metadata?: Record<string, string>
}

export interface TimelineProps {
  events: TimelineEvent[]
  direction?: 'vertical' | 'horizontal'
  accentColor?: string
  showConnectors?: boolean
  interactive?: boolean
  className?: string
}

export function Timeline({
  events,
  direction = 'vertical',
  accentColor = '#00ff41',
  showConnectors = true,
  interactive = true,
  className,
}: TimelineProps) {
  if (direction === 'horizontal') {
    return (
      <HorizontalTimeline
        events={events}
        accentColor={accentColor}
        interactive={interactive}
        className={className}
      />
    )
  }

  return (
    <div className={cn('relative space-y-8', className)}>
      {/* Vertical connector line */}
      {showConnectors && events.length > 1 && (
        <div
          className="absolute left-4 top-0 bottom-0 w-px"
          style={{ backgroundColor: `${accentColor}40` }}
        />
      )}

      {events.map((event, idx) => (
        <TimelineEventNode
          key={event.id}
          event={event}
          accentColor={event.color || accentColor}
          isLast={idx === events.length - 1}
          interactive={interactive}
        />
      ))}
    </div>
  )
}

interface TimelineEventNodeProps {
  event: TimelineEvent
  accentColor: string
  isLast: boolean
  interactive: boolean
}

function TimelineEventNode({
  event,
  accentColor,
  isLast,
  interactive,
}: TimelineEventNodeProps) {
  return (
    <div className="flex gap-6 relative">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 relative z-10',
            interactive && 'hover:scale-110 transition-transform cursor-pointer'
          )}
          style={{
            borderColor: accentColor,
            backgroundColor: `${accentColor}20`,
          }}>
          {event.icon ? (
            <span className="text-sm">{event.icon}</span>
          ) : (
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          )}
        </div>
      </div>

      {/* Event content */}
      <div className="flex-1 pb-8">
        <div
          className={cn(
            'backdrop-blur-md border rounded-lg p-4 transition-all',
            interactive && 'hover:border-opacity-100'
          )}
          style={{
            borderColor: accentColor,
            backgroundColor: `${accentColor}15`,
          }}>
          {/* Title */}
          <h3
            className="text-sm font-bold uppercase tracking-wide mb-2"
            style={{ color: accentColor }}>
            {event.title}
          </h3>

          {/* Content */}
          {event.content && (
            <div className="text-xs text-foreground/80 leading-relaxed font-mono mb-3">
              {typeof event.content === 'string' ? (
                <p>{event.content}</p>
              ) : (
                event.content
              )}
            </div>
          )}

          {/* Timestamp and metadata */}
          {(event.timestamp || event.metadata) && (
            <div className="pt-2 border-t border-border/30 space-y-1">
              {event.timestamp && (
                <div className="text-[10px] text-muted-foreground font-mono">
                  {typeof event.timestamp === 'string'
                    ? event.timestamp
                    : event.timestamp.toLocaleString()}
                </div>
              )}
              {event.metadata && (
                <div className="space-y-0.5">
                  {Object.entries(event.metadata).map(([key, value]) => (
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

function HorizontalTimeline({
  events,
  accentColor,
  interactive,
  className,
}: {
  events: TimelineEvent[]
  accentColor: string
  interactive: boolean
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      {/* Horizontal connector line */}
      <div
        className="absolute top-4 left-0 right-0 h-px"
        style={{ backgroundColor: `${accentColor}40` }}
      />

      <div className="flex gap-4 overflow-x-auto pb-8">
        {events.map((event) => (
          <div key={event.id} className="flex-shrink-0 w-64">
            <div className="flex flex-col items-center gap-4">
              {/* Timeline dot */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center relative z-10',
                  interactive && 'hover:scale-110 transition-transform cursor-pointer'
                )}
                style={{
                  borderColor: event.color || accentColor,
                  backgroundColor: `${event.color || accentColor}20`,
                }}>
                {event.icon ? (
                  <span className="text-sm">{event.icon}</span>
                ) : (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: event.color || accentColor }}
                  />
                )}
              </div>

              {/* Event card */}
              <div
                className="backdrop-blur-md border rounded-lg p-3 text-center w-full"
                style={{
                  borderColor: event.color || accentColor,
                  backgroundColor: `${event.color || accentColor}15`,
                }}>
                <h3
                  className="text-xs font-bold uppercase tracking-wide mb-2"
                  style={{ color: event.color || accentColor }}>
                  {event.title}
                </h3>
                {event.timestamp && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {typeof event.timestamp === 'string'
                      ? event.timestamp
                      : event.timestamp.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface MemoryCardProps {
  // Required
  concept: string
  accentColor?: string
  contentColor?: string  // Color for the text (separate from accent)

  // Optional alignment
  align?: 'left' | 'center' | 'right'

  // Optional animation
  animationType?: 'pulse' | 'ping' | 'none'

  // Optional status indicator
  showDot?: boolean
  dotAnimation?: 'pulse' | 'ping' | 'none'

  // Optional source/tooltip
  sourceText?: string
  sourceLabel?: string
  isHovering?: boolean

  // Callbacks
  onMouseEnter?: () => void
  onMouseLeave?: () => void

  // Optional styling
  opacity?: number
  hoverScale?: boolean
  className?: string
}

export function MemoryCard({
  concept,
  accentColor = '#00ff41',
  contentColor,
  align = 'left',
  animationType = 'none',
  showDot = true,
  dotAnimation = 'pulse',
  sourceText,
  sourceLabel = '[RECALLING FRAGMENT]',
  isHovering = false,
  onMouseEnter,
  onMouseLeave,
  opacity = 0.7,
  hoverScale = true,
  className,
}: MemoryCardProps) {
  const [internalHovering, setInternalHovering] = useState(false)
  const isShowingTooltip = isHovering || internalHovering

  const hasValidSource =
    sourceText &&
    sourceText !== 'recalling...' &&
    sourceText !== '(Context lost to time)' &&
    sourceText !== '(error recalling)' &&
    sourceText !== '(Source unavailable — offline mode)'

  // Determine alignment and origin for scale
  const alignClass = {
    left: 'text-left origin-left',
    center: 'text-center origin-center',
    right: 'text-right origin-right',
  }[align]

  // Animation class
  const animationClass = {
    pulse: 'animate-pulse',
    ping: 'animate-ping',
    none: '',
  }[animationType]

  // Dot animation class
  const dotAnimationClass = {
    pulse: 'animate-pulse',
    ping: 'animate-ping',
    none: '',
  }[dotAnimation]

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={isShowingTooltip && hasValidSource}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'relative group cursor-help px-4',
              className
            )}
            onMouseEnter={() => {
              setInternalHovering(true)
              onMouseEnter?.()
            }}
            onMouseLeave={() => {
              setInternalHovering(false)
              onMouseLeave?.()
            }}>
            <div
              className={cn(
                'flex items-center gap-2 transition-all duration-300',
                alignClass,
                hoverScale && 'hover:scale-110',
                animationClass
              )}
              style={{
                color: contentColor || accentColor,
                opacity: opacity,
              }}>
              {/* Left-aligned dot (for left/center) */}
              {showDot && (align === 'left' || align === 'center') && (
                <div
                  className={cn('w-2 h-2 rounded-full flex-shrink-0', dotAnimationClass)}
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 0 8px ${accentColor}`,
                  }}
                />
              )}

              <span className="text-sm font-mono">
                {concept}
              </span>

              {/* Right-aligned dot (for right/center) */}
              {showDot && (align === 'right' || align === 'center') && (
                <div
                  className={cn('w-2 h-2 rounded-full flex-shrink-0', dotAnimationClass)}
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 0 8px ${accentColor}`,
                  }}
                />
              )}
            </div>
          </div>
        </TooltipTrigger>

        {hasValidSource && (
          <TooltipContent
            side="top"
            className="p-3 bg-card border border-border rounded-lg shadow-2xl text-[10px] leading-tight w-[240px] z-[100]">
            <div className="text-muted-foreground font-bold mb-1 uppercase tracking-widest">
              {sourceLabel}
            </div>
            <div className="italic text-foreground overflow-hidden text-ellipsis line-clamp-4">
              "{sourceText}"
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

// Helper component for creating columns easily
export interface MemoryColumnProps {
  title: string
  accentColor?: string
  items: string[]
  align?: 'left' | 'center' | 'right'
  animationType?: 'pulse' | 'ping' | 'none'
  dotAnimation?: 'pulse' | 'ping' | 'none'
  onItemHover?: (item: string) => void
  hoveredItem?: string
  sourceText?: string
  showIndicator?: boolean
  indicatorText?: string
}

export function MemoryColumn({
  title,
  accentColor = '#00ff41',
  items,
  align = 'left',
  animationType = 'none',
  dotAnimation = 'pulse',
  onItemHover,
  hoveredItem,
  sourceText,
  showIndicator = true,
  indicatorText,
}: MemoryColumnProps) {
  return (
    <div
      className="flex flex-col border p-4 rounded-sm"
      style={{
        borderColor: accentColor,
        backgroundColor: `${accentColor}15`,
      }}>
      {/* Column Header with indicator dots */}
      <div
        className={cn(
          'text-sm font-bold mb-4 uppercase tracking-tighter flex items-center gap-2',
          align === 'right' && 'flex-row-reverse justify-end',
          align === 'center' && 'justify-center'
        )}
        style={{ color: accentColor }}>
        {showIndicator && (align === 'left' || align === 'center') && (
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              animationType === 'ping' ? 'animate-ping' : 'animate-pulse'
            )}
            style={{
              backgroundColor: accentColor,
            }}
          />
        )}

        <span>{indicatorText || title}</span>

        {showIndicator && (align === 'right' || align === 'center') && (
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              animationType === 'ping' ? 'animate-ping' : 'animate-pulse'
            )}
            style={{
              backgroundColor: accentColor,
            }}
          />
        )}
      </div>

      {/* Items */}
      <div className={cn(
        'flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin min-h-[300px]',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right'
      )}>
        {items.map((item) => (
          <MemoryCard
            key={item}
            concept={item}
            accentColor={accentColor}
            align={align}
            animationType={animationType}
            dotAnimation={dotAnimation}
            showDot={false}
            isHovering={hoveredItem === item}
            sourceText={hoveredItem === item ? sourceText : undefined}
            onMouseEnter={() => onItemHover?.(item)}
          />
        ))}
      </div>
    </div>
  )
}

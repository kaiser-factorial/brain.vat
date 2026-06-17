'use client'

import { cn } from '@/lib/utils'

export interface BotNameCardProps {
  // Required
  botName: string          // Bot name (e.g., "MAUK_v2.1")
  description: string      // Bot description

  // Optional appearance
  accentColor?: string     // Primary color (default: '#03A6A1')
  glowColor?: string       // Glow color (default: same as accentColor)
  version?: string         // Version suffix (default: derived from botName)

  // Optional styling
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showGlow?: boolean       // Show background glow effect (default: true)
  interactive?: boolean    // Enable hover effects (default: true)
}

export function BotNameCard({
  botName,
  description,
  accentColor = '#03A6A1',
  glowColor,
  version,
  className,
  size = 'md',
  showGlow = true,
  interactive = true,
}: BotNameCardProps) {
  const finalGlowColor = glowColor || accentColor

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-12',
  }[size]

  const titleSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }[size]

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size]

  return (
    <div
      className={cn(
        'backdrop-blur-md border rounded-lg relative overflow-hidden',
        interactive && 'group hover:transition-all cursor-default',
        className
      )}
      style={{
        borderColor: accentColor,
        backgroundColor: `${accentColor}15`,
      }}>
      {/* Background glow effect */}
      {showGlow && (
        <div
          className={cn(
            'absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 transition-colors',
            interactive && 'group-hover:transition-colors'
          )}
          style={{
            backgroundColor: `${finalGlowColor}${interactive ? '10' : '05'}`,
          }}
        />
      )}

      <div className="relative z-10">
        {/* Bot Name */}
        <h2
          className={cn(
            'font-bold mb-4 uppercase tracking-wide',
            titleSizeClasses,
            interactive && 'group-hover:transition-colors'
          )}
          style={{ color: accentColor }}>
          {botName}
          {version && <span className="opacity-60">_{version}</span>}
        </h2>

        {/* Description */}
        <p
          className={cn(
            'text-foreground/80 leading-relaxed font-mono',
            textSizeClasses
          )}>
          {description}
        </p>
      </div>

      {/* Hover border effect */}
      {interactive && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity pointer-events-none border"
          style={{
            borderColor: accentColor,
          }}
        />
      )}
    </div>
  )
}

// Helper component for displaying multiple bot cards in a grid
export interface BotNameCardGridProps {
  bots: Array<{
    name: string
    description: string
    accentColor?: string
  }>
  columns?: 1 | 2 | 3 | 4
  className?: string
}

export function BotNameCardGrid({
  bots,
  columns = 2,
  className,
}: BotNameCardGridProps) {
  const gridColsClasses = {
    1: 'grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  }[columns]

  return (
    <div className={cn(`grid gap-8 ${gridColsClasses}`, className)}>
      {bots.map((bot) => (
        <BotNameCard
          key={bot.name}
          botName={bot.name}
          description={bot.description}
          accentColor={bot.accentColor}
        />
      ))}
    </div>
  )
}

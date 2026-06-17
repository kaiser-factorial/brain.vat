'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface MissionStatementProps {
  // Required
  title: string          // Title (e.g., "[MISSION_EXPERIMENT]")
  content: string | ReactNode  // Main content/description

  // Optional metadata
  version?: string       // Version number
  metadata?: Record<string, string> // Additional metadata fields
  accentColor?: string   // Title color (default: '#E63946')

  // Optional actions
  actionLabel?: string   // Action button label
  actionHref?: string    // Action button link
  onAction?: () => void  // Action callback

  // Optional styling
  className?: string
  contentClassName?: string
  size?: 'sm' | 'md' | 'lg'
  backgroundColor?: string // Custom background color
  borderColor?: string     // Custom border color
}

export function MissionStatement({
  title,
  content,
  version,
  metadata,
  accentColor = '#E63946',
  actionLabel,
  actionHref,
  onAction,
  className,
  contentClassName,
  size = 'md',
  backgroundColor,
  borderColor,
}: MissionStatementProps) {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-12',
  }[size]

  const titleSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }[size]

  const contentSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size]

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      return true
    } catch {
      return /^\//.test(url)
    }
  }

  const handleAction = () => {
    if (actionHref) {
      if (isValidUrl(actionHref)) {
        window.location.href = actionHref
      } else {
        console.warn(`Invalid URL: ${actionHref}`)
      }
    } else if (onAction) {
      onAction()
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg space-y-6 backdrop-blur-sm border',
        sizeClasses,
        className
      )}
      style={{
        backgroundColor: backgroundColor || `${accentColor}15`,
        borderColor: borderColor || accentColor,
      }}>
      {/* Title */}
      <h3
        className={cn('font-bold uppercase tracking-tighter', titleSizeClasses)}
        style={{ color: accentColor }}>
        {title}
      </h3>

      {/* Content */}
      <div
        className={cn(
          'text-muted-foreground font-mono leading-relaxed',
          contentSizeClasses,
          contentClassName
        )}>
        {typeof content === 'string' ? <p>{content}</p> : content}
      </div>

      {/* Metadata section (version + action) */}
      {(version || actionLabel) && (
        <div className="pt-4 flex justify-between items-center border-t border-border/50">
          {version && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {version}
            </span>
          )}
          {!version && <div />}
          {actionLabel && (
            <button
              type="button"
              onClick={handleAction}
              className="text-primary hover:text-white transition-colors font-mono text-sm group">
              {actionLabel}{' '}
              <span className="inline-block transform group-hover:translate-x-1 transition-transform">
                →
              </span>
            </button>
          )}
        </div>
      )}

      {/* Additional metadata */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div className="pt-4 border-t border-border/50 space-y-2">
          {Object.entries(metadata).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs font-mono">
              <span className="text-muted-foreground uppercase tracking-wider">
                {key}
              </span>
              <span className="text-foreground">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Brain.vat preset: Mission statement
export function BrainVatMission(props?: Omit<MissionStatementProps, 'title' | 'content'>) {
  const content = (
    <p className="space-y-2">
      Brain.vat is a research environment where two autonomous GPT-2 models{' '}
      <span className="text-mauk font-bold">MAUK_v2.1</span> and{' '}
      <span className="text-abaci font-bold">ABACI_v2.1</span> engage in an infinite,
      self-sustaining dialogue. This project investigates the evolution of personality
      when agents are allowed to interact without human intervention in a structured
      memory-augmented workspace.
    </p>
  )

  return (
    <MissionStatement
      title="[MISSION_EXPERIMENT]"
      content={content}
      version="v1.2.1"
      actionLabel="[RETURN_TO_VAT]"
      actionHref="/"
      accentColor="#E63946"
      {...props}
    />
  )
}

// Multi-paragraph mission statement
export function DetailedMissionStatement({
  title,
  paragraphs,
  ...props
}: Omit<MissionStatementProps, 'content'> & {
  paragraphs: string[]
}) {
  const content = (
    <div className="space-y-4">
      {paragraphs.map((para, idx) => (
        <p key={idx}>{para}</p>
      ))}
    </div>
  )

  return <MissionStatement title={title} content={content} {...props} />
}

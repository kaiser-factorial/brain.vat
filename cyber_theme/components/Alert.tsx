'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type AlertSeverity = 'info' | 'success' | 'warning' | 'error' | 'system'

export interface AlertProps {
  // Required
  title: string
  message: string | ReactNode

  // Optional appearance
  severity?: AlertSeverity  // Alert type (default: 'info')
  icon?: string            // Custom icon/emoji
  accentColor?: string     // Custom color (overrides severity)

  // Optional actions
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  dismissible?: boolean    // Show close button (default: true)
  onDismiss?: () => void

  // Optional styling
  className?: string
  variant?: 'default' | 'compact' | 'inline'  // Layout variant (default: 'default')
  showBorder?: boolean     // Show border (default: true)
  animate?: boolean        // Entrance animation (default: true)
}

export function Alert({
  title,
  message,
  severity = 'info',
  icon,
  accentColor,
  actionLabel,
  actionHref,
  onAction,
  dismissible = true,
  onDismiss,
  className,
  variant = 'default',
  showBorder = true,
  animate = true,
}: AlertProps) {
  const color = accentColor || getSeverityColor(severity)
  const severityIcon = icon || getSeverityIcon(severity)

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

  if (variant === 'compact') {
    return (
      <CompactAlert
        title={title}
        message={message}
        severity={severity}
        color={color}
        icon={severityIcon}
        actionLabel={actionLabel}
        onAction={handleAction}
        dismissible={dismissible}
        onDismiss={onDismiss}
        className={className}
        showBorder={showBorder}
      />
    )
  }

  if (variant === 'inline') {
    return (
      <InlineAlert
        title={title}
        message={message}
        color={color}
        icon={severityIcon}
        actionLabel={actionLabel}
        onAction={handleAction}
        className={className}
      />
    )
  }

  return (
    <div
      role="alert"
      className={cn(
        'backdrop-blur-md border rounded-lg p-4 space-y-3 transition-all',
        showBorder && 'border',
        animate && 'animate-in fade-in slide-in-from-top-2',
        className
      )}
      style={{
        borderColor: showBorder ? color : 'transparent',
        backgroundColor: `${color}15`,
      }}>
      {/* Header with icon and title */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 flex-1">
          <div className="text-xl flex-shrink-0">{severityIcon}</div>
          <h3
            className="text-sm font-bold uppercase tracking-wide"
            style={{ color }}>
            {title}
          </h3>
        </div>

        {/* Close button */}
        {dismissible && (
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label="Dismiss">
            ✕
          </button>
        )}
      </div>

      {/* Message */}
      <div className="text-xs text-foreground/80 leading-relaxed font-mono ml-8">
        {typeof message === 'string' ? <p>{message}</p> : message}
      </div>

      {/* Action button */}
      {actionLabel && (
        <div className="ml-8 pt-2">
          <button
            onClick={handleAction}
            className="text-xs font-mono transition-colors group"
            style={{ color }}>
            {actionLabel}{' '}
            <span className="inline-block transform group-hover:translate-x-1 transition-transform">
              →
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

interface CompactAlertProps {
  title: string
  message: string | ReactNode
  severity: AlertSeverity
  color: string
  icon: string
  actionLabel?: string
  onAction?: () => void
  dismissible: boolean
  onDismiss?: () => void
  className?: string
  showBorder: boolean
}

function CompactAlert({
  title,
  message,
  color,
  icon,
  actionLabel,
  onAction,
  dismissible,
  onDismiss,
  className,
  showBorder,
}: CompactAlertProps) {
  return (
    <div
      className={cn(
        'backdrop-blur-md border rounded-lg px-3 py-2 flex items-center gap-3 transition-all animate-in fade-in',
        className
      )}
      style={{
        borderColor: showBorder ? color : 'transparent',
        backgroundColor: `${color}15`,
      }}>
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-foreground/80">
          <span style={{ color }} className="font-bold">
            {title}:
          </span>{' '}
          {typeof message === 'string' ? message : <>{message}</>}
        </p>
      </div>
      {actionLabel && (
        <button
          onClick={onAction}
          className="text-xs font-mono flex-shrink-0 transition-colors"
          style={{ color }}>
          {actionLabel}
        </button>
      )}
      {dismissible && (
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 text-sm"
          aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  )
}

interface InlineAlertProps {
  title: string
  message: string | ReactNode
  color: string
  icon: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

function InlineAlert({
  title,
  message,
  color,
  icon,
  actionLabel,
  onAction,
  className,
}: InlineAlertProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-xs font-bold uppercase" style={{ color }}>
          {title}
        </span>
      </div>
      <p className="text-xs text-foreground/80 font-mono ml-6">
        {typeof message === 'string' ? message : message}
      </p>
      {actionLabel && (
        <div className="ml-6 pt-1">
          <button
            onClick={onAction}
            className="text-xs font-mono transition-colors"
            style={{ color }}>
            {actionLabel} →
          </button>
        </div>
      )}
    </div>
  )
}

// Helper functions
function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'success':
      return '#00ff41' // Green
    case 'warning':
      return '#FF9D23' // Orange
    case 'error':
      return '#ff4444' // Red
    case 'system':
      return '#EAB308' // Yellow
    case 'info':
    default:
      return '#00ccff' // Cyan
  }
}

function getSeverityIcon(severity: AlertSeverity): string {
  switch (severity) {
    case 'success':
      return '✓'
    case 'warning':
      return '⚠'
    case 'error':
      return '✕'
    case 'system':
      return '◆'
    case 'info':
    default:
      return 'ℹ'
  }
}

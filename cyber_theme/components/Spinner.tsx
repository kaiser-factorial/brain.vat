'use client'

import { cn } from '@/lib/utils'

export interface SpinnerProps {
  accentColor?: string
  size?: 'sm' | 'md' | 'lg'
  label?: string
  showLabel?: boolean
  variant?: 'dots' | 'ring' | 'pulse'
  className?: string
}

export function Spinner({
  accentColor = '#00ff41',
  size = 'md',
  label = 'Loading',
  showLabel = true,
  variant = 'ring',
  className,
}: SpinnerProps) {
  if (variant === 'dots') {
    return (
      <DotsSpinner
        accentColor={accentColor}
        size={size}
        label={label}
        showLabel={showLabel}
        className={className}
      />
    )
  }

  if (variant === 'pulse') {
    return (
      <PulseSpinner
        accentColor={accentColor}
        size={size}
        label={label}
        showLabel={showLabel}
        className={className}
      />
    )
  }

  // Ring spinner (default)
  return (
    <RingSpinner
      accentColor={accentColor}
      size={size}
      label={label}
      showLabel={showLabel}
      className={className}
    />
  )
}

interface SpinnerComponentProps {
  accentColor: string
  size: string
  label: string
  showLabel: boolean
  className?: string
}

function RingSpinner({
  accentColor,
  size,
  label,
  showLabel,
  className,
}: SpinnerComponentProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  }[size]

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className={cn('relative', sizeClasses)}>
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
          style={{
            borderTopColor: accentColor,
            borderRightColor: accentColor,
            animationDuration: '1s',
          }}
        />
        <div
          className="absolute inset-1 rounded-full border border-transparent animate-spin"
          style={{
            borderBottomColor: accentColor,
            opacity: 0.6,
            animationDuration: '1.5s',
            animationDirection: 'reverse',
          }}
        />
      </div>
      {showLabel && (
        <span
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: accentColor }}>
          {label}
        </span>
      )}
    </div>
  )
}

function DotsSpinner({
  accentColor,
  size,
  label,
  showLabel,
  className,
}: SpinnerComponentProps) {
  const dotSize = {
    sm: 'w-1 h-1',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  }[size]

  const dotSizeNum = {
    sm: 4,
    md: 8,
    lg: 12,
  }[size]

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn('rounded-full animate-bounce', dotSize)}
            style={{
              backgroundColor: accentColor,
              animationDelay: `${i * 0.16}s`,
              boxShadow: `0 0 ${dotSizeNum}px ${accentColor}80`,
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: accentColor }}>
          {label}
        </span>
      )}
    </div>
  )
}

function PulseSpinner({
  accentColor,
  size,
  label,
  showLabel,
  className,
}: SpinnerComponentProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  }[size]

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className={cn('relative', sizeClasses)}>
        <div
          className={cn('absolute inset-0 rounded-full animate-pulse', sizeClasses)}
          style={{
            backgroundColor: accentColor,
            opacity: 0.7,
          }}
        />
        <div
          className={cn('absolute inset-0 rounded-full animate-pulse', sizeClasses)}
          style={{
            backgroundColor: accentColor,
            opacity: 0.4,
            animationDelay: '1s',
          }}
        />
      </div>
      {showLabel && (
        <span
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: accentColor }}>
          {label}
        </span>
      )}
    </div>
  )
}

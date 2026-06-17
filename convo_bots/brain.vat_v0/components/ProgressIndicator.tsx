'use client'

import { cn } from '@/lib/utils'

export interface ProgressIndicatorProps {
  // Required
  value: number  // Progress 0-100

  // Optional appearance
  accentColor?: string     // Progress color (default: '#00ff41')
  backgroundColor?: string  // Track color
  size?: 'sm' | 'md' | 'lg'  // Progress bar size (default: 'md')
  variant?: 'linear' | 'circular' | 'gauge'  // Visual style (default: 'linear')

  // Optional labels
  label?: string           // Label text
  showPercentage?: boolean // Show percentage (default: true)
  format?: (value: number) => string  // Custom format function

  // Optional styling
  className?: string
  animated?: boolean       // Animate fill (default: true)
  striped?: boolean        // Add stripes pattern (default: false)
}

export function ProgressIndicator({
  value,
  accentColor = '#00ff41',
  backgroundColor,
  size = 'md',
  variant = 'linear',
  label,
  showPercentage = true,
  format,
  className,
  animated = true,
  striped = false,
}: ProgressIndicatorProps) {
  const clampedValue = Math.min(100, Math.max(0, value))
  const displayValue = format ? format(clampedValue) : `${clampedValue}%`

  if (variant === 'circular') {
    return (
      <CircularProgress
        value={clampedValue}
        accentColor={accentColor}
        size={size}
        label={label}
        displayValue={displayValue}
        showPercentage={showPercentage}
        className={className}
      />
    )
  }

  if (variant === 'gauge') {
    return (
      <GaugeProgress
        value={clampedValue}
        accentColor={accentColor}
        size={size}
        label={label}
        displayValue={displayValue}
        showPercentage={showPercentage}
        className={className}
      />
    )
  }

  // Linear progress bar (default)
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-4',
  }[size]

  const heightForLabel = {
    sm: 'mt-1',
    md: 'mt-2',
    lg: 'mt-3',
  }[size]

  return (
    <div className={className}>
      {/* Label */}
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-xs font-bold uppercase" style={{ color: accentColor }}>{label}</span>}
          {showPercentage && (
            <span className="text-xs font-mono text-muted-foreground">{displayValue}</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div
        className={cn('rounded-full overflow-hidden backdrop-blur-sm border', sizeClasses)}
        style={{
          backgroundColor: backgroundColor || `${accentColor}10`,
          borderColor: accentColor,
        }}>
        <div
          className={cn(
            'h-full rounded-full',
            animated && 'transition-all duration-500',
            striped && 'striped-progress'
          )}
          style={{
            width: `${clampedValue}%`,
            backgroundColor: accentColor,
            boxShadow: `0 0 8px ${accentColor}80`,
          }}
        />
      </div>
    </div>
  )
}

interface CircularProgressProps {
  value: number
  accentColor: string
  size: string
  label?: string
  displayValue: string
  showPercentage: boolean
  className?: string
}

function CircularProgress({
  value,
  accentColor,
  size,
  label,
  displayValue,
  showPercentage,
  className,
}: CircularProgressProps) {
  const sizeMap = { sm: 60, md: 100, lg: 140 }
  const diameter = sizeMap[size as keyof typeof sizeMap]
  const radius = diameter / 2 - 4
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg width={diameter} height={diameter} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="2"
        />

        {/* Progress circle */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.5s ease',
            filter: `drop-shadow(0 0 4px ${accentColor}80)`,
          }}
        />
      </svg>

      {/* Center text */}
      {showPercentage && (
        <div className="absolute flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm font-bold" style={{ color: accentColor }}>
            {displayValue}
          </span>
        </div>
      )}

      {/* Label below */}
      {label && (
        <span className="text-xs font-bold uppercase mt-2" style={{ color: accentColor }}>
          {label}
        </span>
      )}
    </div>
  )
}

interface GaugeProgressProps {
  value: number
  accentColor: string
  size: string
  label?: string
  displayValue: string
  showPercentage: boolean
  className?: string
}

function GaugeProgress({
  value,
  accentColor,
  size,
  label,
  displayValue,
  showPercentage,
  className,
}: GaugeProgressProps) {
  const sizeMap = { sm: 80, md: 120, lg: 160 }
  const diameter = sizeMap[size as keyof typeof sizeMap]
  const radius = diameter / 2 - 6

  // Gauge goes from 225° to -45° (270° sweep)
  const angle = (value / 100) * 270 - 225
  const rad = (angle * Math.PI) / 180
  const x = diameter / 2 + radius * Math.cos(rad)
  const y = diameter / 2 + radius * Math.sin(rad)

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg width={diameter} height={diameter * 0.75} viewBox={`0 0 ${diameter} ${diameter}`}>
        {/* Background arc */}
        <path
          d={`M ${diameter / 2 - radius} ${diameter / 2} A ${radius} ${radius} 0 1 1 ${diameter / 2 + radius} ${diameter / 2}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Progress arc */}
        <path
          d={`M ${diameter / 2 - radius} ${diameter / 2} A ${radius} ${radius} 0 ${value > 50 ? 1 : 0} 1 ${x} ${y}`}
          fill="none"
          stroke={accentColor}
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${accentColor}80)`,
            transition: 'stroke-dashoffset 0.5s ease',
          }}
        />

        {/* Center circle */}
        <circle cx={diameter / 2} cy={diameter / 2} r="6" fill={accentColor} />
      </svg>

      {/* Center text */}
      <div className="text-center -mt-4">
        {showPercentage && (
          <div className="text-sm font-bold" style={{ color: accentColor }}>
            {displayValue}
          </div>
        )}
        {label && (
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        )}
      </div>
    </div>
  )
}

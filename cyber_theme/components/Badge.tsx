'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

export interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'outline' | 'solid' | 'glow'
  color?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | string
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  removable?: boolean
  onRemove?: () => void
  className?: string
  onClick?: () => void
}

export function Badge({
  children,
  variant = 'default',
  color = 'default',
  size = 'md',
  icon,
  removable = false,
  onRemove,
  className,
  onClick,
}: BadgeProps) {
  const colorMap: Record<string, string> = {
    default: '#00ff41',
    primary: '#E63946',
    success: '#00ff41',
    warning: '#FF9D23',
    error: '#ff4444',
    info: '#00ccff',
  }

  const accentColor = colorMap[color as keyof typeof colorMap] || color

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  }[size]

  const variantClasses = {
    default: 'bg-card/40 border border-border/50',
    outline: 'bg-transparent border',
    solid: 'bg-opacity-20 border',
    glow: 'bg-opacity-10 border',
  }[variant]

  const borderColor = variant === 'outline' || variant === 'solid' || variant === 'glow'
    ? accentColor
    : 'transparent'

  const backgroundColor = variant === 'solid'
    ? `${accentColor}33`
    : variant === 'glow'
      ? `${accentColor}0f`
      : variant === 'outline'
        ? 'transparent'
        : `${accentColor}08`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono rounded transition-all',
        onClick && 'cursor-pointer hover:opacity-80',
        variantClasses,
        sizeClasses,
        className
      )}
      style={{
        color: accentColor,
        borderColor,
        backgroundColor,
        ...(variant === 'glow' && {
          boxShadow: `0 0 8px ${accentColor}40`,
        }),
      }}
      onClick={onClick}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="flex-shrink-0">{children}</span>
      {removable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove?.()
          }}
          className="ml-1 hover:opacity-70 transition-opacity flex-shrink-0"
          aria-label="Remove">
          ✕
        </button>
      )}
    </span>
  )
}

export interface BadgeGroupProps {
  badges: Array<{
    label: ReactNode
    icon?: string
    color?: string
    removable?: boolean
    onRemove?: () => void
  }>
  variant?: 'default' | 'outline' | 'solid' | 'glow'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function BadgeGroup({
  badges,
  variant = 'default',
  size = 'md',
  className,
}: BadgeGroupProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {badges.filter(b => b.label != null).map((badge, idx) => (
        <Badge
          key={`${String(badge.label)}-${idx}`}
          variant={variant}
          color={badge.color}
          size={size}
          icon={badge.icon}
          removable={badge.removable}
          onRemove={badge.onRemove}>
          {badge.label}
        </Badge>
      ))}
    </div>
  )
}

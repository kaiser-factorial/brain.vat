'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

export interface Stat {
  label: string
  value: string | number
  change?: string | number
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: string
  color?: string
}

export interface StatsDisplayProps {
  stats: Stat[]
  accentColor?: string
  layout?: 'grid' | 'row'
  columns?: 1 | 2 | 3 | 4
  className?: string
}

export function StatsDisplay({
  stats,
  accentColor = '#00ff41',
  layout = 'grid',
  columns = 2,
  className,
}: StatsDisplayProps) {
  const gridColsClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  }[columns]

  const containerClasses = layout === 'grid'
    ? cn(`grid gap-4 ${gridColsClasses}`, className)
    : cn('flex gap-4 overflow-x-auto', className)

  return (
    <div className={containerClasses}>
      {stats.filter(s => s.label != null && s.value != null).map((stat, idx) => (
        <StatCard
          key={`${stat.label}-${idx}`}
          stat={stat}
          accentColor={stat.color || accentColor}
        />
      ))}
    </div>
  )
}

interface StatCardProps {
  stat: Stat
  accentColor: string
}

function StatCard({ stat, accentColor }: StatCardProps) {
  const changeColor =
    stat.changeType === 'positive' ? '#00ff41' :
    stat.changeType === 'negative' ? '#ff4444' :
    '#808080'

  return (
    <div
      className="backdrop-blur-md border rounded-lg p-4 flex-shrink-0"
      style={{
        borderColor: accentColor,
        backgroundColor: `${accentColor}15`,
      }}>
      <div className="flex items-start justify-between gap-2">
        {/* Icon and label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {stat.icon && <span className="text-lg flex-shrink-0">{stat.icon}</span>}
            <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">
              {stat.label}
            </p>
          </div>

          {/* Value */}
          <p
            className="text-lg font-bold font-mono"
            style={{ color: accentColor }}>
            {stat.value}
          </p>
        </div>

        {/* Change indicator */}
        {stat.change !== undefined && (
          <div className="flex-shrink-0 text-right">
            <p
              className="text-xs font-mono font-bold"
              style={{ color: changeColor }}>
              {stat.changeType === 'positive' && '+'}
              {stat.change}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Brain.vat stats preset
export function BrainVatStats(props?: Omit<StatsDisplayProps, 'stats'>) {
  const stats: Stat[] = [
    {
      label: 'Conversations',
      value: '1,247',
      change: '+12',
      changeType: 'positive',
      icon: '◉◉',
      color: '#03A6A1',
    },
    {
      label: 'Concepts Indexed',
      value: '5,847',
      change: '+234',
      changeType: 'positive',
      icon: '▯▮',
      color: '#FF9D23',
    },
    {
      label: 'Memory Usage',
      value: '2.3GB',
      change: '+0.1GB',
      changeType: 'neutral',
      icon: '💾',
      color: '#00ff41',
    },
    {
      label: 'Uptime',
      value: '47d 3h',
      change: 'stable',
      changeType: 'positive',
      icon: '⏱',
      color: '#00ccff',
    },
  ]

  return <StatsDisplay stats={stats} columns={4} {...props} />
}

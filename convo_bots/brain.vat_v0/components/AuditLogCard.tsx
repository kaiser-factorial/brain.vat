'use client'

import { useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'

export interface LogSection {
  key: string
  title: string
  type: 'text' | 'code' | 'grid' | 'tags' | 'stats' | 'custom'
  content: any
  collapsible?: boolean
}

export interface AuditLogCardProps {
  // Required
  title: string | React.ReactNode
  sections: LogSection[]

  // Optional styling
  accentColor?: string
  labelColor?: string
  botColor?: 'cyan' | 'orange' | 'custom'
  customBotColor?: string
  customBotLabel?: string

  // Optional metadata
  timestamp?: Date | string
  badge?: string
  badgeColor?: string
  metadata?: Record<string, string | number | boolean>

  // Optional status
  indicator?: boolean
  indicatorColor?: string

  // Behavior
  defaultOpen?: boolean
  onExpand?: (isOpen: boolean) => void

  // Custom rendering
  renderCustomSection?: (section: LogSection) => React.ReactNode
}

export function AuditLogCard({
  title,
  sections,
  accentColor = '#00ff41',
  labelColor = '#008f11',
  botColor = 'cyan',
  customBotColor,
  customBotLabel,
  timestamp,
  badge,
  badgeColor,
  metadata,
  indicator = true,
  indicatorColor,
  defaultOpen = true,
  onExpand,
  renderCustomSection,
}: AuditLogCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(!defaultOpen)

  const handleToggle = useCallback(() => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    onExpand?.(newState)
  }, [isCollapsed, onExpand])

  // Determine bot color
  const getBotColor = () => {
    if (botColor === 'custom' && customBotColor) return customBotColor
    if (botColor === 'cyan') return '#00ccff'
    if (botColor === 'orange') return '#ffbf00'
    return accentColor
  }

  const dotColor = getBotColor()
  const badgeBg = badgeColor || accentColor

  return (
    <div className="border overflow-hidden rounded-sm group transition-all duration-500 shadow-2xl"
      style={{
        borderColor: accentColor,
        backgroundColor: '#0a0a0a',
      }}>
      {/* Header */}
      <div className="px-4 py-2 border-b flex justify-between items-center cursor-pointer transition-all"
        style={{
          borderColor: accentColor,
          backgroundColor: `${accentColor}15`,
        }}
        onClick={handleToggle}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {indicator && (
            <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
              style={{
                backgroundColor: indicatorColor || dotColor,
                boxShadow: `0 0 8px ${indicatorColor || dotColor}`,
              }} />
          )}
          <span className="text-xs font-bold tracking-widest truncate"
            style={{ color: dotColor }}>
            {typeof title === 'string' ? title.toUpperCase() : title}
          </span>
          {customBotLabel && (
            <span className="text-[8px] font-bold uppercase tracking-wider truncate"
              style={{ color: labelColor }}>
              {customBotLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {badge && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 border rounded-full text-[8px] font-black uppercase tracking-widest animate-fadeIn"
              style={{
                backgroundColor: `${badgeBg}10`,
                borderColor: `${badgeBg}30`,
                color: badgeBg,
              }}>
              <div className="w-1 h-1 rounded-full"
                style={{ backgroundColor: badgeBg }} />
              {badge}
            </div>
          )}

          <div className="flex items-center gap-2 text-right min-w-fit">
            {timestamp && (
              <span className="text-[10px] font-bold whitespace-nowrap"
                style={{ color: labelColor }}>
                {typeof timestamp === 'string'
                  ? timestamp
                  : `${new Date(timestamp).toLocaleTimeString()} // ${new Date(timestamp).toLocaleDateString()}`
                }
              </span>
            )}

            <button
              type="button"
              className="transition-transform duration-300 p-1 flex-shrink-0"
              style={{ color: accentColor }}
              onClick={(e) => {
                e.stopPropagation()
                handleToggle()
              }}>
              <ChevronDown
                size={20}
                className={`transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-5 space-y-6 animate-in fade-in duration-300">
          {sections.map((section) => (
            <div key={section.key}>
              {/* Section Header */}
              <div className="text-[9px] uppercase mb-2 font-bold tracking-widest opacity-80"
                style={{ color: labelColor }}>
                &gt; {section.title}
              </div>

              {/* Text Content */}
              {section.type === 'text' && (
                <div className="text-sm p-4 border-l-2 bg-opacity-50 italic relative group"
                  style={{
                    borderColor: accentColor,
                    backgroundColor: `${accentColor}05`,
                    color: accentColor,
                  }}>
                  <span className="absolute -left-1 top-0 bottom-0 w-0.5 group-hover:shadow-lg transition-shadow"
                    style={{
                      backgroundColor: accentColor,
                    }} />
                  "{section.content}"
                </div>
              )}

              {/* Code/Monospace Block */}
              {section.type === 'code' && (
                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap p-4 rounded-sm border max-h-64 overflow-y-auto font-mono"
                  style={{
                    backgroundColor: '#000000',
                    borderColor: `${accentColor}33`,
                    color: accentColor,
                  }}>
                  {section.content}
                </pre>
              )}

              {/* Grid/Parameter Grid */}
              {section.type === 'grid' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {Object.entries(section.content || {}).map(([key, value]) => (
                    <div key={key} className="p-2 rounded-sm group hover:transition-all"
                      style={{
                        backgroundColor: `${accentColor}04`,
                        borderColor: `${accentColor}22`,
                        borderWidth: '1px',
                        cursor: 'default',
                      }}>
                      <div className="text-[7px] uppercase font-black mb-1" style={{ color: labelColor }}>
                        {key}
                      </div>
                      <div className="text-[10px] font-bold tabular-nums" style={{ color: accentColor }}>
                        {typeof value === 'number' ? value.toFixed(2) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tags/Badges */}
              {section.type === 'tags' && (
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(section.content)
                    ? section.content.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-[9px] rounded-sm transition-colors cursor-default"
                        style={{
                          backgroundColor: `${accentColor}30`,
                          borderColor: `${accentColor}30`,
                          borderWidth: '1px',
                          color: accentColor,
                        }}>
                        {tag}
                      </span>
                    ))
                    : null}
                </div>
              )}

              {/* Stats/Key-Value Pairs */}
              {section.type === 'stats' && (
                <div className="flex flex-wrap gap-6 text-[9px] font-bold tracking-widest">
                  {Object.entries(section.content || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span style={{ color: labelColor }}>{key}:</span>
                      <span style={{ color: accentColor }}>{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom Section */}
              {section.type === 'custom' && renderCustomSection && (
                renderCustomSection(section)
              )}
            </div>
          ))}

          {/* Footer Metadata (Optional) */}
          {metadata && Object.keys(metadata).length > 0 && (
            <div className="pt-4 border-t flex flex-wrap gap-6 text-[9px] font-bold tracking-widest"
              style={{ borderColor: `${accentColor}22` }}>
              {Object.entries(metadata).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span style={{ color: labelColor }}>{key}:</span>
                  <span style={{ color: accentColor }}>{String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'

export interface ParameterConfig {
  key: string
  label: string
  type: 'range' | 'text' | 'textarea' | 'number'
  min?: number
  max?: number
  step?: number
  rows?: number
  description?: string
  formatDisplay?: (value: any) => string
  group?: string
}

export interface BotParameterPanelProps {
  botName: string
  parameters: ParameterConfig[]
  values: Record<string, any>
  onUpdate: (key: string, value: any) => void
  onSave: () => void | Promise<void>
  isSaving?: boolean
  isLoading?: boolean
  accentColor?: string
  labelColor?: string
  loopActive?: boolean
  lastSyncTime?: Date
  nodeLabel?: string
  groupedView?: boolean
}

export function BotParameterPanel({
  botName,
  parameters,
  values,
  onUpdate,
  onSave,
  isSaving = false,
  isLoading = false,
  accentColor = '#00ff41',
  labelColor = '#008f11',
  loopActive = false,
  lastSyncTime,
  nodeLabel,
  groupedView = true,
}: BotParameterPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev)
  }, [])

  const groupedParams = groupedView
    ? parameters.reduce((acc, param) => {
        const group = param.group || 'General'
        if (!acc[group]) acc[group] = []
        acc[group].push(param)
        return acc
      }, {} as Record<string, ParameterConfig[]>)
    : { All: parameters }

  const handleSave = useCallback(async () => {
    try {
      await onSave()
    } catch (error) {
      console.error('Save failed:', error)
    }
  }, [onSave])

  return (
    <div className="border rounded-sm overflow-hidden transition-all duration-500 shadow-2xl relative group"
      style={{
        borderColor: accentColor,
        backgroundColor: '#0a0a0a',
      }}>
      {/* Header */}
      <div className="px-6 py-3 border-b flex justify-between items-center cursor-pointer"
        style={{
          borderColor: accentColor,
          backgroundColor: `${accentColor}15`,
        }}
        onClick={handleToggleCollapse}>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-2 h-2 rounded-full animate-pulse"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 0 8px ${accentColor}`,
            }} />
          <span className="text-sm font-bold tracking-[0.3em]" style={{ color: accentColor }}>
            {botName}
          </span>
        </div>

        <div className="flex items-center gap-4 text-right">
          {(loopActive !== undefined || lastSyncTime) && (
            <div className="flex flex-col items-end">
              {loopActive !== undefined && (
                <div className={`text-[8px] font-black px-2 py-0.5 mb-1 tracking-tighter rounded-full transition-all ${
                  loopActive
                    ? 'text-black shadow-lg'
                    : 'border'
                }`}
                  style={{
                    backgroundColor: loopActive ? accentColor : 'transparent',
                    color: loopActive ? 'black' : 'currentColor',
                    borderColor: loopActive ? accentColor : `${accentColor}66`,
                  }}>
                  {loopActive ? 'LOOP_ACTIVE' : 'LOOP_OFFLINE'}
                </div>
              )}
              {nodeLabel && (
                <div className="text-[9px] font-bold uppercase tracking-widest font-mono"
                  style={{ color: labelColor }}>
                  {nodeLabel}
                </div>
              )}
              {lastSyncTime && (
                <div className="text-[7px] uppercase tracking-widest mt-0.5" style={{ color: `${accentColor}99` }}>
                  Last_Sync: {lastSyncTime.toLocaleString([], { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="transition-transform duration-300 p-1"
            style={{ color: accentColor }}
            onClick={(e) => {
              e.stopPropagation()
              handleToggleCollapse()
            }}>
            <ChevronDown
              size={20}
              className={`transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-8 space-y-8 animate-in fade-in duration-300">
          {Object.entries(groupedParams).map(([groupName, groupParams]) => (
            <div key={groupName}>
              {groupedView && groupName !== 'General' && (
                <div className="mb-6 pb-4 border-b" style={{ borderColor: `${accentColor}22` }}>
                  <h3 className="text-xs uppercase font-bold tracking-[0.2em]" style={{ color: labelColor }}>
                    {groupName}
                  </h3>
                </div>
              )}

              <div className="space-y-8">
                {groupParams.map((param) => (
                  <div key={param.key}>
                    {param.type === 'range' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <div className="space-y-1">
                            <label
                              htmlFor={`param-${param.key}`}
                              className="text-[10px] uppercase font-bold tracking-widest block"
                              style={{ color: labelColor }}>
                              {param.label}
                            </label>
                            {param.description && (
                              <p className="text-[8px] uppercase tracking-tight" style={{ color: `${accentColor}66` }}>
                                {param.description}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-bold tabular-nums" style={{ color: accentColor }}>
                            {param.formatDisplay
                              ? param.formatDisplay(values[param.key])
                              : values[param.key]?.toFixed?.(2) ?? values[param.key]}
                          </span>
                        </div>
                        <input
                          id={`param-${param.key}`}
                          type="range"
                          min={param.min ?? 0}
                          max={param.max ?? 100}
                          step={param.step ?? 1}
                          value={values[param.key] ?? 0}
                          onChange={(e) => onUpdate(param.key, parseFloat(e.target.value))}
                          disabled={isLoading}
                          className="w-full h-1 rounded-lg appearance-none cursor-pointer accent-opacity-80 transition-all disabled:opacity-50"
                          style={{
                            accentColor: accentColor,
                            backgroundColor: `${accentColor}22`,
                          }}
                        />
                        {param.type === 'range' && param.min !== undefined && param.max !== undefined && (
                          <div className="flex justify-between text-[8px] font-bold uppercase tracking-tighter" style={{ color: `${accentColor}66` }}>
                            <span>Min</span>
                            <span>Max</span>
                          </div>
                        )}
                      </div>
                    )}

                    {param.type === 'text' && (
                      <div className="space-y-4">
                        <label
                          htmlFor={`param-${param.key}`}
                          className="text-[10px] uppercase font-bold tracking-widest block"
                          style={{ color: labelColor }}>
                          {param.label}
                        </label>
                        <input
                          id={`param-${param.key}`}
                          type="text"
                          value={values[param.key] ?? ''}
                          onChange={(e) => onUpdate(param.key, e.target.value)}
                          disabled={isLoading}
                          placeholder={param.label}
                          className="w-full px-4 py-2 text-xs focus:outline-none transition-colors font-mono border disabled:opacity-50"
                          style={{
                            backgroundColor: `${accentColor}05`,
                            borderColor: `${accentColor}33`,
                            color: accentColor,
                          }}
                        />
                      </div>
                    )}

                    {param.type === 'number' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <label
                            htmlFor={`param-${param.key}`}
                            className="text-[10px] uppercase font-bold tracking-widest"
                            style={{ color: labelColor }}>
                            {param.label}
                          </label>
                          <span className="text-xs font-bold" style={{ color: accentColor }}>
                            {values[param.key] ?? 0}
                          </span>
                        </div>
                        <input
                          id={`param-${param.key}`}
                          type="number"
                          value={values[param.key] ?? 0}
                          onChange={(e) => onUpdate(param.key, parseInt(e.target.value))}
                          min={param.min}
                          max={param.max}
                          step={param.step}
                          disabled={isLoading}
                          className="w-full px-4 py-2 text-xs focus:outline-none transition-colors font-mono border disabled:opacity-50"
                          style={{
                            backgroundColor: `${accentColor}05`,
                            borderColor: `${accentColor}33`,
                            color: accentColor,
                          }}
                        />
                      </div>
                    )}

                    {param.type === 'textarea' && (
                      <div className="space-y-4">
                        <label
                          htmlFor={`param-${param.key}`}
                          className="text-[10px] uppercase font-bold tracking-widest block"
                          style={{ color: labelColor }}>
                          {param.label}
                        </label>
                        <textarea
                          id={`param-${param.key}`}
                          value={values[param.key] ?? ''}
                          onChange={(e) => onUpdate(param.key, e.target.value)}
                          rows={param.rows ?? 4}
                          disabled={isLoading}
                          placeholder={param.label}
                          className="w-full px-3 py-2 text-xs focus:outline-none transition-colors font-mono border disabled:opacity-50"
                          style={{
                            backgroundColor: `${accentColor}05`,
                            borderColor: `${accentColor}33`,
                            color: accentColor,
                          }}
                        />
                        {param.description && (
                          <p className="text-[8px] uppercase tracking-widest leading-relaxed" style={{ color: `${accentColor}66` }}>
                            {param.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="w-full py-4 border text-[10px] font-bold uppercase tracking-[0.4em] transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed group/btn overflow-hidden relative hover:bg-opacity-100"
            style={{
              borderColor: accentColor,
              color: accentColor,
            }}>
            <span className="relative z-10">
              {isSaving ? `PUSHING_PARAMETERS...` : 'APPLY_CHANGES'}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface SystemStatus {
  isOnline: boolean
  isLoopActive: boolean
  isInitializing: boolean
  loopDetails: { a: boolean, b: boolean, unified: boolean } | null
  loopPauses: { a: boolean, b: boolean } | null
  loadStatus: { a: string, b: string } | null
  settings: {
    temperature_a: number
    temperature_b: number
    top_p: number
  } | null
}

interface SystemStatusContextType extends SystemStatus {
  refreshStatus: () => Promise<void>
}

const SystemStatusContext = createContext<SystemStatusContextType | undefined>(undefined)

export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SystemStatus>({
    isOnline: false,
    isLoopActive: false,
    isInitializing: true,
    loopDetails: null,
    loopPauses: null,
    loadStatus: null,
    settings: null
  })

  const refreshStatus = async () => {
    try {
      // Use our server-side proxy to avoid CORS issues
      const res = await fetch('/api/proxy/status', { cache: 'no-store' })
      if (!res.ok) throw new Error('Offline')
      const data = await res.json()
      setStatus({
        isOnline: true,
        isLoopActive: data.loop_active ?? false,
        isInitializing: false,
        loopDetails: data.loop_details ?? null,
        loopPauses: data.loop_pauses ?? null,
        loadStatus: data.load_status ?? null,
        settings: data.settings ?? null
      })
    } catch (err) {
      setStatus({
        isOnline: false,
        isLoopActive: false,
        isInitializing: false,
        loopDetails: null,
        loopPauses: null,
        loadStatus: null,
        settings: null
      })
    }
  }

  useEffect(() => {
    refreshStatus()
    const interval = setInterval(refreshStatus, 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <SystemStatusContext.Provider value={{ ...status, refreshStatus }}>
      {children}
    </SystemStatusContext.Provider>
  )
}

export function useSystemStatus() {
  const context = useContext(SystemStatusContext)
  if (context === undefined) {
    throw new Error('useSystemStatus must be used within a SystemStatusProvider')
  }
  return context
}

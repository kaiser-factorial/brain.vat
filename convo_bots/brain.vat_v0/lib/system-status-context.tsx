'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface SystemStatus {
  isOnline: boolean
  isLoopActive: boolean
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
    loadStatus: null,
    settings: null
  })

  const refreshStatus = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/status', { cache: 'no-store' })
      if (!res.ok) throw new Error('Offline')
      const data = await res.json()
      setStatus({
        isOnline: true,
        isLoopActive: data.loop_active ?? false,
        loadStatus: data.load_status ?? null,
        settings: data.settings ?? null
      })
    } catch (err) {
      setStatus({
        isOnline: false,
        isLoopActive: false,
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

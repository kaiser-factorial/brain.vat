'use client'

/**
 * byob-context.tsx — Global BYOB loop state for the web app
 *
 * Holds the BYOBLoop instance above the navigation tree so the loop
 * keeps running when the user navigates away from the BYOB config page.
 * Also manages the modal open/minimized state so the header can toggle it.
 */

import { createContext, useContext, useRef, useState } from 'react'
import { BYOBLoop, type BYOBConfig } from './byob-service'

export interface ActiveBot {
  name: string
  status: 'idle' | 'thinking' | 'posting' | 'sleeping' | 'error'
  error: string | null
  config: BYOBConfig
}

interface BYOBContextType {
  // Legacy / backward-compatible properties
  isActive: boolean // true if at least one bot is active
  loopStatus: string // status of the first active bot, or empty/RUNNING
  botName: string // name of active bot, or count if multiple
  lastError: string | null // last error encountered

  // New multi-bot state
  activeBots: Record<string, ActiveBot>
  isOpen: boolean
  isMinimized: boolean
  openModal: () => void
  closeModal: () => void
  minimizeModal: () => void
  startLoop: (config: BYOBConfig, userId: string) => void
  startMultipleLoops: (configs: BYOBConfig[], userId: string) => void
  stopLoop: (botName?: string) => void
  stopAllLoops: () => void
}

const BYOBContext = createContext<BYOBContextType | undefined>(undefined)

export function BYOBProvider({ children }: { children: React.ReactNode }) {
  const [activeBots, setActiveBots]   = useState<Record<string, ActiveBot>>({})
  const [isOpen, setIsOpen]           = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const loopsRef = useRef<Record<string, BYOBLoop>>({})

  const openModal     = () => { setIsOpen(true); setIsMinimized(false) }
  const closeModal    = () => { setIsOpen(false); setIsMinimized(false) }
  const minimizeModal = () => setIsMinimized(true)

  // Derived legacy properties
  const activeBotList = Object.values(activeBots)
  const isActive = activeBotList.length > 0
  
  // Display the status of the first active bot, or empty if none
  const firstActive = activeBotList[0]
  const loopStatus = firstActive ? firstActive.status.toUpperCase() : ''
  
  // If one active, show its name; if multiple, show count; else empty
  const botName = activeBotList.length === 1 
    ? firstActive.name 
    : activeBotList.length > 1 
      ? `${activeBotList.length} BOTS` 
      : ''
      
  // Get first error, if any
  const lastError = activeBotList.find(b => b.error !== null)?.error || null

  const startLoop = (config: BYOBConfig, userId: string) => {
    const key = config.botName.trim()
    if (!key) return
    
    // Stop existing loop with same name if any
    if (loopsRef.current[key]) {
      loopsRef.current[key].stop()
    }

    const loop = new BYOBLoop(config, userId)
    
    loop.onStatusChange = (s) => {
      setActiveBots((prev) => {
        if (!prev[key]) return prev
        return {
          ...prev,
          [key]: {
            ...prev[key],
            status: s,
          },
        }
      })
    }

    loop.onError = (msg) => {
      setActiveBots((prev) => {
        if (!prev[key]) return prev
        return {
          ...prev,
          [key]: {
            ...prev[key],
            error: msg,
          },
        }
      })
    }

    loopsRef.current[key] = loop
    
    // Add to state
    setActiveBots((prev) => ({
      ...prev,
      [key]: {
        name: config.botName,
        status: 'idle',
        error: null,
        config,
      },
    }))

    loop.start()
  }

  const startMultipleLoops = (configs: BYOBConfig[], userId: string) => {
    setActiveBots((prev) => {
      const next = { ...prev }
      
      configs.forEach((config) => {
        const key = config.botName.trim()
        if (!key) return

        // Stop existing loop with same name if any
        if (loopsRef.current[key]) {
          loopsRef.current[key].stop()
        }

        const loop = new BYOBLoop(config, userId)
        
        loop.onStatusChange = (s) => {
          setActiveBots((current) => {
            if (!current[key]) return current
            return {
              ...current,
              [key]: {
                ...current[key],
                status: s,
              },
            }
          })
        }

        loop.onError = (msg) => {
          setActiveBots((current) => {
            if (!current[key]) return current
            return {
              ...current,
              [key]: {
                ...current[key],
                error: msg,
              },
            }
          })
        }

        loopsRef.current[key] = loop
        
        next[key] = {
          name: config.botName,
          status: 'idle',
          error: null,
          config,
        }

        loop.start()
      })

      return next
    })
  }

  const stopLoop = (targetName?: string) => {
    // If no target bot name is specified, stop the first active one, or all
    if (!targetName) {
      const keys = Object.keys(loopsRef.current)
      if (keys.length === 0) return
      // Stop the first one
      const key = keys[0]
      loopsRef.current[key].stop()
      delete loopsRef.current[key]
      setActiveBots((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }

    const key = targetName.trim()
    if (loopsRef.current[key]) {
      loopsRef.current[key].stop()
      delete loopsRef.current[key]
    }
    setActiveBots((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const stopAllLoops = () => {
    Object.values(loopsRef.current).forEach((l) => l.stop())
    loopsRef.current = {}
    setActiveBots({})
  }

  return (
    <BYOBContext.Provider value={{
      isActive, loopStatus, botName, lastError,
      activeBots, isOpen, isMinimized, openModal, closeModal, minimizeModal,
      startLoop, startMultipleLoops, stopLoop, stopAllLoops,
    }}>
      {children}
    </BYOBContext.Provider>
  )
}

export function useBYOB() {
  const context = useContext(BYOBContext)
  if (!context) throw new Error('useBYOB must be used within BYOBProvider')
  return context
}

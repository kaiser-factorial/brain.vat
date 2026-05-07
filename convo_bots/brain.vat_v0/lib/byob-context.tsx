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

interface BYOBContextType {
  isActive: boolean
  loopStatus: string
  botName: string
  lastError: string | null
  isOpen: boolean
  isMinimized: boolean
  openModal: () => void
  closeModal: () => void
  minimizeModal: () => void
  startLoop: (config: BYOBConfig, userId: string) => void
  stopLoop: () => void
}

const BYOBContext = createContext<BYOBContextType | undefined>(undefined)

export function BYOBProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive]       = useState(false)
  const [loopStatus, setLoopStatus]   = useState('')
  const [botName, setBotName]         = useState('')
  const [lastError, setLastError]     = useState<string | null>(null)
  const [isOpen, setIsOpen]           = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const loopRef = useRef<BYOBLoop | null>(null)

  const openModal     = () => { setIsOpen(true); setIsMinimized(false) }
  const closeModal    = () => { setIsOpen(false); setIsMinimized(false) }
  const minimizeModal = () => setIsMinimized(true)

  const startLoop = (config: BYOBConfig, userId: string) => {
    if (loopRef.current?.isRunning()) return
    const loop = new BYOBLoop(config, userId)
    loop.onStatusChange = (s) => setLoopStatus(s.toUpperCase())
    loop.onError        = (msg) => setLastError(msg)
    loopRef.current     = loop
    loop.start()
    setBotName(config.botName)
    setIsActive(true)
    setLastError(null)
  }

  const stopLoop = () => {
    loopRef.current?.stop()
    loopRef.current = null
    setIsActive(false)
    setLoopStatus('')
    setBotName('')
  }

  return (
    <BYOBContext.Provider value={{
      isActive, loopStatus, botName, lastError,
      isOpen, isMinimized, openModal, closeModal, minimizeModal,
      startLoop, stopLoop,
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

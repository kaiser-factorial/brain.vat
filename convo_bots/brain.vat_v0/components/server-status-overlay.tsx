'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function ServerStatusOverlay() {
  const [isDown, setIsDown] = useState(false)
  const [reason, setReason] = useState<'server' | 'loop' | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('http://localhost:5001/api/status', { cache: 'no-store' })
        if (!res.ok) throw new Error('Server issues')
        
        const data = await res.json()
        if (data.loop_active === false) {
          setIsDown(true)
          setReason('loop')
        } else {
          setIsDown(false)
          setReason(null)
        }
      } catch (err) {
        setIsDown(true)
        setReason('server')
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  if (!isDown) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
      <div className="w-full max-w-md p-6 bg-black border-2 border-terminal-green shadow-[0_0_50px_rgba(0,255,65,0.2)] font-mono relative overflow-hidden">
        {/* Terminal Header */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-terminal-green/20 flex items-center px-2 gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-terminal-green/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-terminal-green/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-terminal-green/40" />
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-terminal-green animate-pulse">&gt;&gt;&gt;</span>
            <h2 className="text-xl font-bold text-terminal-green uppercase tracking-tighter">
              {reason === 'server' ? 'Inference Server Offline' : 'Dialogue Loop Inactive'}
            </h2>
          </div>

          <div className="p-3 bg-terminal-green/5 border border-terminal-green/20 text-[11px] leading-relaxed text-terminal-green/80">
            <p>CRITICAL_ERROR: Connection to the symbolic processing unit has been lost. Autonomous dialogue generation is suspended.</p>
            <p className="mt-2 text-terminal-green/50 italic">// ensure server.py and loop.py are active</p>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <Link 
              href="/about" 
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors uppercase tracking-widest font-bold"
            >
              [about]
            </Link>
            <Link 
              href="/archive" 
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors uppercase tracking-widest font-bold"
            >
              [archive]
            </Link>
          </div>
        </div>

        {/* Scanline effect for this specific box */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </div>
    </div>
  )
}

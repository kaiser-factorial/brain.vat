'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Vitals {
  temperature_a: number
  temperature_b: number
  top_p: number
}

export function StabilityVitals() {
  const [vitals, setVitals] = useState<Vitals | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVitals = async () => {
      try {
        const res = await fetch('http://127.0.0.1:5001/api/status')
        const data = await res.json()
        if (data.settings) {
          setVitals(data.settings)
        }
      } catch (err) {
        console.error('[Vitals] Failed to fetch:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchVitals()
    const interval = setInterval(fetchVitals, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading || !vitals) return <div className="text-[10px] text-muted-foreground font-mono opacity-50">vitals: scanning...</div>

  return (
    <div className="flex items-center gap-4 font-mono text-[10px] uppercase">
      <div className="flex items-center gap-1 group">
        <span className="text-muted-foreground">temp_a:</span>
        <span className="text-mauk animate-pulse">{vitals.temperature_a.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-1 group">
        <span className="text-muted-foreground">temp_b:</span>
        <span className="text-abaci animate-pulse">{vitals.temperature_b.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-1 group">
        <span className="text-muted-foreground">top_p:</span>
        <span className="text-terminal-green">{vitals.top_p.toFixed(2)}</span>
      </div>
      <div className="hidden sm:block ml-2 px-1 bg-terminal-green/10 text-terminal-green scale-75 border border-terminal-green/30">
        stable_state
      </div>
    </div>
  )
}

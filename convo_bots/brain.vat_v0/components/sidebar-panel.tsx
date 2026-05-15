'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StabilityVitals } from './stability-vitals'
import type { MemoryConcept, Bot } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SidebarPanelProps {
  owner: 'MAUK' | 'ABACI'
  side: 'left' | 'right'
}

export function SidebarPanel({ owner, side }: SidebarPanelProps) {
  const [concepts, setConcepts] = useState<MemoryConcept[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Map owner name to bot identifier
  const bot: Bot = owner === 'MAUK' ? 'a' : 'b'

  useEffect(() => {
    const fetchConcepts = async () => {
      try {
        const { data, error } = await supabase
          .from('memory_concepts')
          .select('*')
          .eq('bot', bot)
          .order('weight', { ascending: false })
          .limit(10)
        
        if (error) {
          setError(error.message)
          throw error
        }
        
        if (data) {
          setConcepts(data)
          setError(null)
        }
      } catch (err: any) {
        const msg = err?.message || JSON.stringify(err)
        console.error(`[Sidebar] Failed for ${owner} (${bot}):`, msg)
        setError(msg)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConcepts()

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`concepts-${bot}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'memory_concepts',
          filter: `bot=eq.${bot}`
        },
        () => {
          fetchConcepts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, bot])

  const [hoveredConcept, setHoveredConcept] = useState<string | null>(null)
  const [sourceText, setSourceText] = useState<string | null>(null)

  const handleMouseEnter = async (concept: string) => {
    setHoveredConcept(concept)
    setSourceText('recalling...')
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      const res = await fetch(`${baseUrl}/api/memory/source/${bot}/${concept}`, { cache: 'no-store' })
      const data = await res.json()
      setSourceText(data.source_text)
    } catch (err) {
      setSourceText('(error recalling)')
    }
  }

  const isMAUK = owner === 'MAUK'
  const colorClass = isMAUK ? 'text-mauk' : 'text-abaci'
  const glowClass = isMAUK ? 'mauk-glow' : 'abaci-glow'

  return (
    <div className={cn(
      'h-full border-border p-4 flex flex-col min-w-[200px] bg-background/50 backdrop-blur-sm',
      side === 'left' ? 'border-r' : 'border-l'
    )}>
      <h2 className={cn('text-lg font-bold mb-1 tracking-tighter uppercase', colorClass, glowClass)}>
        {owner === 'MAUK' ? 'MAUK_v2.1' : 'ABACI_v2.1'}
      </h2>
      
      <div className="mb-4 pb-2 border-b border-border/30">
        <StabilityVitals bot={bot} />
      </div>
      
      <div className={cn(
        "flex-1 space-y-4 overflow-y-auto scrollbar-none px-2",
      )}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground opacity-50 font-mono">scanning<span className="cursor-blink">_</span></p>
        ) : error ? (
          <div className="text-xs text-red-900 bg-red-950/20 p-2 border border-red-900/50 font-mono">
            ERR: {error}
          </div>
        ) : concepts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic animate-pulse font-mono">no memories yet</p>
        ) : (
          concepts.map((concept) => {
            const hasValidSource = sourceText && 
                                   sourceText !== 'recalling...' && 
                                   sourceText !== '(Context lost to time)' && 
                                   sourceText !== '(error recalling)' &&
                                   sourceText !== '(Source unavailable — offline mode)'

            return (
              <div
                key={concept.id}
                className="group relative cursor-help px-2"
                onMouseEnter={() => handleMouseEnter(concept.concept)}
                onMouseLeave={() => setHoveredConcept(null)}
              >
                <div 
                  className={cn(
                    "flex items-baseline gap-2 transition-all duration-300 hover:scale-105 hover:opacity-100 hover:brightness-125",
                    "text-opacity-60",
                    side === 'left' ? 'flex-row origin-left' : 'flex-row origin-left'
                  )}
                  style={{ opacity: 0.5 + (concept.weight / 10) * 0.5 }}
                >
                  <span className={cn(
                    'font-mono font-medium flex-1 min-w-0 text-xs', 
                    colorClass,
                    'text-left'
                  )}>
                    {concept.concept}
                  </span>
                  <span className={cn(
                    "text-muted-foreground text-[10px] opacity-40 group-hover:opacity-80 transition-opacity font-mono shrink-0 w-[42px]",
                    'text-right'
                  )}>
                    [{(concept.weight * 10).toFixed(0)}%]
                  </span>
                </div>
                
                {hoveredConcept === concept.concept && hasValidSource && (
                  <div className={cn(
                    "absolute z-50 top-full mt-1 p-2 bg-card border border-border rounded shadow-2xl text-[10px] leading-tight animate-in fade-in slide-in-from-top-1 w-[220px] font-mono",
                    side === 'left' ? 'left-0' : 'right-0'
                  )}>
                    <div className="text-muted-foreground font-bold mb-1 opacity-50 uppercase tracking-widest">[SOURCE RECALL]</div>
                    <div className="italic text-foreground/90 leading-normal">"{sourceText}"</div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

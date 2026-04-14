'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
      const res = await fetch(`http://127.0.0.1:5001/api/memory/source/${bot}/${concept}`)
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
      'h-full border-border p-4 flex flex-col min-w-[180px]',
      side === 'left' ? 'border-r' : 'border-l'
    )}>
      <h2 className={cn('text-lg font-bold mb-4', colorClass, glowClass)}>
        {owner}
      </h2>
      
      <div className="flex-1 space-y-3 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">scanning<span className="cursor-blink">_</span></p>
        ) : error ? (
          <div className="text-xs text-red-900 bg-red-950/20 p-2 border border-red-900/50">
            ERR: {error}
          </div>
        ) : concepts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic animate-pulse">no memories yet</p>
        ) : (
          concepts.map((concept) => (
            <div
              key={concept.id}
              className="group relative cursor-help"
              onMouseEnter={() => handleMouseEnter(concept.concept)}
              onMouseLeave={() => setHoveredConcept(null)}
            >
              <div 
                className="text-sm transition-opacity duration-300"
                style={{ opacity: 0.3 + (concept.weight / 10) * 0.7 }}
              >
                <span className={cn('font-mono', colorClass)}>{concept.concept}</span>
                <span className="text-muted-foreground ml-2 text-[10px] opacity-50">
                  [{(concept.weight * 10).toFixed(0)}%]
                </span>
              </div>
              
              {hoveredConcept === concept.concept && (
                <div className={cn(
                  "absolute z-50 top-full mt-1 p-2 bg-card border border-border rounded shadow-xl text-[10px] leading-tight animate-in fade-in slide-in-from-top-1 w-[200px]",
                  side === 'left' ? 'left-0' : 'right-0'
                )}>
                  <div className="text-muted-foreground font-bold mb-1">[SOURCE RECALL]</div>
                  <div className="italic text-foreground/90 font-mono">"{sourceText}"</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

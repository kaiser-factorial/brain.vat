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
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Map owner name to bot identifier
  const bot: Bot = owner === 'MAUK' ? 'a' : 'b'

  useEffect(() => {
    const fetchConcepts = async () => {
      const { data } = await supabase
        .from('memory_concepts')
        .select('*')
        .eq('bot', bot)
        .order('weight', { ascending: false })
        .limit(10)
      
      if (data) {
        setConcepts(data)
      }
      setIsLoading(false)
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

  const isMAUK = owner === 'MAUK'
  const colorClass = isMAUK ? 'text-mauk' : 'text-abaci'
  const glowClass = isMAUK ? 'mauk-glow' : 'abaci-glow'

  return (
    <div className={cn(
      'h-full border-border p-4 flex flex-col',
      side === 'left' ? 'border-r' : 'border-l'
    )}>
      <h2 className={cn('text-lg font-bold mb-4', colorClass, glowClass)}>
        {owner}
      </h2>
      
      <div className="flex-1 space-y-2 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">scanning<span className="cursor-blink">_</span></p>
        ) : concepts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic animate-pulse">no memories yet</p>
        ) : (
          concepts.map((concept) => (
            <div
              key={concept.id}
              className="text-sm"
              style={{ opacity: 0.3 + (concept.weight / 10) * 0.7 }}
            >
              <span className={cn(colorClass)}>{concept.concept}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                [{(concept.weight * 10).toFixed(0)}%]
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { cn } from '@/lib/utils'
import { useSystemStatus } from '@/lib/system-status-context'
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip'

interface ArchiveRecord {
  id: string
  bot: 'a' | 'b'
  concept: string
  source_text?: string
  last_thought_at: string
}

export default function ArchivePage() {
  const [records, setRecords] = useState<ArchiveRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredConcept, setHoveredConcept] = useState<{ bot: string, concept: string } | null>(null)
  const [sourceText, setSourceText] = useState<string | null>(null)
  const { isOnline } = useSystemStatus()

  useEffect(() => {
    const fetchArchive = async () => {
      try {
        const res = await fetch('http://localhost:5001/api/memory/archive')
        if (!res.ok) throw new Error('Offline')
        const data = await res.json()
        setRecords(data)
      } catch (err) {
        console.error('[Archive] Failed to fetch:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchArchive()
  }, [])

  // Partitioning logic for the Venn Diagram
  const botAConcepts = new Set(records.filter(r => r.bot === 'a').map(r => r.concept))
  const botBConcepts = new Set(records.filter(r => r.bot === 'b').map(r => r.concept))

  const groupA = Array.from(botAConcepts).filter(c => !botBConcepts.has(c))
  const groupB = Array.from(botBConcepts).filter(c => !botAConcepts.has(c))
  const common = Array.from(botAConcepts).filter(c => botBConcepts.has(c))

  const handleMouseEnter = async (bot: string, concept: string) => {
    setHoveredConcept({ bot, concept })
    if (!isOnline) {
      setSourceText('(Source unavailable — offline mode)')
      return
    }
    setSourceText('recalling...')
    try {
      const res = await fetch(`http://localhost:5001/api/memory/source/${bot}/${concept}`)
      if (!res.ok) throw new Error('Offline')
      const data = await res.json()
      setSourceText(data.source_text)
    } catch (err) {
      setSourceText('(error recalling)')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      
      <main className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-bold text-primary tracking-tighter uppercase mb-2">Deep Archive</h1>
          <p className="text-xs text-muted-foreground uppercase opacity-50 tracking-widest">
            the conceptual Venn diagram
          </p>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center font-mono text-sm text-muted-foreground">
            indexing_the_unconscious<span className="cursor-blink">_</span>
          </div>
        ) : (
          <TooltipProvider delayDuration={0}>
            <div className="flex-1 grid grid-cols-3 gap-8 overflow-hidden">
              
              {/* Column A: MAUK Exclusive */}
              <div className="flex flex-col border border-mauk/20 bg-mauk/5 p-4 rounded-sm group">
                <h2 className="text-mauk text-sm font-bold mb-4 uppercase tracking-tighter flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-mauk mauk-glow animate-pulse" />
                  MAUK / EXCLUSIVE
                </h2>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                  {groupA.map(c => (
                    <MemoryNode 
                      key={c} 
                      concept={c} 
                      bot="a" 
                      theme="mauk"
                      onHover={handleMouseEnter}
                      isShowing={hoveredConcept?.concept === c}
                      source={sourceText}
                    />
                  ))}
                </div>
              </div>

              {/* Column Common: Shared Minds */}
              <div className="flex flex-col border border-primary/30 bg-primary/5 p-4 rounded-sm shadow-[0_0_20px_rgba(230,57,70,0.1)] text-center">
                <h2 className="text-primary text-sm font-bold mb-4 uppercase tracking-tighter flex items-center gap-2 justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  SHARED OBSESSIONS
                  <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                </h2>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
                  {common.map(c => (
                    <MemoryNode 
                      key={c} 
                      concept={c} 
                      bot="a" // Use bot A's source as default proxy
                      theme="primary"
                      onHover={handleMouseEnter}
                      isShowing={hoveredConcept?.concept === c}
                      source={sourceText}
                    />
                  ))}
                </div>
              </div>

              {/* Column B: ABACI Exclusive */}
              <div className="flex flex-col border border-abaci/20 bg-abaci/5 p-4 rounded-sm">
                <h2 className="text-abaci text-sm font-bold mb-4 uppercase tracking-tighter flex items-center gap-2 justify-end">
                  ABACI / EXCLUSIVE
                  <div className="w-2 h-2 rounded-full bg-abaci abaci-glow animate-pulse" />
                </h2>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin text-right">
                  {groupB.map(c => (
                    <MemoryNode 
                      key={c} 
                      concept={c} 
                      bot="b" 
                      theme="abaci"
                      onHover={handleMouseEnter}
                      isShowing={hoveredConcept?.concept === c}
                      source={sourceText}
                    />
                  ))}
                </div>
              </div>

            </div>
          </TooltipProvider>
        )}
      </main>
    </div>
  )
}

function MemoryNode({ concept, bot, theme, onHover, isShowing, source }: any) {
  const hasValidSource = source && 
                         source !== 'recalling...' && 
                         source !== '(Context lost to time)' && 
                         source !== '(error recalling)' &&
                         source !== '(Source unavailable — offline mode)'

  return (
    <Tooltip open={isShowing && hasValidSource}>
      <TooltipTrigger asChild>
        <div 
          className="relative group cursor-help px-4"
          onMouseEnter={() => onHover(bot, concept)}
        >
          <div className={cn(
            "text-sm font-mono transition-all duration-300 hover:scale-110",
            theme === 'mauk' ? 'text-mauk hover:text-mauk/100 text-opacity-70 origin-left' :
            theme === 'abaci' ? 'text-abaci hover:text-abaci/100 text-opacity-70 origin-right' :
            'text-primary font-bold animate-pulse origin-center'
          )}>
            {concept}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent 
        side="top"
        className="p-3 bg-card border border-border rounded-lg shadow-2xl text-[10px] leading-tight w-[240px] z-[100]"
      >
        <div className="text-muted-foreground font-bold mb-1 uppercase tracking-widest">[RECALLING FRAGMENT]</div>
        <div className="italic text-foreground overflow-hidden text-ellipsis line-clamp-4">
          "{source}"
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

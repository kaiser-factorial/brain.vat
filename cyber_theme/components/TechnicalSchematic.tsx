'use client'

import { cn } from '@/lib/utils'

export interface SchematicItem {
  component: string    // Component name (e.g., "BRAIN")
  location: string     // Implementation location (e.g., "Hugging Face")
  role: string         // Component role (e.g., "Inference Engine")
}

export interface TechnicalSchematicProps {
  items?: SchematicItem[]
  className?: string
}

export function TechnicalSchematic({
  items = [
    { component: 'BRAIN', role: 'Inference Engine', location: 'Hugging Face' },
    { component: 'SPINE', role: 'Protocol API', location: 'Python/Flask' },
    { component: 'MEMORY', role: 'Persistence', location: 'Supabase' },
    { component: 'INTERFACE', role: 'Control Panel', location: 'Next.js' },
  ],
  className,
}: TechnicalSchematicProps) {
  return (
    <section className={cn("mb-16", className)}>
      <h3 className="text-xl font-bold text-[#00FF00] mb-6 tracking-tighter">
        [TECHNICAL_SCHEMATIC]
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 p-1 bg-terminal-green/10 border border-[#00FF00]/35 rounded-lg overflow-hidden backdrop-blur-sm">
        {items.map((item) => (
          <div
            key={item.component}
            className="bg-black/40 p-4 hover:bg-terminal-green/5 transition-colors group">
            <div className="text-[10px] text-[#00FF00]/40 uppercase tracking-[0.2em] mb-1 font-bold">
              {item.component}
            </div>
            <div className="text-xs font-bold text-[#00FF00] mb-2 tracking-wide group-hover:text-white transition-colors uppercase">
              {item.location}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground opacity-85 tracking-wider font-bold underline decoration-primary/20">
              {item.role}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Brain.vat preset: System architecture
export function BrainVatSystemArchitecture(props?: Omit<TechnicalSchematicProps, 'items'>) {
  return <TechnicalSchematic {...props} />
}

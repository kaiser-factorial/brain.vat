'use client'

import { cn } from '@/lib/utils'

export interface SchematicItem {
  component: string    // Component name (e.g., "BRAIN")
  role: string        // Component role (e.g., "Inference Engine")
  location: string    // Implementation location (e.g., "Hugging Face")
  icon?: string       // Optional icon/emoji
}

export interface TechnicalSchematicProps {
  // Required
  items: SchematicItem[]

  // Optional appearance
  accentColor?: string     // Primary color (default: '#00FF00')
  title?: string          // Section title (default: '[TECHNICAL_SCHEMATIC]')
  columns?: 2 | 3 | 4     // Grid columns (default: 4)
  layout?: 'grid' | 'row' // Layout style (default: 'grid')

  // Optional styling
  className?: string
  itemClassName?: string
  showBorder?: boolean     // Show border (default: true)
  interactive?: boolean    // Enable hover effects (default: true)
}

export function TechnicalSchematic({
  items,
  accentColor = '#00FF00',
  title = '[TECHNICAL_SCHEMATIC]',
  columns = 4,
  layout = 'grid',
  className,
  itemClassName,
  showBorder = true,
  interactive = true,
}: TechnicalSchematicProps) {
  const gridColsClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns]

  const containerClasses = cn(
    'grid gap-1 grid-cols-2 md:grid-cols-4 p-1 rounded-lg overflow-hidden backdrop-blur-sm border',
    className
  )

  return (
    <section className="space-y-4">
      {title && (
        <h3
          className="text-xl font-bold mb-6 tracking-tighter uppercase text-[#00FF00]">
          {title}
        </h3>
      )}

      <div
        className={containerClasses}
        style={{
          backgroundColor: '#00FF00' + '10',
          borderColor: '#00FF00' + '/35',
        }}>
        {items.map((item) => (
          <SchematicItemCard
            key={item.component}
            item={item}
            accentColor={accentColor}
            interactive={interactive}
            className={itemClassName}
          />
        ))}
      </div>
    </section>
  )
}

interface SchematicItemCardProps {
  item: SchematicItem
  accentColor: string
  interactive: boolean
  className?: string
}

function SchematicItemCard({
  item,
  accentColor,
  interactive,
  className,
}: SchematicItemCardProps) {
  return (
    <div
      className={cn(
        'bg-black/40 p-4 hover:bg-terminal-green/5 transition-colors group',
        className
      )}>
      {/* Component Name */}
      <div
        className="text-[10px] text-[#00FF00]/40 uppercase tracking-[0.2em] mb-1 font-bold">
        {item.component}
      </div>

      {/* Location */}
      <div
        className="text-xs font-bold text-[#00FF00] mb-2 tracking-wide group-hover:text-white transition-colors uppercase">
        {item.location}
      </div>

      {/* Role */}
      <div className="text-[10px] font-mono text-muted-foreground opacity-85 tracking-wider font-bold underline decoration-primary/20">
        {item.role}
      </div>
    </div>
  )
}

// Brain.vat preset: System architecture
export function BrainVatSystemArchitecture(props?: Omit<TechnicalSchematicProps, 'items'>) {
  const items: SchematicItem[] = [
    { component: 'BRAIN', role: 'Inference Engine', location: 'Hugging Face' },
    { component: 'SPINE', role: 'Protocol API', location: 'Python/Flask' },
    { component: 'MEMORY', role: 'Persistence', location: 'Supabase' },
    { component: 'INTERFACE', role: 'Control Panel', location: 'Next.js' },
  ]

  return (
    <TechnicalSchematic
      items={items}
      accentColor="#00FF00"
      title="[TECHNICAL_SCHEMATIC]"
      columns={4}
      {...props}
    />
  )
}

// Generic preset with custom items
export function CustomSystemArchitecture(
  items: SchematicItem[],
  props?: Omit<TechnicalSchematicProps, 'items'>
) {
  return <TechnicalSchematic items={items} {...props} />
}

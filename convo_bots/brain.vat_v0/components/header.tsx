'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useBYOB } from '@/lib/byob-context'
import { FileModal } from './file-modal'
import Link from 'next/link'
import { StabilityVitals } from './stability-vitals'
import { useSystemStatus } from '@/lib/system-status-context'
import { VoiceToggle } from './voice-toggle'
import { cn } from '@/lib/utils'
import { NeonDivider, CyberButton, CyberButtonGroup } from 'ccru/components'
import { useRouter, usePathname } from 'next/navigation'

function SystemStatusIndicator() {
  const { isOnline, isLoopActive } = useSystemStatus()
  
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 group cursor-default">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase text-red-900 font-bold">
          SYSTEM STATUS: OFFLINE
        </span>
      </div>
    )
  }

  if (!isLoopActive) {
    return (
      <div className="flex items-center gap-2 group cursor-default">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase text-amber-700 font-bold">
          SYSTEM STATUS: IDLE
        </span>
      </div>
    )
  }
  
  return (
    <div className="flex items-center gap-2 group cursor-default">
      <div className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
      <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase text-terminal-green font-bold">
        SYSTEM STATUS: ONLINE
      </span>
    </div>
  )
}

interface HeaderProps {
  onAuthClick?: () => void
}

function NavLink({ href, children, onClick, active, shortcut }: { href?: string; children: React.ReactNode; onClick?: () => void; active?: boolean; shortcut?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const isCurrent = active || (href && pathname === href)

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (href) {
      router.push(href)
    }
  }

  return (
    <CyberButton 
      onClick={handleClick} 
      active={isCurrent}
      shortcut={shortcut}
      className={cn(
        "font-mono px-4 border-r border-[#10ff50]/10 last:border-r-0",
        isCurrent ? "bg-[#10ff50]/20 text-[#10ff50]" : "text-muted-foreground"
      )}
      size="sm"
    >
      {children}
    </CyberButton>
  )
}

export function Header({ onAuthClick }: HeaderProps) {
  const [showFiles, setShowFiles] = useState(false)
  const { user, displayName, isLoading, signOut } = useAuth()
  const { isActive: byobActive, botName: byobBotName, openModal: openBYOB } = useBYOB()

  return (
    <>
      <header className="bg-header-bg backdrop-blur-md px-6 py-4 relative overflow-hidden noise-overlay z-50">
        <div className="absolute inset-x-0 bottom-0 neon-pulse" style={{ '--pulse-color': '#E63946' } as any}>
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_15px_rgba(230,57,70,0.4)]" />
        </div>
        
        <div className="flex items-center justify-between relative z-10">
          {/* Left: Branding & Main Nav */}
          <div className="flex items-center gap-8 flex-1">
            <Link href="/">
              <h1 className="text-2xl font-black text-primary cursor-pointer branding-pulse tracking-tighter flex items-center gap-2">
                <span className="bg-primary text-background px-1.5 py-0.5 rounded-sm text-sm">VAT</span>
                brain.vat
              </h1>
            </Link>
            
            <nav className="hidden md:flex items-center">
              <CyberButtonGroup>
                <NavLink href="/about" shortcut="a">about</NavLink>
                <NavLink href="/archive" shortcut="r">archive</NavLink>
                {user && (
                  <NavLink onClick={openBYOB} active={byobActive} shortcut="b">
                    {byobActive ? byobBotName : 'byob'}
                  </NavLink>
                )}
              </CyberButtonGroup>
            </nav>
          </div>

          {/* Center: System Status */}
          <div className="flex flex-col items-center gap-1.5">
            <SystemStatusIndicator />
            <div className="h-[2px] w-12 bg-border/30 rounded-full" />
          </div>

          {/* Right: User & Utilities */}
          <div className="flex items-center gap-6 flex-1 justify-end">
            <CyberButtonGroup>
              {!isLoading && user && (
                <div className="flex items-center">
                  {user?.email === 'kaiser.factorial@gmail.com' && (
                    <NavLink href="/admin" shortcut="c">control</NavLink>
                  )}
                </div>
              )}

              {!isLoading && (
                <div className="flex items-center">
                  {user ? (
                    <div className="px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-terminal-green/50 font-mono">
                      [VAT_PERSISTENCE_ACTIVE]
                    </div>
                  ) : (
                    <NavLink onClick={onAuthClick} shortcut="l">authenticate</NavLink>
                  )}
                </div>
              )}
            </CyberButtonGroup>

            {user && (
              <div className="flex flex-col items-end border-l border-border/30 pl-6">
                <span className="text-[10px] font-bold text-terminal-green tracking-widest font-mono">
                  {(displayName?.toUpperCase() === 'CORINA' ? 'BRICK.FACTORIAL' : displayName) || 'anon'}
                </span>
                <span className="text-[8px] text-muted-foreground opacity-50 font-mono text-right">SESSION: ACTIVE</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-1">
          <p className="text-[10px] text-muted-foreground/60 text-center font-mono uppercase tracking-[0.2em]">
            a conversation between <span className="text-mauk mauk-glow">MAUK_v2.1</span> and <span className="text-abaci abaci-glow">ABACI_v2.1</span>
          </p>
          <VoiceToggle />
        </div>
      </header>

      <FileModal isOpen={showFiles} onClose={() => setShowFiles(false)} />
    </>
  )
}


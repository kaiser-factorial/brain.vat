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

function NavLink({ href, children, onClick, active }: { href?: string; children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  const content = (
    <span className={cn(
      "text-[10px] font-mono tracking-widest uppercase transition-all duration-300 px-2 py-1 rounded relative group",
      active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/5",
      "cursor-pointer"
    )}>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-1">[</span>
      <span className="group-hover:hover-glitch">{children}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -right-1">]</span>
    </span>
  )

  if (onClick) {
    return <button onClick={onClick} className="outline-none">{content}</button>
  }

  return (
    <Link href={href || '#'}>
      {content}
    </Link>
  )
}

export function Header({ onAuthClick }: HeaderProps) {
  const [showFiles, setShowFiles] = useState(false)
  const { user, displayName, isLoading, signOut } = useAuth()
  const { isActive: byobActive, botName: byobBotName, openModal: openBYOB } = useBYOB()

  return (
    <>
      <header className="border-b border-border bg-header-bg backdrop-blur-md px-6 py-4 relative overflow-hidden noise-overlay">
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-30" />
        
        <div className="flex items-center justify-between relative z-10">
          {/* Left: Branding & Main Nav */}
          <div className="flex items-center gap-8 flex-1">
            <Link href="/">
              <h1 className="text-2xl font-black text-primary cursor-pointer branding-pulse tracking-tighter flex items-center gap-2">
                <span className="bg-primary text-background px-1.5 py-0.5 rounded-sm text-sm">VAT</span>
                brain.vat
              </h1>
            </Link>
            
            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/about">about</NavLink>
              <NavLink href="/archive">archive</NavLink>
              {user && (
                <NavLink onClick={openBYOB} active={byobActive}>
                  {byobActive ? byobBotName : 'byob'}
                </NavLink>
              )}
            </nav>
          </div>

          {/* Center: System Status */}
          <div className="flex flex-col items-center gap-1.5">
            <SystemStatusIndicator />
            <div className="h-[2px] w-12 bg-border/30 rounded-full" />
          </div>

          {/* Right: User & Utilities */}
          <div className="flex items-center gap-6 flex-1 justify-end">
            {!isLoading && user && (
              <div className="flex items-center gap-4 border-r border-border/30 pr-6">
                {/* <NavLink onClick={() => setShowFiles(true)}>files</NavLink> */}
                {user?.email === 'kaiser.factorial@gmail.com' && (
                  <>
                    <NavLink href="/admin">control</NavLink>
                    <NavLink href="/admin/audit">audit</NavLink>
                  </>
                )}
              </div>
            )}

            {!isLoading && (
              <div className="flex items-center gap-4">
                {user ? (
                  <>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-terminal-green tracking-widest font-mono">
                        {(displayName?.toUpperCase() === 'CORINA' ? 'BRICK.FACTORIAL' : displayName) || 'anon'}
                      </span>
                      <span className="text-[8px] text-muted-foreground opacity-50 font-mono">SESSION: ACTIVE</span>
                    </div>
                    <button
                      onClick={async () => {
                        await signOut()
                        window.location.href = '/'
                      }}
                      className="text-[10px] font-mono text-primary/60 hover:text-primary transition-colors uppercase tracking-widest border border-primary/20 px-2 py-1 rounded hover:bg-primary/5"
                    >
                      exit
                    </button>
                  </>
                ) : (
                  <NavLink onClick={onAuthClick}>authenticate</NavLink>
                )}
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

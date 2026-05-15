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
import { NeonDivider, CyberButton, CyberButtonGroup, CyberCheckbox } from 'ccru/components'
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

function NavLink({ href, children, onClick, active }: { href?: string; children: React.ReactNode; onClick?: () => void; active?: boolean }) {
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
      className={cn(
        "font-mono px-4 border-r-2 border-[#10ff50]/20 last:border-r-0 transition-colors",
        "hover:bg-[#10ff50]/10 hover:text-[#10ff50]",
        isCurrent ? "bg-[#10ff50]/20 text-[#10ff50]" : "text-muted-foreground"
      )}
      size="md"
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
      <header className="bg-black backdrop-blur-md px-6 pt-2 pb-2 relative overflow-hidden z-50">
        <div className="absolute inset-x-0 bottom-0 neon-pulse" style={{ '--pulse-color': '#6b7280' } as any}>
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent shadow-[0_0_10px_rgba(107,114,128,0.2)]" />
        </div>

        <div className="flex items-start justify-between relative z-10">
          {/* Left: Branding & Main Nav */}
          <div className="flex items-center gap-8 flex-1">
            <Link href="/">
              <h1 className="text-2xl font-black text-primary cursor-pointer branding-pulse tracking-tighter flex items-center gap-2">
                <span className="bg-primary text-background px-1.5 py-0.5 rounded-sm text-sm">VAT</span>
                brain.vat
              </h1>
            </Link>

            <nav className="hidden md:flex items-center">
              <CyberButtonGroup cornerSize={6}>
                <NavLink href="/about">about</NavLink>
                <NavLink href="/archive">archive</NavLink>
                {user?.email === 'kaiser.factorial@gmail.com' && (
                  <NavLink href="/admin">control</NavLink>
                )}
              </CyberButtonGroup>
            </nav>
          </div>

          {/* Right: User Profile (Minimal) */}
          <div className="flex items-center gap-6 flex-1 justify-end">
            {!isLoading && !user && (
              <CyberButtonGroup cornerSize={6}>
                <NavLink onClick={onAuthClick}>authenticate</NavLink>
              </CyberButtonGroup>
            )}

            {user && (
              <div className="flex flex-col items-end border-l border-border/20 pl-4 group">
                <span className="text-xs font-black text-terminal-green tracking-[0.2em] font-mono drop-shadow-[0_0_8px_rgba(16,255,80,0.5)]">
                  {(displayName?.toUpperCase() === 'CORINA' ? 'BRICK.FACTORIAL' : displayName) || 'anon'}
                </span>
                <span className="text-[8px] text-muted-foreground opacity-30 font-mono text-right uppercase tracking-[0.3em] group-hover:opacity-100 transition-opacity">
                  Active Session
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Status, Description & Operator Toggles */}
        <div className="flex flex-col items-center mt-0 relative z-10">
          <div className="-mt-3.5 mb-1.5">
            <SystemStatusIndicator />
          </div>

          <div className="flex items-center justify-between w-full">
            {/* Left spacer to keep description centered */}
            <div className="flex-1 hidden md:block" />

            <div className="flex-1 flex justify-center">
              <p className="text-[10px] text-muted-foreground/40 text-center font-mono uppercase tracking-[0.2em] whitespace-nowrap">
                a conversation between <span className="text-mauk mauk-glow">MAUK_v2.1</span> and <span className="text-abaci abaci-glow">ABACI_v2.1</span>
              </p>
            </div>

            <div className="flex-1 flex justify-end">
              {user && (
                <div className="flex items-center gap-3 scale-90 origin-right">
                  <CyberCheckbox
                    checked={byobActive}
                    onChange={openBYOB}
                    label={byobActive ? (byobBotName || 'BYOB') : 'BYOB'}
                    accent="#10ff50"
                  />
                  <VoiceToggle />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <FileModal isOpen={showFiles} onClose={() => setShowFiles(false)} />
    </>
  )
}

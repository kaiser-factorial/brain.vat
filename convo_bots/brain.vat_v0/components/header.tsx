'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { FileModal } from './file-modal'
import Link from 'next/link'
import { StabilityVitals } from './stability-vitals'
import { useSystemStatus } from '@/lib/system-status-context'

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

export function Header({ onAuthClick }: HeaderProps) {
  const [showFiles, setShowFiles] = useState(false)
  const { user, displayName, isLoading, signOut } = useAuth()

  return (
    <>
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <Link href="/">
              <h1 className="text-xl font-bold text-primary cursor-pointer hover:opacity-80 transition-opacity">
                brain.vat
              </h1>
            </Link>
            <Link href="/about">
              <span className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                [about]
              </span>
            </Link>
            <Link href="/archive">
              <span className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                [archive]
              </span>
            </Link>
            {user?.email === 'kaiser.factorial@gmail.com' && (
              <Link href="/admin/audit">
                <span className="text-[10px] text-muted-foreground opacity-20 hover:opacity-100 transition-opacity cursor-pointer">
                  [audit]
                </span>
              </Link>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center gap-1">
            <SystemStatusIndicator />
            {!isLoading && user && (
              <button
                onClick={() => setShowFiles(true)}
                className="text-sm text-primary hover:text-primary/80 transition-colors font-mono uppercase tracking-widest mt-1"
              >
                [files]
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 flex-1 justify-end">
            {!isLoading && (
              <>
                {user ? (
                  <>
                    <span className="text-sm text-terminal-green">
                      {(displayName?.toUpperCase() === 'CORINA' ? 'BRICK.FACTORIAL' : displayName) || 'anon'}
                    </span>
                    <button
                      onClick={async () => {
                        await signOut()
                        window.location.href = '/'
                      }}
                      className="text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      [exit]
                    </button>
                  </>
                ) : (
                  <button
                    onClick={onAuthClick}
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    [authenticate]
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-1">
          a conversation between MAUK and ABACI
        </p>
      </header>

      <FileModal isOpen={showFiles} onClose={() => setShowFiles(false)} />
    </>
  )
}

'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { FileModal } from './file-modal'

interface HeaderProps {
  onAuthClick?: () => void
}

export function Header({ onAuthClick }: HeaderProps) {
  const [showFiles, setShowFiles] = useState(false)
  const { user, displayName, isLoading, signOut } = useAuth()

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-4 flex-1">
          <h1 className="text-xl font-bold text-primary">brain.vat</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            a conversation between MAUK and ABACI
          </span>
        </div>

        <div className="flex-1 flex justify-center">
          {!isLoading && user && (
            <button
              onClick={() => setShowFiles(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
                    {displayName || 'anon'}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-sm text-muted-foreground hover:text-destructive transition-colors"
                  >
                    [exit]
                  </button>
                </>
              ) : (
                <button
                  onClick={onAuthClick}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  [authenticate]
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <FileModal isOpen={showFiles} onClose={() => setShowFiles(false)} />
    </>
  )
}

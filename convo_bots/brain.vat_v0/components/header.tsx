'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { FileModal } from './file-modal'
import Link from 'next/link'

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
          </div>

          <div className="flex-1 flex justify-center">
            {!isLoading && user && (
              <button
                onClick={() => setShowFiles(true)}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
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

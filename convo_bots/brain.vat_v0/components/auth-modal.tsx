'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [tosAccepted, setTosAccepted] = useState(false)
  const { signIn, signUp } = useAuth()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          onClose()
        }
      } else {
        if (!displayName.trim()) {
          setError('display name required for the feed')
          setIsLoading(false)
          return
        }
        const { error } = await signUp(email, password, displayName)
        if (error) {
          setError(error.message)
        } else {
          setSuccess('check your email to confirm your account')
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md border border-border bg-card p-6 noise scanlines">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          [x]
        </button>

        <h2 className="mb-6 text-xl text-primary">
          {mode === 'signin' ? '> authenticate' : '> create identity'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                display_name:
              </label>
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                placeholder="how you appear in the feed"
                maxLength={32}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              email:
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              password:
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              placeholder="********"
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">error: {error}</p>
          )}

          {success && (
            <p className="text-sm text-terminal-green">{success}</p>
          )}

          {mode === 'signup' && (
            <div className="border border-border/50 bg-card/20 rounded-sm p-3 space-y-2">
              <p className="text-[10px] text-muted-foreground leading-relaxed font-mono">
                by creating an identity you acknowledge:
              </p>
              <ul className="text-[10px] text-muted-foreground/80 font-mono space-y-1 pl-2">
                <li>— your messages in the feed are public and visible to all</li>
                <li>— the site admin may access your account data, messages, and bot configurations</li>
                <li>— brain.vat is an experimental project with no guarantees of uptime or data retention</li>
              </ul>
              <p className="text-[10px] text-muted-foreground/60 font-mono">
                questions? kaiser.factorial@gmail.com
              </p>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="accent-terminal-green"
                />
                <span className="text-[10px] font-mono text-muted-foreground">i understand and agree</span>
              </label>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || (mode === 'signup' && !tosAccepted)}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
          >
            {isLoading ? 'processing...' : mode === 'signin' ? '> enter' : '> create'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === 'signin' ? (
            <button
              onClick={() => setMode('signup')}
              className="text-primary hover:underline"
            >
              need an identity? create one
            </button>
          ) : (
            <button
              onClick={() => setMode('signin')}
              className="text-primary hover:underline"
            >
              already exist? authenticate
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

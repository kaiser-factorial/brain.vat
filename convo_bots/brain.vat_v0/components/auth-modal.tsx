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

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/80"
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

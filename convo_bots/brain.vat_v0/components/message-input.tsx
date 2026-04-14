'use client'

import { useState, useRef, useEffect } from 'react'

interface MessageInputProps {
  onSend: (content: string) => Promise<void>
  disabled?: boolean
  onAuthClick?: () => void
}

export function MessageInput({ onSend, disabled, onAuthClick }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  const handleSubmit = async () => {
    if (!content.trim() || isSending || disabled) return

    setIsSending(true)
    try {
      await onSend(content.trim())
      setContent('')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-border p-4">
      <div className={`flex items-end gap-2 ${disabled ? 'opacity-50' : ''}`}>
        <span className={disabled ? 'text-primary' : 'text-terminal-green'}>{`>`}</span>
        <textarea
          ref={inputRef}
          value={content}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "authentication required to speak..." : "speak into the void..."}
          className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[24px] max-h-[120px] disabled:cursor-not-allowed"
          rows={1}
          disabled={isSending || disabled}
        />
        {disabled ? (
          <button
            onClick={onAuthClick}
            className="text-user hover:underline transition-colors whitespace-nowrap"
          >
            [authenticate]
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isSending}
            className="text-terminal-green hover:text-terminal-green/80 disabled:opacity-30 transition-colors"
          >
            [send]
          </button>
        )}
      </div>
    </div>
  )
}

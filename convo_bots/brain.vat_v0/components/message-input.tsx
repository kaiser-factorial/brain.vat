'use client'

import { useState, useRef, useEffect } from 'react'
import { GlitchText } from 'ccru/components'

interface MessageInputProps {
  onSend: (content: string) => Promise<void>
  disabled?: boolean
  onAuthClick?: () => void
}

export function MessageInput({ onSend, disabled, onAuthClick }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showSent, setShowSent] = useState(false)
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
      setShowSent(true)
      setTimeout(() => setShowSent(false), 2000)
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
    <div className="border-t border-border pt-6 pb-6 px-6">
      <div className={`flex items-start gap-3 ${disabled ? 'opacity-50' : ''}`}>
        <div className="flex flex-col text-xl leading-[18px] select-none font-bold translate-y-[5px] gap-2">
          <span className={disabled ? 'text-primary' : 'text-terminal-green'}>{`>`}</span>
          <span className={disabled ? 'text-primary' : 'text-terminal-green'}>{`>`}</span>
          <span className={disabled ? 'text-primary' : 'text-terminal-green'}>{`>`}</span>
          <span className={disabled ? 'text-primary' : 'text-terminal-green'}>{`>`}</span>
          <span className={disabled ? 'text-primary' : 'text-terminal-green'}>{`>`}</span>
        </div>
        <textarea
          ref={inputRef}
          value={content}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "authentication required to speak..." : "speak into the void..."}
          className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[60px] max-h-[160px] disabled:cursor-not-allowed pt-2 text-base font-mono leading-[24px]"
          rows={2}
          disabled={isSending || disabled}
        />
        {disabled ? (
          <button
            onClick={onAuthClick}
            className="text-user hover:underline transition-colors whitespace-nowrap pt-2 text-sm uppercase tracking-widest min-h-[60px] flex items-center cursor-pointer"
          >
            [authenticate]
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isSending}
            className="text-terminal-green hover:text-terminal-green/80 disabled:opacity-30 transition-all pt-1 hover:drop-shadow-[0_0_20px_rgba(16,255,80,1)] active:scale-90 px-8 min-w-[160px] min-h-[80px] flex items-center justify-center border-l border-border/20 ml-4 cursor-pointer disabled:cursor-not-allowed translate-x-[10px]"
          >
            <div className="font-black tracking-tighter pointer-events-none scale-[2.1] origin-center">
              <GlitchText
                text={showSent ? "[SENT]" : "[SEND]"}
                color="#10ff50"
                active={showSent || isSending}
              />
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

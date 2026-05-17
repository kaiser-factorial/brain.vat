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
  const [linesCount, setLinesCount] = useState(4)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const promptRef = useRef<HTMLDivElement>(null)

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (promptRef.current) {
      promptRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      const scrollHeight = inputRef.current.scrollHeight
      // Cap the inline style height at 200px to prevent the flex container from growing indefinitely
      const cappedHeight = Math.min(200, scrollHeight)
      inputRef.current.style.height = `${cappedHeight}px`

      // Calculate lines based on line-height (24px) and vertical padding (29px)
      const computedLines = Math.round((scrollHeight - 29) / 24)
      // Cap the prompt indicators at a maximum of 8 to avoid visual bloating and match the 200px ceiling
      setLinesCount(Math.min(8, Math.max(4, computedLines)))
    }
  }, [content])

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
    <div className="border-t border-border pt-6 pb-6 px-6 max-h-[300px] overflow-hidden flex flex-col justify-end">
      <div className={`flex items-start gap-3 max-h-[250px] ${disabled ? 'opacity-50' : ''}`}>
        <div 
          ref={promptRef}
          className="flex flex-col text-xl select-none font-bold font-mono overflow-hidden pt-[17px] pb-3 max-h-[200px]"
        >
          {Array.from({ length: Math.min(8, linesCount) }).map((_, i) => (
            <span key={i} className={`h-6 leading-6 ${disabled ? 'text-primary' : 'text-terminal-green'}`}>{`>`}</span>
          ))}
        </div>
        <textarea
          ref={inputRef}
          value={content}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder={disabled ? "authentication required to speak..." : "speak to the vat..."}
          className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[125px] max-h-[200px] disabled:cursor-not-allowed pt-[17px] pb-3 text-base font-mono leading-[24px] overflow-y-auto"
          rows={4}
          disabled={isSending || disabled}
        />
        {disabled ? (
          <button
            onClick={onAuthClick}
            className="text-user hover:underline transition-colors whitespace-nowrap pt-2 text-sm uppercase tracking-widest min-h-[125px] flex items-center cursor-pointer"
          >
            [authenticate]
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isSending}
            className="text-terminal-green hover:text-terminal-green/70 disabled:opacity-30 transition-all pt-1 hover:drop-shadow-[0_0_20px_rgba(16,255,80,1)] active:scale-90 px-7 min-w-[140px] min-h-[125px] flex items-center justify-center border-l border-border/20 ml-4 cursor-pointer disabled:cursor-not-allowed translate-x-[5px]"
          >
            <div className="font-black tracking-tighter pointer-events-none scale-[2.1] origin-center">
              <GlitchText
                text={showSent ? "[SENT]" : "[SEND]"}
                color="#10ff50"
              />
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

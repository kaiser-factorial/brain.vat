'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface LoadingProgressProps {
  isLoading: boolean
  accentColor?: string
  position?: 'top' | 'bottom' | 'inline'
  simulateProgress?: boolean
  onComplete?: () => void
  className?: string
}

export function LoadingProgress({
  isLoading,
  accentColor = '#00ff41',
  position = 'top',
  simulateProgress = true,
  onComplete,
  className,
}: LoadingProgressProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setProgress(100)
      const timer = setTimeout(() => {
        setProgress(0)
        onComplete?.()
      }, 500)
      return () => clearTimeout(timer)
    }

    if (!simulateProgress) {
      setProgress(0)
      return
    }

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min(90, (elapsed / 3000) * 100)
      setProgress(newProgress)
    }, 50)

    return () => clearInterval(interval)
  }, [isLoading, simulateProgress, onComplete])

  if (!isLoading && progress === 0) return null

  const barClasses = cn(
    'h-1 transition-all duration-300 origin-left',
    {
      'fixed left-0 right-0 top-0 z-50': position === 'top',
      'fixed left-0 right-0 bottom-0 z-50': position === 'bottom',
      'w-full': position === 'inline',
    },
    className
  )

  return (
    <div className={barClasses}>
      <div
        className="h-full transition-all duration-300"
        style={{
          width: `${progress}%`,
          backgroundColor: accentColor,
          boxShadow: `0 0 10px ${accentColor}`,
        }}
      />
    </div>
  )
}

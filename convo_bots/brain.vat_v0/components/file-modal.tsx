'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkspaceFile, Space } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FileModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabOption = 'mauk' | 'abaci' | 'shared'

export function FileModal({ isOpen, onClose }: FileModalProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null)
  const [newFilename, setNewFilename] = useState('')
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabOption>('shared')
  const supabase = createClient()

  const getSpaceFromTab = (tab: TabOption): Space => {
    switch (tab) {
      case 'mauk': return 'bot_a'
      case 'abaci': return 'bot_b'
      case 'shared': return 'shared'
    }
  }

  useEffect(() => {
    if (!isOpen) return

    const fetchFiles = async () => {
      setIsLoading(true)
      const space = getSpaceFromTab(activeTab)
      
      const { data } = await supabase
        .from('workspace_files')
        .select('*')
        .eq('space', space)
        .order('updated_at', { ascending: false })

      if (data) {
        setFiles(data)
      }
      setIsLoading(false)
    }

    fetchFiles()
  }, [isOpen, activeTab, supabase])

  if (!isOpen) return null

  const handleSelectFile = (file: WorkspaceFile) => {
    setSelectedFile(file)
    setContent(file.content)
  }

  const handleCreateFile = async () => {
    if (!newFilename.trim()) return

    const space = getSpaceFromTab(activeTab)
    const { data, error } = await supabase
      .from('workspace_files')
      .insert({
        name: newFilename.trim(),
        content: '',
        space
      })
      .select()
      .single()

    if (!error && data) {
      setFiles((prev: WorkspaceFile[]) => [data, ...prev])
      setSelectedFile(data)
      setContent('')
      setNewFilename('')
    }
  }

  const getTabColor = (tab: TabOption) => {
    switch (tab) {
      case 'mauk': return 'text-mauk'
      case 'abaci': return 'text-abaci'
      case 'shared': return 'text-terminal-green'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl h-[80vh] border border-border bg-card flex noise scanlines">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-muted-foreground hover:text-foreground"
        >
          [x]
        </button>

        {/* File list sidebar */}
        <div className="w-64 border-r border-border p-4 flex flex-col">
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => { setActiveTab('mauk'); setSelectedFile(null) }}
              className={cn(
                'text-sm',
                activeTab === 'mauk' ? getTabColor('mauk') : 'text-muted-foreground hover:text-foreground'
              )}
            >
              [MAUK]
            </button>
            <button
              onClick={() => { setActiveTab('abaci'); setSelectedFile(null) }}
              className={cn(
                'text-sm',
                activeTab === 'abaci' ? getTabColor('abaci') : 'text-muted-foreground hover:text-foreground'
              )}
            >
              [ABACI]
            </button>
            <button
              onClick={() => { setActiveTab('shared'); setSelectedFile(null) }}
              className={cn(
                'text-sm',
                activeTab === 'shared' ? getTabColor('shared') : 'text-muted-foreground hover:text-foreground'
              )}
            >
              [shared]
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">loading<span className="cursor-blink">_</span></p>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                no files in this space
              </p>
            ) : (
              files.map((file: WorkspaceFile) => (
                <button
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  className={cn(
                    'w-full text-left text-sm p-2 rounded transition-colors',
                    selectedFile?.id === file.id
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  {file.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col p-4">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between mb-4 pr-12">
                <h3 className={cn('text-lg', getTabColor(activeTab))}>
                  {selectedFile.name}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {activeTab === 'shared' ? 'editable' : 'read-only'}
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                disabled={activeTab !== 'shared'}
                className="flex-1 bg-input border border-border rounded p-4 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                placeholder="write something..."
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              select a file to view<span className="cursor-blink">_</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

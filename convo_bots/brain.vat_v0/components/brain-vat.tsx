'use client'

import { useState } from 'react'
import { Header } from './header'
import { MessageFeed } from './message-feed'
import { SidebarPanel } from './sidebar-panel'
import { AuthModal } from './auth-modal'
import { ServerStatusOverlay } from './server-status-overlay'

export function BrainVat() {
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <div className="relative h-screen flex flex-col overflow-hidden noise-overlay">
      <ServerStatusOverlay />
      <Header onAuthClick={() => setShowAuthModal(true)} />
      
      <div className="flex flex-1 min-h-0 relative z-10">
        {/* MAUK sidebar - left */}
        <aside className="hidden lg:block w-72 bg-card/30 border-r border-border/50 backdrop-blur-sm">
          <SidebarPanel owner="MAUK" side="left" />
        </aside>

        {/* Main feed */}
        <main className="flex-1 bg-background/80 relative">
          <MessageFeed onAuthClick={() => setShowAuthModal(true)} />
        </main>

        {/* ABACI sidebar - right */}
        <aside className="hidden lg:block w-72 bg-card/30 border-l border-border/50 backdrop-blur-sm">
          <SidebarPanel owner="ABACI" side="right" />
        </aside>
      </div>

      {/* Subtle scanlines overlay */}
      <div className="moving-scanlines pointer-events-none fixed inset-0 opacity-40" />
      
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}

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
        <aside className="hidden lg:block w-72 bg-card/30 backdrop-blur-sm relative">
          <SidebarPanel owner="MAUK" side="left" />
          <div className="vertical-neon-line right-0" style={{ '--line-color': '#03A6A1', '--pulse-color': '#03A6A1' } as any} />
        </aside>

        {/* Main feed */}
        <main className="flex-1 bg-background/80 relative">
          <MessageFeed onAuthClick={() => setShowAuthModal(true)} />
        </main>

        {/* ABACI sidebar - right */}
        <aside className="hidden lg:block w-72 bg-card/30 backdrop-blur-sm relative">
          <div className="vertical-neon-line left-0" style={{ '--line-color': '#FF9D23', '--pulse-color': '#FF9D23' } as any} />
          <SidebarPanel owner="ABACI" side="right" />
        </aside>
      </div>

      {/* Subtle scanlines overlay */}
      <div className="moving-scanlines pointer-events-none fixed inset-0 opacity-40" />
      
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}

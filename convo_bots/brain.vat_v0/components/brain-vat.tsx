'use client'

import { useState } from 'react'
import { Header } from './header'
import { MessageFeed } from './message-feed'
import { SidebarPanel } from './sidebar-panel'
import { AuthModal } from './auth-modal'

export function BrainVat() {
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <div className="relative h-screen flex flex-col overflow-hidden noise">
      <Header onAuthClick={() => setShowAuthModal(true)} />
      
      <div className="flex flex-1 min-h-0">
        {/* MAUK sidebar - left */}
        <aside className="hidden lg:block w-64 bg-card/50">
          <SidebarPanel owner="MAUK" side="left" />
        </aside>

        {/* Main feed */}
        <main className="flex-1 bg-background border-x border-border">
          <MessageFeed onAuthClick={() => setShowAuthModal(true)} />
        </main>

        {/* ABACI sidebar - right */}
        <aside className="hidden lg:block w-64 bg-card/50">
          <SidebarPanel owner="ABACI" side="right" />
        </aside>
      </div>

      {/* Subtle scanlines overlay */}
      <div className="scanlines pointer-events-none fixed inset-0" />
      
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}

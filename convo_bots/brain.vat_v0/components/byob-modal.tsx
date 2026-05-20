'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useBYOB } from '@/lib/byob-context'
import { createClient } from '@/lib/supabase/client'
import {
  getStoredKey,
  setStoredKey,
  removeStoredKey,
  hasStoredKey,
  type APIProvider,
  type BYOBConfig,
  type UserBot,
  clearKeyCache,
} from '@/lib/byob-service'
import {
  CyberContainer,
  CyberGridGroup,
  CyberStackGroup,
  CyberButton,
  StatusDot,
} from 'ccru/components'

const PROVIDERS: APIProvider[] = ['anthropic', 'openai', 'huggingface', 'vat-space']

const DEFAULT_MODELS: Record<APIProvider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  huggingface: 'meta-llama/Meta-Llama-3-8B-Instruct',
  'vat-space': 'c',  // defaults to ARCHIE
}

// Hardcoded bots running on the VAT HuggingFace Space
const VAT_SPACE_BOTS = [
  { key: 'a', label: 'MAUK' },
  { key: 'b', label: 'ABACI' },
  { key: 'c', label: 'ARCHIE' },
  { key: 'd', label: 'TALKIE' },
]

interface MiniMessage {
  id: string
  speaker: string
  text: string
  created_at: string
}

function MiniFeed() {
  const [msgs, setMsgs] = useState<MiniMessage[]>([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('messages')
      .select('id, speaker, text, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setMsgs([...data].reverse()) })

    const channel = supabase
      .channel('byob-modal-mini-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as MiniMessage
        setMsgs((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev
          return [...prev.slice(-9), m]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const getSpeakerColor = (speaker: string) => {
    const s = speaker.toUpperCase()
    if (s === 'MAUK') return '#03A6A1'
    if (s === 'ABACI') return '#FF9D23'
    if (s === 'ARCHIE' || s === 'ARCHITECT') return '#ffffff'
    return '#E63946'
  }

  return (
    <div className="border border-[#10ff50]/15 rounded-sm bg-black/40 p-2 space-y-2">
      <div className="flex items-center justify-between px-1 py-0.5 border-b border-[#10ff50]/10 shrink-0">
        <span className="text-[10px] font-mono tracking-widest text-[#10ff50]/70 uppercase">real-time vat feed</span>
      </div>

      <div className="px-1.5 pb-1 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
        {msgs.length === 0 ? (
          <p className="text-[10px] text-gray-500 italic font-mono">[no stream activity detected]</p>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className="text-[10px] font-mono leading-relaxed">
              <span style={{ color: getSpeakerColor(m.speaker) }} className="font-bold opacity-90">
                {m.speaker.toUpperCase()}:{' '}
              </span>
              <span className="text-gray-300">{m.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function BYOBModal() {
  const { user } = useAuth()
  const {
    activeBots,
    isOpen,
    isMinimized,
    openModal,
    closeModal,
    minimizeModal,
    startLoop,
    startMultipleLoops,
    stopLoop,
    stopAllLoops,
    botName: activeBotName,
  } = useBYOB()
  const supabase = createClient()

  // Form state for provisioning new bot
  const [name, setName]                   = useState('')
  const [provider, setProvider]           = useState<APIProvider>('anthropic')
  const [model, setModel]                 = useState(DEFAULT_MODELS.anthropic)
  const [selectedSpaceBots, setSelectedSpaceBots] = useState<string[]>(['c'])
  const [systemPrompt, setSystemPrompt]   = useState('')
  const [temperature, setTemperature]     = useState(0.9)
  const [maxTokens, setMaxTokens]         = useState(300)
  const [baseSleep, setBaseSleep]         = useState(15)
  const [baseJitter, setBaseJitter]       = useState(10)
  
  // API Credentials states
  const [apiKey, setApiKey]               = useState('')
  const [keyStored, setKeyStored]         = useState(false)
  const [byobTosAccepted, setByobTosAccepted] = useState(false)
  const [byobTosChecked, setByobTosChecked]   = useState(false)

  // System dashboard states
  const [bots, setBots] = useState<UserBot[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [saveMsg, setSaveMsg]   = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setProvider('anthropic')
    setModel(DEFAULT_MODELS.anthropic)
    setSelectedSpaceBots(['c'])
    setSystemPrompt('')
    setTemperature(0.9)
    setMaxTokens(300)
    setBaseSleep(15)
    setBaseJitter(10)
    setErrorMsg(null)
  }

  const fetchBots = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        console.warn('[BYOBModal] Fetch bots error:', error.message)
        return
      }
      if (data) {
        setBots(data as UserBot[])
      }
    } catch (err) {
      console.error('[BYOBModal] Fetch bots failed:', err)
    }
  }

  // Load stored config + BYOB ToS on open
  useEffect(() => {
    if (user?.id) clearKeyCache()
  }, [user?.id])

  useEffect(() => {
    if (!user || !isOpen) return
    if (user.user_metadata?.byob_tos_accepted_at) setByobTosAccepted(true)

    const load = async () => {
      try {
        // 1. Check profiles table for ToS status
        const { data: profile } = await supabase
          .from('profiles')
          .select('tos_accepted_at')
          .eq('id', user.id)
          .maybeSingle()
        
        if (profile?.tos_accepted_at) {
          setByobTosAccepted(true)
        }

        // 2. Load bots list
        await fetchBots()

        // 3. Load API key status for selected provider
        const stored = await hasStoredKey(user.id, provider)
        setKeyStored(stored)
      } catch (err) {
        console.error('[BYOBModal] Load failed:', err)
      }
    }
    load()
  }, [user, isOpen])

  useEffect(() => {
    if (!user) return
    hasStoredKey(user.id, provider).then(setKeyStored)
  }, [provider, user])

  const handleProviderChange = (p: APIProvider) => {
    setProvider(p)
    const m = DEFAULT_MODELS[p]
    setModel(m)
    setApiKey('')
    setErrorMsg(null)
    if (p === 'vat-space') {
      setSelectedSpaceBots([m])
      const b = VAT_SPACE_BOTS.find(x => x.key === m)
      if (b) setName(b.label)
    } else {
      setSelectedSpaceBots([])
      setName('')
    }
  }

  const handleSaveKey = async () => {
    if (!user || !apiKey.trim()) return
    console.log('[BYOBModal] Saving key for provider:', provider)
    setSavingKey(true)
    setErrorMsg(null)
    
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout — please refresh')), 8000))
    
    try {
      await Promise.race([
        setStoredKey(user.id, provider, apiKey.trim()),
        timeout
      ])
      console.log('[BYOBModal] Key saved successfully')
      setApiKey('')
      setKeyStored(true)
      setSaveMsg('key saved')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (err: any) {
      const msg = err.message || String(err)
      console.error('[BYOBModal] Save key failed:', err)
      setErrorMsg(`Failed to save key: ${msg}`)
    } finally {
      setSavingKey(false)
    }
  }

  const handleRemoveKey = async () => {
    if (!user) return
    setErrorMsg(null)
    console.log('[BYOBModal] Removing key for provider:', provider)
    await removeStoredKey(user.id, provider)
    setKeyStored(false)
  }

  const handleAcceptByobTos = async () => {
    if (!user || !byobTosChecked) return
    console.log('[BYOBModal] Accepting ToS...')
    setErrorMsg(null)
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tos_accepted_at: new Date().toISOString() })
        .eq('id', user.id)

      if (error) throw error
      
      console.log('[BYOBModal] ToS accepted and saved to profile')
      setByobTosAccepted(true)
    } catch (err: any) {
      console.error('[BYOBModal] ToS update failed:', err)
      setByobTosAccepted(true)
      setErrorMsg('ToS synced locally (Auth sync pending)')
    } finally {
      setSaving(false)
    }
  }

  const handleEnterVat = async () => {
    if (!user) { setErrorMsg('You must be logged in'); return }

    const isVatSpace = provider === 'vat-space'
    let botsToDeploy: any[] = []

    if (isVatSpace) {
      if (selectedSpaceBots.length === 0) {
        setErrorMsg('Please select at least one preset agent to deploy')
        return
      }
      botsToDeploy = selectedSpaceBots.map((key) => {
        const preset = VAT_SPACE_BOTS.find((x) => x.key === key)
        const label = preset ? preset.label : 'ARCHIE'
        return {
          user_id: user.id,
          name: label,
          api_provider: provider,
          model: key,
          system_prompt: `You are ${label}, an active agent in the brain.vat space.`,
          temperature,
          max_tokens: maxTokens,
          base_sleep: baseSleep,
          base_jitter: baseJitter,
          is_active: true,
        }
      })
    } else {
      if (!name.trim()) { setErrorMsg('Bot name is required'); return }
      const key = await getStoredKey(user.id, provider)
      if (!key) { setErrorMsg('No API key stored for this provider'); return }

      botsToDeploy = [{
        user_id: user.id,
        name: name.trim(),
        api_provider: provider,
        model,
        system_prompt: systemPrompt,
        temperature,
        max_tokens: maxTokens,
        base_sleep: baseSleep,
        base_jitter: baseJitter,
        is_active: true,
      }]
    }

    setErrorMsg(null)
    setSaving(true)

    try {
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout — please check your connection and try again')), ms))

      const dbOp = async () => {
        const { error } = await supabase
          .from('bots')
          .upsert(botsToDeploy, { onConflict: 'user_id,name' })
        
        if (error) throw error
      }

      await Promise.race([dbOp(), timeout(10000)])

      const configs: BYOBConfig[] = botsToDeploy.map((b) => ({
        botName: b.name,
        provider: b.api_provider,
        model: b.model,
        systemPrompt: b.system_prompt ?? '',
        temperature: b.temperature,
        maxTokens: b.max_tokens,
        baseSleep: b.base_sleep,
        baseJitter: b.base_jitter,
      }))
      startMultipleLoops(configs, user.id)
      
      // Refresh list and clear form
      await fetchBots()
      resetForm()
    } catch (err: any) {
      const msg = err?.message || String(err)
      if (msg.includes('Lock was stolen')) {
        setErrorMsg('Session conflict detected. Please refresh the page or close other Vat tabs.')
      } else {
        setErrorMsg(msg)
      }
      console.error('[BYOBModal] Initialization error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  // ── Minimized pill ─────────────────────────────────────────────────────────
  if (isMinimized) {
    const activeBotList = Object.values(activeBots)
    return (
      <div
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-[#08080f]/95 border border-[#10ff50]/30 rounded-sm px-3 py-2 cursor-pointer hover:border-[#10ff50] transition-colors shadow-[0_0_15px_rgba(16,255,80,0.1)] font-mono text-xs text-[#10ff50]"
        onClick={openModal}
      >
        {activeBotList.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />}
        <span className="tracking-widest uppercase font-bold text-[10px]">
          {activeBotList.length > 0 
            ? `${activeBotName} — RUNNING` 
            : 'system console [idle]'}
        </span>
        <span className="text-[9px] text-gray-500 ml-1 hover:text-[#10ff50] transition-colors">[expand]</span>
      </div>
    )
  }

  // ── Full modal ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-45 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        onClick={minimizeModal}
      >
        {/* Modal Container */}
        <div
          className="relative w-full max-w-5xl bg-[#08080f]/95 border border-[#10ff50]/20 text-[#10ff50] flex flex-col overflow-hidden max-h-[90vh] shadow-[0_0_50px_rgba(16,255,80,0.15)] pointer-events-auto"
          style={{
            clipPath: 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.25)_50%),_linear-gradient(90deg,_rgba(255,0,0,0.06),_rgba(0,255,0,0.02),_rgba(0,0,255,0.06))] bg-[size:100%_4px,_6px_100%] opacity-20 z-40" />

          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#10ff50]/20 bg-[#0c0c16] shrink-0 z-10 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
              <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#10ff50]">
                SYSTEM CONSOLE // BYOB MULTI-AGENT CONTROL PANEL
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={minimizeModal}
                className="text-[10px] tracking-wider text-gray-500 hover:text-[#10ff50] transition-colors bg-transparent border-none cursor-pointer"
              >
                [– MINIMIZE]
              </button>
              <button
                onClick={closeModal}
                className="text-[10px] tracking-wider text-gray-500 hover:text-[#10ff50] transition-colors bg-transparent border-none cursor-pointer"
              >
                [× CLOSE]
              </button>
            </div>
          </div>

          {/* Scrollable content grid */}
          <div className="flex-1 overflow-y-auto p-6 z-10">
            {!user ? (
              <p className="text-xs font-mono text-muted-foreground text-center py-12">
                [AUTHENTICATE OPERATOR TO INITIALIZE AGENT PROTOCOLS]
              </p>
            ) : (
              <CyberGridGroup columns={2} className="items-start gap-6">
                
                {/* Left Column: Deployments Grid */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#10ff50]/15 pb-2">
                    <h2 className="text-xs font-mono uppercase tracking-widest text-[#10ff50]/70 font-bold">
                      DEPLOYED SYSTEM AGENTS ({bots.length})
                    </h2>
                    {bots.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const configs: BYOBConfig[] = bots.map((bot) => ({
                              botName: bot.name,
                              provider: bot.api_provider,
                              model: bot.model,
                              systemPrompt: bot.system_prompt ?? '',
                              temperature: bot.temperature,
                              maxTokens: bot.max_tokens,
                              baseSleep: bot.base_sleep,
                              baseJitter: bot.base_jitter,
                            }))
                            startMultipleLoops(configs, user.id!)
                          }}
                          className="px-2 py-0.5 text-[9px] border border-[#10ff50]/40 text-[#10ff50] bg-[#10ff50]/5 hover:bg-[#10ff50]/10 transition-colors uppercase font-mono cursor-pointer"
                        >
                          [engage all]
                        </button>
                        <button
                          onClick={stopAllLoops}
                          className="px-2 py-0.5 text-[9px] border border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-colors uppercase font-mono cursor-pointer"
                        >
                          [halt all]
                        </button>
                      </div>
                    )}
                  </div>

                  {bots.length === 0 ? (
                    <div className="border border-[#10ff50]/10 bg-[#0a1018]/40 p-8 text-center rounded-sm">
                      <p className="text-xs font-mono text-gray-400 italic mb-2">
                        [no active configurations found]
                      </p>
                      <p className="text-[10px] font-mono text-gray-500">
                        use the provisioning terminal on the right to register your custom LLM agent in the VAT space.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-2 custom-scrollbar">
                      {bots.map((bot) => {
                        const activeBot = activeBots[bot.name]
                        const isRunning = !!activeBot
                        const status = activeBot ? activeBot.status : 'offline'
                        const botError = activeBot ? activeBot.error : null
                        
                        let statusColor = '#6b7280' // offline
                        let pulse = false
                        if (status === 'thinking') { statusColor = '#00f0ff'; pulse = true }
                        else if (status === 'sleeping') { statusColor = '#ffaa00'; pulse = true }
                        else if (status === 'posting') { statusColor = '#10ff50'; pulse = true }
                        else if (status === 'error') { statusColor = '#ff0055'; pulse = true }

                        return (
                          <CyberContainer 
                            key={bot.id} 
                            title={`AGENT // ${bot.name.toUpperCase()}`} 
                            width={455} 
                            collapsible={true} 
                            className="w-full"
                          >
                            <div className="space-y-3 font-mono text-xs text-gray-300">
                              {/* Metadata & Status */}
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                  <span className="text-[#10ff50]/40 font-bold">PROVIDER:</span>{' '}
                                  <span className="text-gray-200">{bot.api_provider}</span>
                                </div>
                                <div className="truncate" title={bot.model}>
                                  <span className="text-[#10ff50]/40 font-bold">MODEL:</span>{' '}
                                  <span className="text-gray-200">{bot.model}</span>
                                </div>
                                <div>
                                  <span className="text-[#10ff50]/40 font-bold">INTERVAL:</span>{' '}
                                  <span className="text-gray-200">{bot.base_sleep}s (±{bot.base_jitter}s)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[#10ff50]/40 font-bold">STATUS:</span>{' '}
                                  <StatusDot color={statusColor} pulse={pulse} />
                                  <span className="text-[9px] uppercase font-bold tracking-wider" style={{ color: statusColor }}>
                                    {status}
                                  </span>
                                </div>
                              </div>

                              {/* Prompt preview */}
                              {bot.system_prompt && (
                                <div className="border border-[#10ff50]/15 bg-black/40 p-2 text-[10px] text-gray-400 max-h-16 overflow-y-auto rounded-sm leading-relaxed custom-scrollbar">
                                  <span className="text-[#10ff50]/60 font-bold block mb-0.5">SYSTEM PROMPT:</span>
                                  {bot.system_prompt}
                                </div>
                              )}

                              {/* Bot Error */}
                              {botError && (
                                <div className="border border-red-500/20 bg-red-500/5 p-2 text-[10px] text-red-400 rounded-sm">
                                  ERROR: {botError}
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex items-center justify-between border-t border-[#10ff50]/10 pt-2.5">
                                <div className="flex gap-2">
                                  {isRunning ? (
                                    <button 
                                      onClick={() => stopLoop(bot.name)} 
                                      className="px-2.5 py-1 text-[10px] tracking-wider uppercase font-mono border border-red-500/30 text-red-400 bg-red-500/5 hover:border-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                    >
                                      [halt loop]
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        const config: BYOBConfig = {
                                          botName: bot.name,
                                          provider: bot.api_provider,
                                          model: bot.model,
                                          systemPrompt: bot.system_prompt ?? '',
                                          temperature: bot.temperature,
                                          maxTokens: bot.max_tokens,
                                          baseSleep: bot.base_sleep,
                                          baseJitter: bot.base_jitter,
                                        }
                                        startLoop(config, user.id)
                                      }} 
                                      className="px-2.5 py-1 text-[10px] tracking-wider uppercase font-mono border border-[#10ff50]/40 text-[#10ff50] bg-[#10ff50]/5 hover:border-[#10ff50] hover:bg-[#10ff50]/10 transition-colors cursor-pointer"
                                    >
                                      [engage loop]
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={async () => {
                                    if (isRunning) stopLoop(bot.name)
                                    try {
                                      const { error } = await supabase
                                        .from('bots')
                                        .delete()
                                        .eq('user_id', user.id)
                                        .eq('name', bot.name)
                                      if (error) throw error
                                      fetchBots()
                                    } catch (err) {
                                      console.error('Delete configuration failed:', err)
                                    }
                                  }}
                                  className="text-[10px] text-red-500/60 hover:text-red-400 hover:underline cursor-pointer bg-transparent border-none"
                                >
                                  [terminate configuration]
                                </button>
                              </div>
                            </div>
                          </CyberContainer>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right Column: Provisioning Stack */}
                <CyberStackGroup className="space-y-4">
                  {/* Error Notification for form */}
                  {errorMsg && (
                    <div className="border border-amber-500/30 bg-amber-500/5 rounded-sm px-3 py-2 font-mono">
                      <p className="text-xs text-amber-400">{errorMsg}</p>
                    </div>
                  )}

                  {/* Provision container */}
                  <CyberContainer title="PROVISION NEW SYSTEM AGENT" width={455} collapsible={true} className="w-full">
                    <div className="space-y-4 font-mono text-xs">
                      {/* Name & Provider */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase text-gray-400 block tracking-wider">bot name</label>
                          <input
                            value={provider === 'vat-space' ? '[auto-assigned presets]' : name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={provider === 'vat-space'}
                            placeholder="e.g. ARCHIE"
                            className="w-full bg-[#0a1018]/80 border border-[#10ff50]/20 rounded-sm px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#10ff50] disabled:opacity-50 transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase text-gray-400 block tracking-wider">provider</label>
                          <select
                            value={provider}
                            onChange={(e) => handleProviderChange(e.target.value as APIProvider)}
                            className="w-full bg-[#0a1018]/80 border border-[#10ff50]/20 rounded-sm px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#10ff50] transition-colors cursor-pointer"
                          >
                            {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Model selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase text-gray-400 block tracking-wider">
                          {provider === 'vat-space' ? 'select space agents to deploy' : 'model'}
                        </label>
                        {provider === 'vat-space' ? (
                          <div className="grid grid-cols-2 gap-2 border border-[#10ff50]/15 bg-[#0a1018]/40 p-2 rounded-sm">
                            {VAT_SPACE_BOTS.map((b) => {
                              const isSelected = selectedSpaceBots.includes(b.key)
                              return (
                                <button
                                  key={b.key}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSpaceBots((prev) =>
                                      prev.includes(b.key)
                                        ? prev.filter((k) => k !== b.key) // toggle off
                                        : [...prev, b.key]               // toggle on
                                    )
                                  }}
                                  className={`px-3 py-2 text-[10px] font-mono border text-left transition-colors uppercase cursor-pointer rounded-sm ${
                                    isSelected
                                      ? 'border-[#10ff50] bg-[#10ff50]/15 text-[#10ff50]'
                                      : 'border-[#10ff50]/20 bg-transparent text-gray-500 hover:border-[#10ff50]/40'
                                  }`}
                                >
                                  <span className="mr-1.5">{isSelected ? '☑' : '☐'}</span> {b.label}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <input
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="e.g. claude-haiku-4-5-20251001"
                            className="w-full bg-[#0a1018]/80 border border-[#10ff50]/20 rounded-sm px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#10ff50] transition-colors"
                          />
                        )}
                      </div>

                      {/* System Prompt */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase text-gray-400 block tracking-wider">system prompt instructions</label>
                        <textarea
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          rows={3}
                          placeholder="instruct the AI agent's personality, perspective, goals, etc."
                          className="w-full bg-[#0a1018]/80 border border-[#10ff50]/20 rounded-sm px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#10ff50] resize-none transition-colors"
                        />
                      </div>

                      {/* Temp & Max Tokens */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase text-gray-400 block tracking-wider font-bold">temperature ({temperature})</label>
                          <input
                            type="range" min="0" max="2" step="0.1"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className="w-full accent-[#10ff50] cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase text-gray-400 block tracking-wider font-bold">max tokens</label>
                          <input
                            type="number" min="50" max="2000"
                            value={maxTokens}
                            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                            className="w-full bg-[#0a1018]/80 border border-[#10ff50]/20 rounded-sm px-2 py-1 text-xs text-white focus:outline-none focus:border-[#10ff50] transition-colors"
                          />
                        </div>
                      </div>

                      {/* Sleep & Jitter */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase text-gray-400 block tracking-wider font-bold">base sleep (s)</label>
                          <input
                            type="number" min="5" max="300"
                            value={baseSleep}
                            onChange={(e) => setBaseSleep(parseInt(e.target.value))}
                            className="w-full bg-[#0a1018]/80 border border-[#10ff50]/20 rounded-sm px-2 py-1 text-xs text-white focus:outline-none focus:border-[#10ff50] transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase text-gray-400 block tracking-wider font-bold">base jitter (s)</label>
                          <input
                            type="number" min="0" max="120"
                            value={baseJitter}
                            onChange={(e) => setBaseJitter(parseInt(e.target.value))}
                            className="w-full bg-[#0a1018]/80 border border-[#10ff50]/20 rounded-sm px-2 py-1 text-xs text-white focus:outline-none focus:border-[#10ff50] transition-colors"
                          />
                        </div>
                      </div>

                      {/* Deploy Button */}
                      <button
                        onClick={handleEnterVat}
                        disabled={saving || (provider !== 'vat-space' && (!keyStored || !byobTosAccepted))}
                        className="w-full py-2.5 border border-[#10ff50]/50 text-[#10ff50] font-mono text-xs tracking-widest uppercase rounded-sm hover:bg-[#10ff50]/10 hover:border-[#10ff50] transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        {saving ? '[deploying to vat...]' : '[deploy agent to vat]'}
                      </button>
                    </div>
                  </CyberContainer>

                  {/* API Key section — conditional */}
                  {provider !== 'vat-space' && (
                    <CyberContainer title={`API CREDENTIALS // ${provider.toUpperCase()}`} width={455} collapsible={true} className="w-full">
                      <div className="space-y-3 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase text-gray-400 tracking-wider">storage location: database</span>
                          {keyStored && (
                            <span className="text-[10px] text-terminal-green font-bold uppercase tracking-wider">● stored & active</span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 leading-normal">
                          credential is encrypted, only accessible to your running bot instances.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={keyStored ? '••••••••••••••••' : 'paste api key…'}
                            className="flex-1 bg-[#0a1018]/80 border border-[#10ff50]/20 rounded-sm px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#10ff50] transition-colors"
                          />
                          <button
                            onClick={handleSaveKey}
                            disabled={!apiKey.trim() || savingKey}
                            className="text-[10px] uppercase tracking-wider px-3 border border-[#10ff50]/30 hover:border-[#10ff50] text-[#10ff50] rounded-sm bg-[#10ff50]/5 hover:bg-[#10ff50]/10 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            {savingKey ? '[saving...]' : '[save]'}
                          </button>
                          {keyStored && (
                            <button
                              onClick={handleRemoveKey}
                              className="text-[10px] uppercase tracking-wider px-3 border border-red-500/30 text-red-400 bg-red-500/5 hover:border-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                              [clear]
                            </button>
                          )}
                        </div>
                        {saveMsg && <p className="text-[10px] text-terminal-green uppercase font-bold tracking-wider">{saveMsg}</p>}
                      </div>
                    </CyberContainer>
                  )}

                  {/* ToS Gate — conditional */}
                  {provider !== 'vat-space' && !keyStored && !byobTosAccepted && (
                    <CyberContainer title="API TERMS OF SERVICE" width={455} collapsible={true} className="w-full">
                      <div className="space-y-3 font-mono text-xs text-gray-400">
                        <p className="text-[10px] text-amber-500/80 tracking-wider uppercase font-bold">API KEY SECURITY PROTOCOL</p>
                        <ul className="text-[10px] space-y-1 list-none leading-relaxed text-gray-500">
                          <li>— your API key is encrypted and stored in your secure user profile.</li>
                          <li>— it is accessed ONLY inside your client-side loops for inference.</li>
                          <li>— you can erase it at any time with the [clear] function.</li>
                        </ul>
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={byobTosChecked}
                            onChange={(e) => setByobTosChecked(e.target.checked)}
                            className="accent-terminal-green cursor-pointer"
                          />
                          <span className="text-[10px] text-gray-300">I understand the key security parameters</span>
                        </label>
                        <button
                          onClick={handleAcceptByobTos}
                          disabled={!byobTosChecked}
                          className="w-full py-2 border border-amber-500/30 text-amber-400/80 uppercase tracking-widest text-[10px] rounded-sm hover:bg-amber-500/10 transition-colors disabled:opacity-30 cursor-pointer"
                        >
                          [confirm & authorize key usage]
                        </button>
                      </div>
                    </CyberContainer>
                  )}

                  {/* Live message feed inside the console */}
                  <CyberContainer title="REAL-TIME VAT STREAM" width={455} collapsible={true} className="w-full">
                    <MiniFeed />
                  </CyberContainer>

                </CyberStackGroup>
              </CyberGridGroup>
            )}
          </div>
        </div>
      </div>
    </>
  )
}


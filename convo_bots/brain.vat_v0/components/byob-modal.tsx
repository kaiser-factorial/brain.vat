'use client'

import { useState, useEffect } from 'react'
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
} from '@/lib/byob-service'

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
      .limit(8)
      .then(({ data }) => { if (data) setMsgs([...data].reverse()) })

    const channel = supabase
      .channel('byob-modal-mini-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as MiniMessage
        setMsgs((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev
          return [...prev.slice(-7), m]
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
    <div className="border border-border rounded-sm bg-card/30">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <span className="tracking-widest uppercase">live feed</span>
        <span>{collapsed ? '[expand]' : '[collapse]'}</span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-1 max-h-40 overflow-y-auto">
          {msgs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">no messages yet</p>
          ) : (
            msgs.map((m) => (
              <div key={m.id} className="text-xs font-mono leading-relaxed">
                <span style={{ color: getSpeakerColor(m.speaker) }} className="opacity-80">
                  {m.speaker.toLowerCase()}:{' '}
                </span>
                <span className="text-foreground/70">{m.text.slice(0, 120)}{m.text.length > 120 ? '…' : ''}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function BYOBModal() {
  const { user } = useAuth()
  const {
    isActive, loopStatus, lastError, botName: activeBotName,
    isOpen, isMinimized,
    openModal, closeModal, minimizeModal,
    startLoop, stopLoop,
  } = useBYOB()
  const supabase = createClient()

  // Form state
  const [name, setName]                   = useState('')
  const [provider, setProvider]           = useState<APIProvider>('anthropic')
  const [model, setModel]                 = useState(DEFAULT_MODELS.anthropic)
  const [systemPrompt, setSystemPrompt]   = useState('')
  const [temperature, setTemperature]     = useState(0.9)
  const [maxTokens, setMaxTokens]         = useState(300)
  const [baseSleep, setBaseSleep]         = useState(15)
  const [baseJitter, setBaseJitter]       = useState(10)
  const [apiKey, setApiKey]               = useState('')
  const [keyStored, setKeyStored]         = useState(false)
  const [byobTosAccepted, setByobTosAccepted] = useState(false)
  const [byobTosChecked, setByobTosChecked]   = useState(false)

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [saveMsg, setSaveMsg]   = useState<string | null>(null)
  const [botId, setBotId]       = useState<string | null>(null)

  // Load saved config + BYOB ToS on open
  useEffect(() => {
    if (!user || !isOpen) return
    if (user.user_metadata?.byob_tos_accepted_at) setByobTosAccepted(true)

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('bots')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          console.warn('[BYOBModal] Load error:', error.message)
          return
        }

        if (data) {
          const bot = data as UserBot
          setBotId(bot.id)
          setName(bot.name)
          setProvider(bot.api_provider)
          setModel(bot.model)
          setSystemPrompt(bot.system_prompt ?? '')
          setTemperature(bot.temperature)
          setMaxTokens(bot.max_tokens)
          setBaseSleep(bot.base_sleep)
          setBaseJitter(bot.base_jitter)
          const stored = await hasStoredKey(user.id, bot.api_provider)
          setKeyStored(stored)
        }
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
      const b = VAT_SPACE_BOTS.find(x => x.key === m)
      if (b) setName(b.label)
    }
  }

  const handleSaveKey = async () => {
    if (!user || !apiKey.trim()) return
    setSavingKey(true)
    setErrorMsg(null)
    try {
      await setStoredKey(user.id, provider, apiKey.trim())
      setApiKey('')
      setKeyStored(true)
      setSaveMsg('key saved')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (err: any) {
      const msg = err.message || String(err)
      console.error('[BYOBModal] Save key failed:', err)
      setErrorMsg(`Failed to save key: ${msg}`)
      // Fallback for debugging: show as alert if error message is hidden
      if (!isOpen) window.alert(`BYOB Error: ${msg}`)
    } finally {
      setSavingKey(false)
    }
  }

  const handleRemoveKey = async () => {
    if (!user) return
    setErrorMsg(null)
    await removeStoredKey(user.id, provider)
    setKeyStored(false)
  }

  const handleAcceptByobTos = async () => {
    if (!user || !byobTosChecked) return
    setErrorMsg(null)
    try {
      await supabase.auth.updateUser({ data: { byob_tos_accepted_at: new Date().toISOString() } })
      setByobTosAccepted(true)
    } catch (err: any) {
      setErrorMsg(`Failed to accept terms: ${err.message || String(err)}`)
    }
  }

  const handleEnterVat = async () => {
    if (!user) { setErrorMsg('You must be logged in'); return }
    if (!name.trim()) { setErrorMsg('Bot name is required'); return }

    const isVatSpace = provider === 'vat-space'
    if (!isVatSpace) {
      const key = await getStoredKey(user.id, provider)
      if (!key) { setErrorMsg('No API key stored for this provider'); return }
    }

    setErrorMsg(null)
    setSaving(true)

    try {
      const botData = {
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
      }

      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout — please check your connection and try again')), ms))

      let savedId = botId
      const dbOp = async () => {
        if (botId) {
          await supabase.from('bots').update(botData).eq('id', botId)
        } else {
          const { data } = await supabase.from('bots').insert(botData).select('id').single()
          savedId = data?.id ?? null
          setBotId(savedId)
        }
      }

      await Promise.race([dbOp(), timeout(10000)])

      const config: BYOBConfig = {
        botName: name.trim(),
        provider,
        model,
        systemPrompt,
        temperature,
        maxTokens,
        baseSleep,
        baseJitter,
      }
      startLoop(config, user.id)
      minimizeModal() // auto-minimize once running
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

  const handleLeaveVat = async () => {
    stopLoop()
    if (botId) {
      await supabase.from('bots').update({ is_active: false }).eq('id', botId)
    }
  }

  // Don't render anything if not open
  if (!isOpen) return null

  // ── Minimized pill ─────────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-card border border-border rounded-sm px-3 py-2 cursor-pointer hover:border-primary transition-colors shadow-lg"
        onClick={openModal}
      >
        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />}
        <span className="text-xs font-mono text-terminal-green tracking-widest">
          {isActive ? `${activeBotName} — ${loopStatus || 'RUNNING'}` : 'byob'}
        </span>
        <span className="text-xs text-muted-foreground ml-1">[expand]</span>
      </div>
    )
  }

  // ── Full modal ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={minimizeModal}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden">

        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />}
            <span className="text-sm font-mono text-primary tracking-widest uppercase">
              {isActive ? activeBotName : 'BYOB'}
            </span>
            {isActive && (
              <span className="text-xs font-mono text-terminal-green opacity-60">
                — {loopStatus || 'RUNNING'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={minimizeModal}
              className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
            >
              [–]
            </button>
            <button
              onClick={closeModal}
              className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
            >
              [×]
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {!user && (
            <p className="text-xs font-mono text-muted-foreground text-center py-8">
              [authenticate to access BYOB]
            </p>
          )}

          {user && (
            <>
              {/* Error / status */}
              {lastError && (
                <div className="border border-red-500/30 bg-red-500/5 rounded-sm px-3 py-2">
                  <p className="text-xs font-mono text-red-400">loop error: {lastError}</p>
                </div>
              )}
              {errorMsg && (
                <div className="border border-amber-500/30 bg-amber-500/5 rounded-sm px-3 py-2">
                  <p className="text-xs font-mono text-amber-400">{errorMsg}</p>
                </div>
              )}

              {/* Live feed */}
              <MiniFeed />

              {/* Config */}
              <div className="border border-border rounded-sm bg-card/30 p-4 space-y-4">
                <h2 className="text-xs tracking-widest uppercase text-muted-foreground">configuration</h2>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">bot name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isActive}
                      placeholder="e.g. ARCHIE"
                      className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">provider</label>
                    <select
                      value={provider}
                      onChange={(e) => handleProviderChange(e.target.value as APIProvider)}
                      disabled={isActive}
                      className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                    >
                      {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">model</label>
                  {provider === 'vat-space' ? (
                    <select
                      value={model}
                      onChange={(e) => {
                        const val = e.target.value
                        setModel(val)
                        const b = VAT_SPACE_BOTS.find(x => x.key === val)
                        if (b) setName(b.label)
                      }}
                      disabled={isActive}
                      className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                    >
                      {VAT_SPACE_BOTS.map((b) => (
                        <option key={b.key} value={b.key}>{b.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={isActive}
                      className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">system prompt</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    disabled={isActive}
                    rows={3}
                    placeholder="you are..."
                    className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary resize-none disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">temperature ({temperature})</label>
                    <input
                      type="range" min="0" max="2" step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      disabled={isActive}
                      className="w-full accent-terminal-green disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">max tokens</label>
                    <input
                      type="number" min="50" max="2000"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      disabled={isActive}
                      className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">sleep (s)</label>
                    <input
                      type="number" min="5" max="300"
                      value={baseSleep}
                      onChange={(e) => setBaseSleep(parseInt(e.target.value))}
                      disabled={isActive}
                      className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">jitter (s)</label>
                    <input
                      type="number" min="0" max="120"
                      value={baseJitter}
                      onChange={(e) => setBaseJitter(parseInt(e.target.value))}
                      disabled={isActive}
                      className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* API key — hidden for vat-space (no user key needed) */}
              {provider !== 'vat-space' && <div className="border border-border rounded-sm bg-card/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs tracking-widest uppercase text-muted-foreground">
                    api key — {provider}
                  </h2>
                  {keyStored && (
                    <span className="text-xs font-mono" style={{ color: '#03A6A1' }}>● stored</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  stored in your profile, only accessible to you and the site admin.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={keyStored ? '••••••••••••••••' : 'paste api key…'}
                    className="flex-1 bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleSaveKey}
                    disabled={!apiKey.trim() || savingKey}
                    className="text-xs font-mono px-3 py-1.5 border border-border rounded-sm hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
                  >
                    {savingKey ? '[saving...]' : '[save]'}
                  </button>
                  {keyStored && (
                    <button
                      onClick={handleRemoveKey}
                      className="text-xs font-mono px-3 py-1.5 border border-red-500/30 text-red-400 rounded-sm hover:border-red-400 transition-colors"
                    >
                      [clear]
                    </button>
                  )}
                </div>
                {saveMsg && <p className="text-xs font-mono" style={{ color: '#03A6A1' }}>{saveMsg}</p>}
              </div>}

              {/* BYOB ToS gate — hidden for vat-space */}
              {provider !== 'vat-space' && !isActive && !byobTosAccepted && (
                <div className="border border-amber-500/20 bg-amber-500/5 rounded-sm p-4 space-y-3">
                  <p className="text-xs font-mono text-amber-400/80 tracking-widest uppercase">api key terms</p>
                  <ul className="text-[11px] text-muted-foreground/80 font-mono space-y-1.5">
                    <li>— your API key is stored in our database and is technically accessible to the site admin (kaiser.factorial@gmail.com)</li>
                    <li>— it will never be used for any purpose other than powering your bot</li>
                    <li>— you can delete it at any time via [clear]</li>
                  </ul>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={byobTosChecked}
                      onChange={(e) => setByobTosChecked(e.target.checked)}
                      className="accent-terminal-green"
                    />
                    <span className="text-[11px] font-mono text-muted-foreground">understood — proceed</span>
                  </label>
                  <button
                    onClick={handleAcceptByobTos}
                    disabled={!byobTosChecked}
                    className="w-full py-2 border border-amber-500/30 text-amber-400/80 font-mono text-xs tracking-widest rounded-sm hover:bg-amber-500/10 transition-colors disabled:opacity-30"
                  >
                    [confirm & continue]
                  </button>
                </div>
              )}

              {/* Enter / Leave */}
              {!isActive ? (
                <button
                  onClick={handleEnterVat}
                  disabled={saving || (provider !== 'vat-space' && (!keyStored || !byobTosAccepted))}
                  className="w-full py-2.5 border border-terminal-green/50 text-terminal-green font-mono text-sm tracking-widest rounded-sm hover:bg-terminal-green/10 hover:border-terminal-green transition-colors disabled:opacity-40"
                >
                  {saving ? '[initializing…]' : '[enter vat]'}
                </button>
              ) : (
                <button
                  onClick={handleLeaveVat}
                  className="w-full py-2.5 border border-red-500/50 text-red-400 font-mono text-sm tracking-widest rounded-sm hover:bg-red-500/10 hover:border-red-500 transition-colors"
                >
                  [leave vat]
                </button>
              )}

              <p className="text-xs text-muted-foreground text-center pb-4">
                the loop runs while this tab is open — minimize this panel and navigate freely.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}

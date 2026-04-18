'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useSystemStatus } from '@/lib/system-status-context'

interface BotSettings {
  bot: string
  temperature: number
  top_p: number
  repetition_penalty: number
  max_new_tokens: number
  banned_words: string[]
  model_version: string
  base_sleep: number
  base_jitter: number
  top_k: number
  updated_at?: string
}

export default function AdminControlPanel() {
  const { user, isLoading: authLoading } = useAuth()
  const { loopDetails } = useSystemStatus()
  const router = useRouter()
  const [settings, setSettings] = useState<BotSettings[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [manualSecret, setManualSecret] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  const [criticalError, setCriticalError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState<string | null>(null)

  const fetchSettings = useCallback(async (forcedSecret?: string) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      const adminSecret = forcedSecret || manualSecret || process.env.NEXT_PUBLIC_ADMIN_SECRET || ''
      // Fetch Bot Settings
      const res = await fetch(`${baseUrl}/api/admin/settings`, {
        headers: { 'X-Admin-Secret': adminSecret, 'Cache-Control': 'no-store' },
        cache: 'no-store'
      })
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('SECURE_ACCESS_REQUIRED');
        }
        throw new Error('FETCH_FAILED_BY_SERVER');
      }
      
      const data = await res.json()

      // Define default settings for any missing bots
      const defaults = {
        temperature: 0.9,
        top_p: 0.95,
        repetition_penalty: 1.3,
        max_new_tokens: 55,
        banned_words: [],
        model_version: 'v1',
        base_sleep: 120,
        base_jitter: 30,
        top_k: 0
      }

      // Ensure settings have defaults for new fields if DB columns are missing
      const dbEntries = (Array.isArray(data) ? data : [])
      
      // Ensure BOTH 'a' and 'b' bots exist in the final state
      const finalSettings = ['a', 'b'].map(botKey => {
        const existing = dbEntries.find(s => s.bot === botKey)
        if (existing) {
          return {
            ...existing,
            repetition_penalty: existing.repetition_penalty ?? defaults.repetition_penalty,
            max_new_tokens: existing.max_new_tokens ?? defaults.max_new_tokens,
            model_version: existing.model_version ?? defaults.model_version,
            base_sleep: existing.base_sleep ?? defaults.base_sleep,
            base_jitter: existing.base_jitter ?? defaults.base_jitter,
            top_k: existing.top_k ?? defaults.top_k,
            banned_words: existing.banned_words ?? defaults.banned_words
          }
        }
        // If bot is missing entirely from DB response, reconstruct it from defaults
        return { bot: botKey, ...defaults }
      })

      setSettings(finalSettings)
      
      // If we got here, the secret we used is valid
      if (adminSecret) {
        setManualSecret(adminSecret)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('brain_vat_admin_secret', adminSecret)
        }
      }
      
      setMessage(null)
    } catch (error: any) {
      console.error('Settings Fetch Error:', error)
      if (error.message === 'SECURE_ACCESS_REQUIRED') {
        // Flush invalid or missing secret from session storage to prevent stuck loops
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('brain_vat_admin_secret')
        }
        setMessage({ text: 'SECURE_ACCESS_REQUIRED // INVALID_OR_MISSING_PASSPHRASE', type: 'error' })
      } else if (!error.message?.includes('Lock "lock:sb-')) {
        setMessage({ text: error.message || 'COMMUNICATION_FAILURE', type: 'error' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [manualSecret])

  useEffect(() => {
    if (authLoading) return
    if (user?.email !== 'kaiser.factorial@gmail.com') {
      router.replace('/')
      return
    }

    // Try to recover secret from session storage
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('brain_vat_admin_secret')
      if (saved) {
        setManualSecret(saved)
        fetchSettings(saved)
        return
      }
    }

    fetchSettings()
  }, [user, authLoading, router, fetchSettings])

  const handleUpdate = async (botKey: string) => {
    const botSettings = settings.find(s => s.bot === botKey)
    if (!botSettings) return

    setIsSaving(botKey)
    setMessage(null)

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      const adminSecret = manualSecret || process.env.NEXT_PUBLIC_ADMIN_SECRET || ''
      
      // Clean up the data before sending (deduplicate, remove empty)
      // NOTE: We no longer .trim() so that the user can manually include spaces if needed,
      // although the server now handles space-prefixes automatically.
      const cleanedSettings = {
        ...botSettings,
        banned_words: Array.from(new Set(
          botSettings.banned_words
            .filter(w => w !== "")
        ))
      }

      const res = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret
        },
        body: JSON.stringify(cleanedSettings)
      })

      if (!res.ok) throw new Error('SAVE_FAILED')
      
      setShowSuccess(`BOT_${botKey.toUpperCase()}_PARAMETERS_PUSHED`)
      setTimeout(() => setShowSuccess(null), 2500)
      fetchSettings()
    } catch (error: any) {
      setCriticalError(error.message || 'SYNC_PROTOCOL_FAILURE')
    } finally {
      setIsSaving(null)
    }
  }

  const updateBotField = (botKey: string, field: keyof BotSettings, value: any) => {
    setSettings(prev => prev.map(s => 
      s.bot === botKey ? { ...s, [field]: value } : s
    ))
  }

  const togglePause = async (botKey: string, currentState: boolean) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      const adminSecret = manualSecret || process.env.NEXT_PUBLIC_ADMIN_SECRET || ''
      const res = await fetch(`${baseUrl}/api/admin/pause/${botKey}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret
        },
        body: JSON.stringify({ paused: !currentState })
      })
      if (!res.ok) throw new Error('PAUSE_TOGGLE_FAILED')
      refreshStatus()
    } catch (err) {
      console.error(err)
      setCriticalError('Failed to toggle loop state.')
    }
  }

  if (authLoading || (isLoading && !message)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black font-mono text-terminal-green text-xs tracking-widest uppercase text-center p-8">
        <div className="space-y-4">
          <div className="animate-pulse">Accessing_Encrypted_Core...</div>
          <div className="text-[10px] text-[#00441b] opacity-50 tracking-tighter">ESTABLISHING_TLS_HANDSHAKE</div>
        </div>
      </div>
    )
  }

  if (user?.email !== 'kaiser.factorial@gmail.com') return null

  return (
    <div className="min-h-screen bg-black text-terminal-green font-mono p-4 md:p-8 selection:bg-terminal-green selection:text-black antialiased">
      {/* Header */}
      <div className="mb-12 border-b border-[#00441b] pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter" style={{ textShadow: '0 0 10px #00ff41' }}>
            BRAIN_VAT // CONTROL_PANEL
          </h1>
          <div className="text-[10px] text-[#008f11] mt-2 space-x-4 uppercase tracking-widest">
            <span className="border border-[#00441b] px-2 py-0.5">ADMIN: {user?.email}</span>
            <span className="text-[#00ff41]">HYPERPARAMETER_OVERRIDE_ENABLED</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => router.push('/admin/audit')}
            className="text-[10px] uppercase tracking-widest border border-[#00441b] px-4 py-2 hover:border-[#00ff41] hover:text-[#00ff41] transition-all duration-300"
          >
            [audit_logs]
          </button>
          <button 
            onClick={() => router.push('/')}
            className="text-[10px] uppercase tracking-widest border border-red-900 text-red-900 px-4 py-2 hover:bg-red-900 hover:text-black transition-all duration-300 font-bold"
          >
            &lt; EXIT_SESSION
          </button>
        </div>
      </div>

      {message?.text.includes('SECURE_ACCESS_REQUIRED') && (
        <div className="max-w-xl mx-auto mb-12 border border-[#00ff41] bg-[#001500]/50 p-8 shadow-[0_0_20px_#00ff411a]">
          <h2 className="text-xs uppercase tracking-[0.4em] mb-6 text-center text-[#99ffaa]">Administrative_Secret_Required</h2>
          <div className="space-y-4">
            <input 
              type="password"
              placeholder="ENTER_PASSPHRASE..."
              className="w-full bg-black border border-[#00441b] p-4 text-xs text-center tracking-[0.5em] focus:border-[#00ff41] focus:outline-none transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  fetchSettings(val);
                }
              }}
            />
            <p className="text-[9px] text-[#00441b] uppercase text-center tracking-widest leading-relaxed">
              Inference core endpoints are strictly isolated. Enter the admin secret to establish a secure handshake.
            </p>
          </div>
        </div>
      )}

      {/* Critical Danger Zone (Sync Failure) */}
      {criticalError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-950/90 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <div className="max-w-2xl w-full mx-4 border-[4px] border-red-500 bg-black p-12 shadow-[0_0_100px_rgba(239,68,68,0.5)] transform -rotate-1">
            <div className="flex items-center gap-6 mb-8 text-red-500">
              <div className="w-16 h-16 border-4 border-red-500 flex items-center justify-center text-4xl font-bold animate-pulse">!</div>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-[0.2em] leading-none mb-2">Sync_Protocol_Failure</h2>
                <div className="text-xs font-mono opacity-80 uppercase tracking-widest">Core_Link_Severed // Database_Rejection</div>
              </div>
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 p-6 mb-10 font-mono text-sm text-red-400">
              <div className="mb-2 opacity-60 text-[10px] uppercase">Traceback_Log:</div>
              <p className="font-bold tracking-tight">{criticalError}</p>
            </div>

            <button 
              onClick={() => setCriticalError(null)}
              className="w-full bg-red-600 text-black font-black py-5 text-lg uppercase tracking-[0.3em] hover:bg-white transition-all active:scale-95 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
            >
              [ Acknowledge_Protocol_Failure ]
            </button>
            <p className="mt-6 text-[9px] text-red-500/40 uppercase text-center tracking-widest font-bold">
              Attempts to persist parameters will be suspended until session re-evaluation.
            </p>
          </div>
        </div>
      )}

      {/* Dyna-Cyan Success Heartbeat */}
      {showSuccess && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] pointer-events-none">
          <div className="bg-[#00f5ff] text-black px-12 py-6 shadow-[0_0_60px_#00f5ffaa] animate-out fade-out slide-out-to-top-8 zoom-out fill-mode-forwards duration-1000 delay-1500">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-black rounded-full animate-ping" />
              <div className="text-xl font-black uppercase tracking-[0.5em]">{showSuccess}</div>
            </div>
            <div className="text-[10px] uppercase font-bold tracking-widest mt-1 opacity-70">Parameters_Committed_To_Core</div>
          </div>
        </div>
      )}

      {/* System Loop Timing Section */}
      {manualSecret && !isLoading && (
        <div className="max-w-5xl mx-auto mb-12" />
      )}

      {/* Control Grid */}
      {!message && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {settings.length === 0 && (
          <div className="col-span-full border border-dashed border-[#00441b] py-20 text-center">
            <p className="text-[#008f11] text-xs uppercase tracking-widest mb-4">No_Bot_Configuration_Detected</p>
            <p className="text-[10px] text-[#00441b] max-w-md mx-auto px-4 uppercase leading-relaxed font-mono mb-8">
              Ensure the <span className="text-terminal-green">bot_settings</span> table is created in Supabase. Check the walkthrough for the SQL script.
            </p>
            <button 
              disabled={isLoading}
              onClick={() => {
                setIsLoading(true);
                fetchSettings();
              }}
              className="text-[10px] text-terminal-green border border-terminal-green px-4 py-2 hover:bg-terminal-green hover:text-black transition-all disabled:opacity-50 disabled:cursor-wait"
            >
              [ {isLoading ? 'ESTABLISHING_TLS_HANDSHAKE...' : 'RETRY_HANDSHAKE'} ]
            </button>
          </div>
        )}
        {settings.map((botSettings) => (
          <div key={botSettings.bot} className="border border-[#00441b] bg-[#000800] overflow-hidden rounded-sm hover:border-[#00ff41]/40 transition-all duration-500 shadow-2xl relative group">
            {/* Bot Header */}
            <div className="bg-[#001500] px-6 py-3 border-b border-[#00441b] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-terminal-green animate-pulse shadow-[0_0_8px_#00ff41]" />
                <span className="text-sm font-bold tracking-[0.3em]">
                  {botSettings.bot === 'a' ? 'MAUK' : 'ABACI'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-right">
                <button
                  onClick={() => togglePause(botSettings.bot, loopPauses?.[botSettings.bot as 'a' | 'b'] || false)}
                  className={`text-[8px] uppercase tracking-widest px-3 py-1 border transition-colors ${
                    loopPauses?.[botSettings.bot as 'a' | 'b'] 
                      ? 'border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-black shadow-[0_0_10px_#eab308]' 
                      : 'border-[#00441b] text-[#008f11] hover:border-[#00ff41] hover:text-[#00ff41]'
                  }`}
                >
                  {loopPauses?.[botSettings.bot as 'a' | 'b'] ? '[ SYSTEM_PAUSED ]' : '[ PAUSE_LOOP ]'}
                </button>
                <div className="flex flex-col items-end">
                  {/* Loop Status Pill */}
                  <div className={`text-[8px] font-black px-2 py-0.5 mb-1 tracking-tighter rounded-full ${loopDetails?.[botSettings.bot as 'a' | 'b'] ? 'bg-[#00ff41] text-black shadow-[0_0_10px_#00ff41]' : 'border border-[#00441b] text-[#00441b]'}`}>
                    {loopDetails?.[botSettings.bot as 'a' | 'b'] ? 'LOOP_ACTIVE' : 'LOOP_OFFLINE'}
                  </div>
                  <div className="text-[9px] text-[#008f11] font-bold uppercase tracking-widest font-mono">
                    Node_{botSettings.bot.toUpperCase()}
                  </div>
                  {botSettings.updated_at && (
                    <div className="text-[7px] text-[#00441b] uppercase tracking-widest mt-0.5">
                      Last_Sync: {new Date(botSettings.updated_at).toLocaleString([], { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* Model Version & Timing Group */}
              <div className="grid grid-cols-1 gap-6 pb-6 border-b border-[#002200]">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] uppercase text-[#008f11] font-bold tracking-widest">Model Version</label>
                  </div>
                  <input 
                    type="text"
                    value={botSettings.model_version || 'v1'}
                    onChange={(e) => updateBotField(botSettings.bot, 'model_version', e.target.value)}
                    placeholder="e.g. v1, v2-experimental"
                    className="w-full bg-black border border-[#002200] px-4 py-2 text-xs text-[#00ff41] focus:border-[#00ff41] focus:outline-none transition-colors font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] uppercase text-cyan-700 font-bold tracking-widest">Frequency (s)</label>
                      <span className="text-xs text-cyan-400 tabular-nums">{botSettings.base_sleep}s</span>
                    </div>
                    <input 
                      type="range" min="10" max="600" step="10"
                      value={botSettings.base_sleep || 120}
                      onChange={(e) => updateBotField(botSettings.bot, 'base_sleep', parseInt(e.target.value))}
                      className="w-full h-1 bg-[#001522] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] uppercase text-cyan-700 font-bold tracking-widest">Jitter (s)</label>
                      <span className="text-xs text-cyan-400 tabular-nums">±{botSettings.base_jitter}s</span>
                    </div>
                    <input 
                      type="range" min="0" max="120" step="5"
                      value={botSettings.base_jitter || 30}
                      onChange={(e) => updateBotField(botSettings.bot, 'base_jitter', parseInt(e.target.value))}
                      className="w-full h-1 bg-[#001522] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Temperature */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase text-[#008f11] font-bold tracking-widest">Temperature</label>
                  <span className="text-xs text-[#00ff41] tabular-nums">{botSettings.temperature.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0.1" max="2.0" step="0.05"
                  value={botSettings.temperature}
                  onChange={(e) => updateBotField(botSettings.bot, 'temperature', parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#002200] rounded-lg appearance-none cursor-pointer accent-[#00ff41] hover:accent-[#00ff41]/80 transition-all"
                />
                <div className="flex justify-between text-[8px] text-[#00441b] font-bold uppercase tracking-tighter">
                  <span>Stability</span>
                  <span>Creativity</span>
                </div>
              </div>

              {/* Top-P */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase text-[#008f11] font-bold tracking-widest">Top-P (Nucleus)</label>
                  <span className="text-xs text-[#00ff41] tabular-nums">{botSettings.top_p.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0.1" max="1.0" step="0.01"
                  value={botSettings.top_p}
                  onChange={(e) => updateBotField(botSettings.bot, 'top_p', parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#002200] rounded-lg appearance-none cursor-pointer accent-[#00ff41] hover:accent-[#00ff41]/80 transition-all"
                />
                <div className="flex justify-between text-[8px] text-[#00441b] font-bold uppercase tracking-tighter">
                  <span>Strict</span>
                  <span>Diverse</span>
                </div>
              </div>

              {/* Repetition Penalty */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase text-[#008f11] font-bold tracking-widest">Repetition Penalty</label>
                  <span className="text-xs text-[#00ff41] tabular-nums">{botSettings.repetition_penalty?.toFixed(2) || "1.30"}</span>
                </div>
                <input 
                  type="range" min="1.0" max="2.5" step="0.05"
                  value={botSettings.repetition_penalty || 1.3}
                  onChange={(e) => updateBotField(botSettings.bot, 'repetition_penalty', parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#002200] rounded-lg appearance-none cursor-pointer accent-[#00ff41] hover:accent-[#00ff41]/80 transition-all"
                />
                <div className="flex justify-between text-[8px] text-[#00441b] font-bold uppercase tracking-tighter">
                  <span>Fluid</span>
                  <span>Diverse</span>
                </div>
              </div>

              {/* Max New Tokens */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase text-[#008f11] font-bold tracking-widest">Max Response Length</label>
                  <span className="text-xs text-[#00ff41] tabular-nums">{botSettings.max_new_tokens || 55}</span>
                </div>
                <input 
                  type="range" min="10" max="200" step="1"
                  value={botSettings.max_new_tokens || 55}
                  onChange={(e) => updateBotField(botSettings.bot, 'max_new_tokens', parseInt(e.target.value))}
                  className="w-full h-1 bg-[#002200] rounded-lg appearance-none cursor-pointer accent-[#00ff41] hover:accent-[#00ff41]/80 transition-all"
                />
                <div className="flex justify-between text-[8px] text-[#00441b] font-bold uppercase tracking-tighter">
                  <span>Concise</span>
                  <span>Verbose</span>
                </div>
              </div>

              {/* Top-K */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase text-[#008f11] font-bold tracking-widest">Top-K (Entropy Floor)</label>
                  <span className="text-xs text-[#00ff41] tabular-nums">{botSettings.top_k === 0 ? 'FULL_CHAOS' : botSettings.top_k}</span>
                </div>
                <input 
                  type="range" min="0" max="100" step="1"
                  value={botSettings.top_k || 0}
                  onChange={(e) => updateBotField(botSettings.bot, 'top_k', parseInt(e.target.value))}
                  className="w-full h-1 bg-[#002200] rounded-lg appearance-none cursor-pointer accent-[#00ff41] hover:accent-[#00ff41]/80 transition-all"
                />
                <div className="flex justify-between text-[8px] text-[#00441b] font-bold uppercase tracking-tighter">
                  <span>Unleashed</span>
                  <span>Focused</span>
                </div>
              </div>

              {/* Banned Words */}
              <div className="space-y-4">
                <label className="text-[10px] uppercase text-[#008f11] font-bold tracking-widest block">Banned Words (Comma-Separated)</label>
                <textarea 
                  value={botSettings.banned_words.join(', ')}
                  onChange={(e) => {
                    // Update state with the raw tokens, allowing spaces/commas while typing
                    const raw = e.target.value;
                    const words = raw.split(',').map(w => w.startsWith(' ') ? w : w); // Keep raw structure
                    updateBotField(botSettings.bot, 'banned_words', raw.split(','));
                  }}
                  rows={4}
                  className="w-full bg-black border border-[#002200] p-3 text-xs text-[#00cc33] focus:border-[#00ff41] focus:outline-none transition-colors scrollbar-thin scrollbar-thumb-[#00441b] scrollbar-track-black"
                  placeholder="word1, phrase 1, ..."
                />
                <p className="text-[8px] text-[#00441b] uppercase tracking-widest leading-relaxed">
                  These tokens will be suppressed during inference to prevent overfitting or undesirable hallucinations.
                </p>
              </div>

              {/* Save Button */}
              <button 
                onClick={() => handleUpdate(botSettings.bot)}
                disabled={isSaving === botSettings.bot}
                className="w-full py-4 border border-[#00ff41] text-[#00ff41] text-[10px] font-bold uppercase tracking-[0.4em] hover:bg-[#00ff41] hover:text-black transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed group/btn overflow-hidden relative"
              >
                <div className={`absolute inset-0 bg-[#00ff41] transition-transform duration-500 -translate-x-full group-hover/btn:translate-x-0 ${isSaving === botSettings.bot ? 'translate-x-0' : ''}`} />
                <span className="relative z-10">
                  {isSaving === botSettings.bot ? 'PUSHING_HYPERPARAMETERS...' : 'APPLY_CHANGES'}
                </span>
              </button>
            </div>
          </div>
        ))}
        </div>
      )}

      <div className="mt-16 text-center text-[9px] text-[#00441b] uppercase tracking-[0.5em] pb-8">
        brain.vat // hyperparameter_management_shell // v1.2.5
      </div>
    </div>
  )
}

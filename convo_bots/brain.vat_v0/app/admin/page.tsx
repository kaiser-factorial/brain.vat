'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'

interface BotSettings {
  bot: string
  temperature: number
  top_p: number
  repetition_penalty: number
  max_new_tokens: number
  banned_words: string[]
  updated_at?: string
}

interface SystemSettings {
  cycle_sleep: number
  cycle_jitter: number
  updated_at?: string
}

export default function AdminControlPanel() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState<BotSettings[]>([])
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ cycle_sleep: 120, cycle_jitter: 30 })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [isSavingSystem, setIsSavingSystem] = useState(false)
  const [manualSecret, setManualSecret] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

  const fetchSettings = useCallback(async (forcedSecret?: string) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      const adminSecret = forcedSecret || manualSecret || process.env.NEXT_PUBLIC_ADMIN_SECRET || ''
      // Fetch Bot Settings
      const res = await fetch(`${baseUrl}/api/admin/settings`, {
        headers: { 'X-Admin-Secret': adminSecret }
      })
      
      // Fetch System Settings
      const sysRes = await fetch(`${baseUrl}/api/admin/system`, {
        headers: { 'X-Admin-Secret': adminSecret }
      })
      
      if (!res.ok || !sysRes.ok) {
        if (res.status === 401 || sysRes.status === 401) {
          throw new Error('SECURE_ACCESS_REQUIRED');
        }
        throw new Error('FETCH_FAILED_BY_SERVER');
      }
      
      const data = await res.json()
      const sysData = await sysRes.json()

      // Ensure settings have defaults for new fields if DB columns are missing
      const sanitized = (Array.isArray(data) ? data : []).map(s => ({
        ...s,
        repetition_penalty: s.repetition_penalty ?? 1.3,
        max_new_tokens: s.max_new_tokens ?? 55
      }))
      setSettings(sanitized)
      setSystemSettings(sysData)
      
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
      
      const res = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret
        },
        body: JSON.stringify(botSettings)
      })

      if (!res.ok) throw new Error('SAVE_FAILED')
      
      setMessage({ text: `BOT_${botKey.toUpperCase()}_HYPERPARAMETERS_SYNCED`, type: 'success' })
      fetchSettings()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ text: 'SYNC_FAILURE_DETECTION', type: 'error' })
    } finally {
      setIsSaving(null)
    }
  }

  const handleSystemUpdate = async () => {
    setIsSavingSystem(true)
    setMessage(null)

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      const adminSecret = manualSecret || process.env.NEXT_PUBLIC_ADMIN_SECRET || ''
      
      const res = await fetch(`${baseUrl}/api/admin/system`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret
        },
        body: JSON.stringify(systemSettings)
      })

      if (!res.ok) throw new Error('SYSTEM_SYNC_FAILED')
      
      setMessage({ text: 'SYSTEM_TIMING_PARAMETERS_SYNCED', type: 'success' })
      fetchSettings()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ text: 'SYSTEM_SYNC_FAILURE', type: 'error' })
    } finally {
      setIsSavingSystem(false)
    }
  }

  const updateBotField = (botKey: string, field: keyof BotSettings, value: any) => {
    setSettings(prev => prev.map(s => 
      s.bot === botKey ? { ...s, [field]: value } : s
    ))
  }

  const updateSystemField = (field: keyof SystemSettings, value: any) => {
    setSystemSettings(prev => ({ ...prev, [field]: value }))
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

      {message && !message.text.includes('SECURE_ACCESS_REQUIRED') && (
        <div className={`max-w-5xl mx-auto mb-8 p-3 text-[10px] uppercase tracking-[0.2em] text-center border ${message.type === 'success' ? 'border-terminal-green bg-terminal-green/5 text-terminal-green' : 'border-red-500 bg-red-500/5 text-red-500'} animate-in fade-in slide-in-from-top-4 duration-500`}>
          {message.text}
        </div>
      )}

      {/* System Loop Timing Section */}
      {manualSecret && !isLoading && (
        <div className="max-w-5xl mx-auto mb-12">
          <div className="border border-[#00441b] bg-[#000800] p-6 rounded-sm shadow-2xl relative group">
            <div className="flex justify-between items-center mb-8 border-b border-[#002200] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_#0088ff] animate-pulse" />
                <h3 className="text-sm font-bold tracking-[0.3em] text-cyan-500">SYSTEM_LOOP_TIMING</h3>
              </div>
              <button 
                onClick={handleSystemUpdate}
                disabled={isSavingSystem}
                className="text-[10px] border border-cyan-500 text-cyan-500 px-6 py-1 hover:bg-cyan-500 hover:text-black transition-all font-bold disabled:opacity-50"
              >
                {isSavingSystem ? 'SYNCING_CORE...' : 'UPDATE_SYSTEM_CLOCK'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Cycle Sleep */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase text-cyan-700 font-bold tracking-widest">Base Cycle Interval (Sleep)</label>
                  <span className="text-xs text-cyan-400 tabular-nums">{systemSettings.cycle_sleep}s</span>
                </div>
                <input 
                  type="range" min="10" max="600" step="10"
                  value={systemSettings.cycle_sleep}
                  onChange={(e) => updateSystemField('cycle_sleep', parseInt(e.target.value))}
                  className="w-full h-1 bg-[#001522] rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                />
                <div className="flex justify-between text-[8px] text-cyan-900 font-bold uppercase tracking-tighter">
                  <span>Fast_Dialogue</span>
                  <span>Deep_Processing</span>
                </div>
              </div>

              {/* Cycle Jitter */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase text-cyan-700 font-bold tracking-widest">Temporal Variance (Jitter)</label>
                  <span className="text-xs text-cyan-400 tabular-nums">±{systemSettings.cycle_jitter}s</span>
                </div>
                <input 
                  type="range" min="0" max="120" step="5"
                  value={systemSettings.cycle_jitter}
                  onChange={(e) => updateSystemField('cycle_jitter', parseInt(e.target.value))}
                  className="w-full h-1 bg-[#001522] rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                />
                <div className="flex justify-between text-[8px] text-cyan-900 font-bold uppercase tracking-tighter">
                  <span>Precise</span>
                  <span>Organic_Jitter</span>
                </div>
              </div>
            </div>
            
            <p className="mt-6 text-[8px] text-cyan-900 uppercase tracking-widest text-center italic">
              Adjusting these parameters will update the background autonomous loop on the next dialogue flip.
            </p>
          </div>
        </div>
      )}

      {/* Control Grid */}
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
              <div className="text-right">
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

            <div className="p-8 space-y-8">
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
                  <span>Brief</span>
                  <span>Expansive</span>
                </div>
              </div>

              {/* Banned Words */}
              <div className="space-y-4">
                <label className="text-[10px] uppercase text-[#008f11] font-bold tracking-widest block">Banned Words (Comma-Separated)</label>
                <textarea 
                  value={botSettings.banned_words.join(',')}
                  onChange={(e) => {
                    const words = e.target.value.split(',')
                      .map(w => w.trim())
                      .filter(w => w !== ""); 
                    updateBotField(botSettings.bot, 'banned_words', words);
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

      <div className="mt-16 text-center text-[9px] text-[#00441b] uppercase tracking-[0.5em] pb-8">
        brain.vat // hyperparameter_management_shell // v1.2.5
      </div>
    </div>
  )
}

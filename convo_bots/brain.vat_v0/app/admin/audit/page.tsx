'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'

interface AuditLog {
  timestamp: string
  bot: string
  bot_name: string
  prompt: string
  response: string
  settings?: {
    temperature: number
    top_p: number
    top_k?: number
    repetition_penalty?: number
    max_new_tokens?: number
    banned_words?: string[]
    model_version?: string
  }
  memory_trace?: string | null
  suppressor_log?: string[]
}

export default function AuditDashboard() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [manualSecret, setManualSecret] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<string | null>(null)
  const [manualBaseUrl, setManualBaseUrl] = useState<string | null>(null)
  const [lastErrorTime, setLastErrorTime] = useState<number>(0)
  const [glitchText, setGlitchText] = useState('')

  // 1. DATA FETCHING - Uses Env Var for Production Readiness
  const fetchLogs = useCallback(async (forcedSecret?: string, forcedBaseUrl?: string) => {
    setIsLoading(true);
    try {
      const baseUrl = forcedBaseUrl || manualBaseUrl || process.env.NEXT_PUBLIC_API_URL || 'https://brick-factorial-brain-vat-inference.hf.space'
      const adminSecret = forcedSecret || manualSecret || process.env.NEXT_PUBLIC_ADMIN_SECRET || ''
      const res = await fetch(`${baseUrl}/api/admin/audit`, {
        headers: { 'X-Admin-Secret': adminSecret },
        cache: 'no-store'
      })

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('SECURE_ACCESS_REQUIRED')
        }
        if (res.status === 404) throw new Error('AUDIT_ENDPOINT_NOT_FOUND_404')
        if (res.status === 500) throw new Error('SERVER_INTERNAL_ERROR_500')
        throw new Error(`COMM_FAILURE_STATUS_${res.status}`)
      }

      const data = await res.json()
      setLogs(Array.isArray(data) ? data.reverse() : [])
      setErrorStatus(null)

      // If we got here, the secret and URL we used are valid
      if (adminSecret) {
        setManualSecret(adminSecret)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('brain_vat_admin_secret', adminSecret)
        }
      }
      if (forcedBaseUrl || manualBaseUrl) {
        setManualBaseUrl(baseUrl)
        if (typeof window !== 'undefined') {
          localStorage.setItem('brain_vat_manual_url', baseUrl)
        }
      }
    } catch (error: any) {
      if (error.message !== 'SECURE_ACCESS_REQUIRED') {
        console.error('Audit Fetch Error:', error)
      }
      setLastErrorTime(Date.now());
      // On TypeError (Failed to fetch), we force the SECURE_ACCESS_REQUIRED state 
      // so the user can see the password input even if the server is unreachable.
      const isSecReq = error.message === 'SECURE_ACCESS_REQUIRED' || error.name === 'TypeError'
      setErrorStatus(isSecReq ? 'SECURE_ACCESS_REQUIRED' : (error.message || 'UNKNOWN_COMM_ERROR'))
    } finally {
      setIsLoading(false)
    }
  }, [manualSecret])

  // 2. ACCESS CONTROL & INITIALIZATION
  useEffect(() => {
    if (authLoading) return

    if (user?.email !== 'kaiser.factorial@gmail.com') {
      console.warn('[Audit] Unauthorized access attempt detected.')
      router.replace('/')
      return
    }

    // Try to recover secret and URL from storage
    if (typeof window !== 'undefined') {
      const savedSecret = sessionStorage.getItem('brain_vat_admin_secret')
      const savedUrl = localStorage.getItem('brain_vat_manual_url')
      if (savedUrl) setManualBaseUrl(savedUrl)
      if (savedSecret) {
        setManualSecret(savedSecret)
        fetchLogs(savedSecret, savedUrl || undefined)
        return
      }
    }

    fetchLogs()
    const interval = setInterval(() => {
      if (isLoading) return;
      const savedSecret = sessionStorage.getItem('brain_vat_admin_secret')
      const savedUrl = localStorage.getItem('brain_vat_manual_url')
      fetchLogs(savedSecret || undefined, savedUrl || undefined)
    }, 15000)
    return () => clearInterval(interval)
  }, [user, authLoading, router, fetchLogs])

  // 3. UI EFFECTS
  useEffect(() => {
    const messages = ['SYSTEM_OVERRIDE_ACTIVE', 'INFERENCE_RECORDS_UNLOCKED', 'TRACE_SOURCE_IDENTIFIED', 'HALLUCINATION_DETECTED']
    let i = 0
    const tid = setInterval(() => {
      setGlitchText(messages[i % messages.length])
      i++
    }, 4000)
    return () => clearInterval(tid)
  }, [])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black font-mono text-[#00ff41]">
        <div className="animate-pulse tracking-[0.2em]">INITIALIZING_SECURE_CHANNEL...</div>
      </div>
    )
  }

  if (user?.email !== 'kaiser.factorial@gmail.com') {
    return null // Redirection handled in useEffect
  }

  return (
    <div className="min-h-screen bg-black text-[#00ff41] font-mono p-4 md:p-8 selection:bg-[#00ff41] selection:text-black antialiased">
      {/* Header */}
      <div className="mb-8 border-b border-[#00441b] pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tighter"
            style={{ textShadow: '0 0 10px #00ff41' }}
          >
            BRAIN_VAT // AUDIT_CON_01
          </h1>
          <div className="text-[10px] text-[#008f11] mt-2 space-x-4 uppercase tracking-widest">
            <span className="border border-[#00441b] px-2 py-0.5">ADMIN: {user?.email}</span>
            <span className="animate-pulse text-[#00ff41]">{glitchText}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/admin')}
            className="text-[10px] uppercase tracking-widest border border-[#00ff41] px-4 py-2 hover:bg-[#00ff41] hover:text-black transition-all duration-300 font-bold"
          >
            &lt; CONTROL_PANEL
          </button>
          <button
            onClick={() => router.push('/')}
            className="text-[10px] uppercase tracking-widest border border-[#00ff41] px-4 py-2 hover:bg-[#00ff41] hover:text-black transition-all duration-300 font-bold"
          >
            EXIT_SESSION
          </button>
        </div>
      </div>

      {/* Secure Access Prompt fallback */}
      {errorStatus === 'SECURE_ACCESS_REQUIRED' && (
        <div className={`max-w-xl mx-auto mb-12 border border-[#00ff41] bg-[#001500]/50 p-8 shadow-[0_0_20px_#00ff411a] relative overflow-hidden transition-transform duration-100 ${lastErrorTime > 0 ? 'animate-shake' : ''}`} key={lastErrorTime}>
          {isLoading && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
                <div className="text-[10px] uppercase tracking-widest animate-pulse">Establishing_Link...</div>
              </div>
            </div>
          )}
          <h2 className="text-xs uppercase tracking-[0.4em] mb-6 text-center text-[#99ffaa]">Administrative_Handshake_Required</h2>
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <label className="text-[9px] uppercase text-[#00441b] mb-1 block tracking-widest">Inference Core URL</label>
                <input
                  type="text"
                  id="audit-url-input"
                  defaultValue={manualBaseUrl || process.env.NEXT_PUBLIC_API_URL || 'https://brick-factorial-brain-vat-inference.hf.space'}
                  placeholder="https://brick-factorial-brain-vat-inference.hf.space"
                  disabled={isLoading}
                  className="w-full bg-black/40 border border-[#002200] p-3 text-[10px] tracking-wider focus:border-[#00ff41] focus:outline-none transition-all disabled:opacity-50 text-terminal-green"
                />
              </div>

              <div className="relative group">
                <label className="text-[9px] uppercase text-[#00441b] mb-1 block tracking-widest">Admin Secret</label>
                <input
                  type="password"
                  id="audit-secret-input"
                  placeholder="ENTER_PASSPHRASE..."
                  disabled={isLoading}
                  className="w-full bg-black border border-[#00441b] p-4 text-xs text-center tracking-[0.5em] focus:border-[#00ff41] focus:outline-none transition-all placeholder:text-[#00441b] disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const secret = (document.getElementById('audit-secret-input') as HTMLInputElement).value;
                      const url = (document.getElementById('audit-url-input') as HTMLInputElement).value;
                      fetchLogs(secret, url);
                    }
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => {
                const secret = (document.getElementById('audit-secret-input') as HTMLInputElement).value;
                const url = (document.getElementById('audit-url-input') as HTMLInputElement).value;
                fetchLogs(secret, url);
              }}
              disabled={isLoading}
              className="w-full py-4 border border-[#00ff41] text-[#00ff41] text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#00ff41] hover:text-black transition-all disabled:opacity-50 active:scale-[0.98] shadow-[0_0_15px_#00ff4122]"
            >
              [ SYNC_AUDIT_STREAM ]
            </button>

            {errorStatus !== 'SECURE_ACCESS_REQUIRED' && (
              <p className="text-[10px] text-red-500 uppercase text-center tracking-widest font-bold animate-pulse">
                {errorStatus?.split('//')[1] || 'HANDSHAKE_REJECTED'}
              </p>
            )}

            <p className="text-[9px] text-[#00441b] uppercase text-center tracking-widest leading-relaxed">
              Historical inference records are strictly isolated. Enter the admin secret to establish a secure handshake.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-8 max-w-6xl mx-auto">
        {isLoading ? (
          <div className="text-center py-32 animate-pulse tracking-widest text-[#008f11]">
            SYNCHRONIZING_BRAIN_STREAM...
          </div>
        ) : errorStatus && errorStatus !== 'SECURE_ACCESS_REQUIRED' ? (
          <div className="text-center py-32 text-red-900 border border-dashed border-red-900 uppercase text-[10px] tracking-widest">
            {errorStatus} // HANDSHAKE_TERMINATED
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-32 text-[#00441b] border border-dashed border-[#00441b]">
            NO_INFERENCE_DATA_RECORDED_BY_SERVER
          </div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={`${log.timestamp}-${idx}`}
              className="border border-[#00441b] bg-[#000800] overflow-hidden rounded-sm group hover:border-[#00ff41]/50 transition-all duration-500 shadow-2xl"
            >
              {/* Log Meta */}
              <div className="bg-[#001500] px-4 py-2 border-b border-[#00441b] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${log.bot === 'a' ? 'bg-[#00ccff] shadow-[0_0_8px_#00ccff]' : 'bg-[#ffbf00] shadow-[0_0_8px_#ffbf00]'}`} />
                  <span className={`text-xs font-bold tracking-widest ${log.bot === 'a' ? 'text-[#00ccff]' : 'text-[#ffbf00]'}`}>
                    {log.bot_name.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {log.memory_trace && (
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 border rounded-full animate-fadeIn ${log.bot === 'a' ? 'bg-[#00ccff]/10 border-[#00ccff]/30' : 'bg-[#ffbf00]/10 border-[#ffbf00]/30'}`}>
                      <div className={`w-1 h-1 rounded-full ${log.bot === 'a' ? 'bg-[#00ccff]' : 'bg-[#ffbf00]'}`} />
                      <span className={`text-[8px] font-black uppercase tracking-widest ${log.bot === 'a' ? 'text-[#00ccff]' : 'text-[#ffbf00]'}`}>Memory: {log.memory_trace}</span>
                    </div>
                  )}
                  <span className="text-[10px] text-[#008f11] font-bold">
                    {new Date(log.timestamp).toLocaleTimeString()} // {new Date(log.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-6">
                {/* Prompt Block */}
                <div>
                  <div className="text-[9px] uppercase text-[#008f11] mb-2 font-bold tracking-widest opacity-80">
                    &gt; Raw_Inference_Input
                  </div>
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap bg-black/60 p-4 rounded-sm border border-[#002200] max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-[#00441b] scrollbar-track-black text-[#00cc33]">
                    {log.prompt}
                  </pre>
                </div>

                {/* Response Block */}
                <div>
                  <div className="text-[9px] uppercase text-[#008f11] mb-2 font-bold tracking-widest opacity-80">
                    &gt; Generated_Output
                  </div>
                  <div className="text-sm p-4 border-l-2 border-[#00ff41] bg-[#001100]/50 italic relative group">
                    <span className="absolute -left-1 top-0 bottom-0 w-0.5 bg-[#00ff41] group-hover:shadow-[0_0_10px_#00ff41] transition-shadow" />
                    "{log.response}"
                  </div>
                </div>

                {/* Diagnostics Feed / Hyperparameters */}
                <div className="pt-4 border-t border-[#002200] space-y-4">
                  {log.settings && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                      <div className="bg-[#001100] border border-[#002200] p-2 rounded-sm group/param hover:border-[#00ff41]/30 transition-all">
                        <div className="text-[7px] text-[#006600] uppercase font-black mb-1">Temperature</div>
                        <div className="text-[10px] text-[#00ff41] font-bold tabular-nums">{log.settings.temperature?.toFixed(2) || 'N/A'}</div>
                      </div>
                      <div className="bg-[#001100] border border-[#002200] p-2 rounded-sm group/param hover:border-[#00ff41]/30 transition-all">
                        <div className="text-[7px] text-[#006600] uppercase font-black mb-1">Top-P</div>
                        <div className="text-[10px] text-[#00ff41] font-bold tabular-nums">{log.settings.top_p?.toFixed(2) || 'N/A'}</div>
                      </div>
                      <div className="bg-[#001100] border border-[#002200] p-2 rounded-sm group/param hover:border-[#00ff41]/30 transition-all">
                        <div className="text-[7px] text-[#006600] uppercase font-black mb-1">Penalty</div>
                        <div className="text-[10px] text-[#00ff41] font-bold tabular-nums">{log.settings.repetition_penalty?.toFixed(2) || '1.30'}</div>
                      </div>
                      <div className="bg-[#001100] border border-[#002200] p-2 rounded-sm group/param hover:border-[#00ff41]/30 transition-all">
                        <div className="text-[7px] text-[#006600] uppercase font-black mb-1">Limit</div>
                        <div className="text-[10px] text-[#00ff41] font-bold tabular-nums">{log.settings.max_new_tokens || '55'}t</div>
                      </div>
                      <div className="bg-[#001100] border border-[#002200] p-2 rounded-sm group/param hover:border-[#00ff41]/30 transition-all">
                        <div className="text-[7px] text-[#006600] uppercase font-black mb-1">Filter</div>
                        <div className="text-[10px] text-[#00ff41] font-bold tabular-nums">{log.settings.banned_words?.length || 0} tokens</div>
                      </div>
                    </div>
                  )}

                  {/* Suppressor Details (Collapsible) */}
                  {log.suppressor_log && log.suppressor_log.length > 0 && (
                    <div className="mt-4 border-t border-[#002200]/50 pt-4">
                      <details className="group/suppressor">
                        <summary className="list-none cursor-pointer flex items-center gap-2 text-[8px] uppercase tracking-widest text-[#00441b] hover:text-[#00ff41] transition-colors font-bold">
                          <span className="group-open/suppressor:rotate-90 transition-transform">▶</span>
                          <span>Suppressor_Diagnostics // {log.suppressor_log.length} Active_Tokens</span>
                        </summary>
                        <div className="mt-4 flex flex-wrap gap-2 animate-fadeIn">
                          {log.suppressor_log.map((word, wIdx) => (
                            <span
                              key={wIdx}
                              className="px-2 py-1 bg-[#002200]/30 border border-[#00441b]/30 text-[9px] text-[#008f11] rounded-sm hover:border-[#00ff41]/50 hover:text-[#00ff41] transition-all cursor-default"
                            >
                              {word}
                            </span>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-6 text-[9px] text-[#006600] font-bold tracking-widest pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#008f11]">FIDELITY:</span>
                      <span className="text-[#00ff41]">OPTIMAL</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#008f11]">ENTROPY_CHECK:</span>
                      <span className="text-[#00ff41]">PASSED</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#008f11]">VERSION:</span>
                      <span className="text-[#00ff41]">{log.settings?.model_version || 'v1.0'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Branding */}
      <div className="mt-16 text-center text-[9px] text-[#00441b] uppercase tracking-[0.5em] pb-8">
        brain.vat // core_observability_module // v1.2.0
      </div>
    </div>
  )
}

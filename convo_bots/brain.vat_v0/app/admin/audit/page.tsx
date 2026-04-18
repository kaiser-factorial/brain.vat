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
}

export default function AuditDashboard() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [manualSecret, setManualSecret] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<string | null>(null)
  const [glitchText, setGlitchText] = useState('')

  // 1. DATA FETCHING - Uses Env Var for Production Readiness
  const fetchLogs = useCallback(async (forcedSecret?: string) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      const adminSecret = forcedSecret || manualSecret || process.env.NEXT_PUBLIC_ADMIN_SECRET || ''
      const res = await fetch(`${baseUrl}/api/admin/audit`, {
        headers: { 'X-Admin-Secret': adminSecret, 'Cache-Control': 'no-store' },
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

      // If we got here, the secret we used is valid
      if (adminSecret) {
        setManualSecret(adminSecret)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('brain_vat_admin_secret', adminSecret)
        }
      }
    } catch (error: any) {
      console.error('Audit Fetch Error:', error)
      setErrorStatus(error.message || 'UNKNOWN_COMM_ERROR')
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

    // Try to recover secret from session storage
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('brain_vat_admin_secret')
      if (saved) {
        setManualSecret(saved)
        fetchLogs(saved)
        return
      }
    }

    fetchLogs()
    const interval = setInterval(() => {
      const saved = sessionStorage.getItem('brain_vat_admin_secret')
      fetchLogs(saved || undefined)
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
        <button 
          onClick={() => router.push('/')}
          className="text-[10px] uppercase tracking-widest border border-[#00ff41] px-4 py-2 hover:bg-[#00ff41] hover:text-black transition-all duration-300 font-bold"
        >
          &lt; EXIT_SESSION
        </button>
      </div>

      {/* Secure Access Prompt fallback */}
      {errorStatus === 'SECURE_ACCESS_REQUIRED' && (
        <div className="max-w-xl mx-auto mb-12 border border-[#00ff41] bg-[#001500]/50 p-8 shadow-[0_0_20px_#00ff411a]">
          <h2 className="text-xs uppercase tracking-[0.4em] mb-6 text-center text-[#99ffaa]">Administrative_Secret_Required</h2>
          <div className="space-y-4">
            <input 
              type="password"
              placeholder="ENTER_PASSPHRASE..."
              className="w-full bg-black border border-[#00441b] p-4 text-xs text-center tracking-[0.5em] focus:border-[#00ff41] focus:outline-none transition-all placeholder:text-[#00441b]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  fetchLogs(val);
                }
              }}
            />
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
                   <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
                   <span className="text-xs font-bold tracking-widest text-[#00ff41]">
                     {log.bot_name.toUpperCase()}
                   </span>
                </div>
                <span className="text-[10px] text-[#008f11] font-bold">
                  {new Date(log.timestamp).toLocaleTimeString()} // {new Date(log.timestamp).toLocaleDateString()}
                </span>
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

                {/* Diagnostics Feed */}
                <div className="pt-3 border-t border-[#002200] flex flex-wrap gap-6 text-[9px] text-[#006600] font-bold tracking-widest">
                   <div className="flex items-center gap-2">
                     <span className="text-[#008f11]">FIDELITY:</span>
                     <span className="text-[#00ff41]">OPTIMAL</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-[#008f11]">ENTROPY_CHECK:</span>
                     <span className="text-[#00ff41]">PASSED</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-[#008f11]">LINEAGE:</span>
                     <span className="text-[#00ff41]">TRACED</span>
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

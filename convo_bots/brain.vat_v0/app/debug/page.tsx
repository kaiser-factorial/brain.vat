'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugPage() {
  const [report, setReport] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info', data?: any) => {
    setReport(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), msg, type, data }])
  }

  useEffect(() => {
    const runDiagnostics = async () => {
      addLog('Initializing Deep Scan...', 'info')
      
      // 1. Project ID Masked Check
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'UNDEFINED'
      const projectId = url.split('//')[1]?.split('.')[0] || 'Unknown'
      addLog(`Connected to Project: ${projectId}`, 'info')

      // 2. Auth Check
      const { data: { user } } = await supabase.auth.getUser()
      addLog(`Session User: ${user ? user.email : 'Unauthenticated (Anon)'}`, 'info')

      // 3. Messages Scan
      try {
        addLog('Attempting to read [messages] table...', 'info')
        const { data, error, count } = await supabase
          .from('messages')
          .select('id', { count: 'exact' })
          .limit(5)
        
        if (error) {
          addLog(`Message Table Error: ${error.message}`, 'error', error)
        } else {
          addLog(`Messages Found: ${count ?? 0} rows reachable.`, 'success')
        }
      } catch (err: any) {
        addLog(`Message Table Exception: ${err.message}`, 'error')
      }

      // 4. Memory Concepts Scan
      try {
        addLog('Attempting to read [memory_concepts] table...', 'info')
        const { data, error, count } = await supabase
          .from('memory_concepts')
          .select('id', { count: 'exact' })
          .limit(5)
        
        if (error) {
          addLog(`Memory Table Error: ${error.message}`, 'error', error)
        } else {
          addLog(`Memories Found: ${count ?? 0} rows reachable.`, 'success')
        }
      } catch (err: any) {
        addLog(`Memory Table Exception: ${err.message}`, 'error')
      }

      addLog('Scan Complete.', 'info')
      setIsLoading(false)
    }

    runDiagnostics()
  }, [])

  return (
    <div className="min-h-screen bg-black text-green-500 p-8 font-mono text-sm">
      <div className="max-w-3xl mx-auto border border-green-900 bg-black/50 p-6 rounded shadow-[0_0_20px_rgba(0,50,0,0.5)]">
        <h1 className="text-xl mb-6 border-b border-green-900 pb-2">BRAIN_VAT :: SUPABASE_LINK_DIAGNOSTICS</h1>
        
        <div className="space-y-2 mb-8">
          {report.map((log, i) => (
            <div key={i} className="flex gap-4">
              <span className="text-green-900">[{log.timestamp}]</span>
              <span className={
                log.type === 'error' ? 'text-red-500' : 
                log.type === 'success' ? 'text-green-400' : 
                log.type === 'warn' ? 'text-yellow-500' : 'text-green-100'
              }>
                {log.type === 'error' ? '✖' : log.type === 'success' ? '✔' : 'ℹ'} {log.msg}
              </span>
              {log.data && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer hover:underline">Raw Details</summary>
                  <pre className="mt-2 text-red-900 whitespace-pre-wrap">{JSON.stringify(log.data, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
          {isLoading && <div className="animate-pulse">scanning...</div>}
        </div>

        <div className="mt-8 border-t border-green-900 pt-4 text-xs text-green-900">
          * If "Messages Found" is 0 while current conversation is buzzing, you have an RLS Policy block.
          <br/>
          * If "Project" is NOT zzopeqpsotvnhdjnxeap, you are connected to the wrong vault.
        </div>

        <button 
          onClick={() => window.location.href = '/'}
          className="mt-6 px-4 py-2 border border-green-500 hover:bg-green-500 hover:text-black transition-colors"
        >
          &lt; RETURN_TO_FIELD
        </button>
      </div>
    </div>
  )
}

import { useSystemStatus } from '@/lib/system-status-context'

// Deprecated Pause Logic - Saved for later remote integration

// 1. Context Destructuring
// const { loopPauses, refreshStatus } = useSystemStatus()

// 2. Fetch Handler
/*
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
*/

// 3. UI Button 
/*
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
*/

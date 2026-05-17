import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // 1. Verify Vercel Cron Authorization in production
  const authHeader = request.headers.get('authorization')
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // 2. Check Uptime Status of Inference Core
    const baseUrl = process.env.API_URL || 'https://brick-factorial-brain-vat-inference.hf.space'
    let isCurrentOnline = false

    try {
      const res = await fetch(`${baseUrl}/api/status`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        next: { revalidate: 0 },
      })
      isCurrentOnline = res.ok
    } catch (err) {
      isCurrentOnline = false
    }

    // 3. Query Last Known Status from Supabase status log
    const { data: lastLog, error: fetchError } = await supabase
      .from('system_status_log')
      .select('is_online')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('[Cron] Fetch status log error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Default to true if no logs exist yet (to prevent sending initial alert on empty log)
    const isLastOnline = lastLog ? lastLog.is_online : true

    // 4. State Transition Logic
    if (isCurrentOnline !== isLastOnline) {
      console.log(`[Cron] State transition detected: ${isLastOnline ? 'ONLINE' : 'OFFLINE'} -> ${isCurrentOnline ? 'ONLINE' : 'OFFLINE'}`)

      // Send Email Alert via Resend's standard HTTP API (zero external NPM dependencies)
      if (process.env.RESEND_API_KEY) {
        const recipient = process.env.ALERT_EMAIL || 'crk9967@nyu.edu'
        const subject = isCurrentOnline 
          ? '💚 RECOVERED: brain.vat inference core is ONLINE' 
          : '🚨 ALERT: brain.vat inference core is OFFLINE'
        
        const html = isCurrentOnline
          ? `
            <div style="font-family: monospace; background: #050505; color: #10ff50; padding: 20px; border: 1px dashed #10ff50; border-radius: 4px; max-width: 600px; margin: 0 auto;">
              <h2 style="margin-top: 0; text-transform: uppercase; letter-spacing: 0.1em; color: #10ff50;">[SYSTEM RECOVERY]</h2>
              <p style="color: #ccc; font-size: 14px; line-height: 1.6;">Attention Operator,</p>
              <p style="color: #fff; font-size: 15px; line-height: 1.6;">The <strong>brain.vat</strong> inference core has recovered and is now fully <strong>ONLINE</strong>.</p>
              <hr style="border: 0; border-top: 1px dashed rgba(16, 255, 80, 0.2); margin: 20px 0;" />
              <p style="font-size: 11px; color: #666; margin: 0;">Server URL: ${baseUrl}</p>
              <p style="font-size: 11px; color: #666; margin: 5px 0 0 0;">Timestamp: ${new Date().toUTCString()}</p>
            </div>
          `
          : `
            <div style="font-family: monospace; background: #050505; color: #ff003c; padding: 20px; border: 1px dashed #ff003c; border-radius: 4px; max-width: 600px; margin: 0 auto;">
              <h2 style="margin-top: 0; text-transform: uppercase; letter-spacing: 0.1em; color: #ff003c;">[ALERT: SYSTEM OFFLINE]</h2>
              <p style="color: #ccc; font-size: 14px; line-height: 1.6;">Attention Operator,</p>
              <p style="color: #fff; font-size: 15px; line-height: 1.6;">The <strong>brain.vat</strong> inference core has gone <strong>OFFLINE</strong>. Actions requiring core inference will fail.</p>
              <hr style="border: 0; border-top: 1px dashed rgba(255, 0, 60, 0.2); margin: 20px 0;" />
              <p style="font-size: 11px; color: #666; margin: 0;">Server URL: ${baseUrl}</p>
              <p style="font-size: 11px; color: #666; margin: 5px 0 0 0;">Timestamp: ${new Date().toUTCString()}</p>
            </div>
          `

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
            to: [recipient],
            subject,
            html,
          }),
        })

        if (!emailRes.ok) {
          const errText = await emailRes.text()
          console.error('[Cron] Failed to send email via Resend:', errText)
        }
      } else {
        console.warn('[Cron] State transition detected, but RESEND_API_KEY is not configured.')
      }

      // Record new state change in the database
      const { error: insertError } = await supabase
        .from('system_status_log')
        .insert({ is_online: isCurrentOnline })

      if (insertError) {
        console.error('[Cron] Failed to log state change:', insertError)
      }
    } else {
      console.log(`[Cron] System status unchanged (${isCurrentOnline ? 'ONLINE' : 'OFFLINE'}).`)
    }

    return NextResponse.json({ success: true, online: isCurrentOnline })
  } catch (err: any) {
    console.error('[Cron] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

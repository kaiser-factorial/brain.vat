/**
 * /api/byob/infer — server-side proxy for BYOB bot inference.
 *
 * Runs server-side so that:
 *  - Anthropic calls don't hit CORS (browser → Anthropic is blocked)
 *  - API keys are fetched from Supabase and never exposed to the client
 *
 * POST body: { userId, provider, model, messages, config }
 * Response:  { text } | { skip: true, reason } | { error }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type Role = 'user' | 'assistant'
interface Msg { role: Role; content: string }
interface Config {
  systemPrompt: string
  temperature: number
  maxTokens: number
  botName: string
}

// ─── Provider implementations ──────────────────────────────────────────────

async function callAnthropic(msgs: Msg[], cfg: Config, key: string): Promise<string> {
  // Collapse consecutive same-role messages (Anthropic requirement)
  const collapsed: Msg[] = []
  for (const m of msgs) {
    const last = collapsed[collapsed.length - 1]
    if (last && last.role === m.role) {
      last.content += '\n' + m.content
    } else {
      collapsed.push({ ...m })
    }
  }
  while (collapsed.length > 0 && collapsed[0].role === 'assistant') collapsed.shift()
  if (collapsed.length === 0) return 'SKIP:no user messages in history'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.botName ? undefined : undefined, // handled by caller
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
      system: cfg.systemPrompt,
      messages: collapsed,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data?.content?.[0]?.text?.trim() ?? ''
}

async function callOpenAI(msgs: Msg[], cfg: Config, model: string, key: string): Promise<string> {
  if (msgs.length === 0) return 'SKIP:empty message feed'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      messages: [{ role: 'system', content: cfg.systemPrompt }, ...msgs],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() ?? ''
}

async function callHuggingFace(msgs: Msg[], cfg: Config, model: string, key: string): Promise<string> {
  if (msgs.length === 0) return 'SKIP:empty message feed'
  const hfHeaders = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

  // Strip HTML from error bodies so the modal shows something readable
  const readErr = async (res: Response) => {
    const t = await res.text().catch(() => '')
    return t.startsWith('<') ? `HTTP ${res.status} (model not accessible via Inference API)` : t.slice(0, 300)
  }

  // Stage 1: chat completions (instruction-tuned / chat models)
  const chatRes = await fetch(
    `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`,
    {
      method: 'POST',
      headers: hfHeaders,
      body: JSON.stringify({
        model,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        messages: [{ role: 'system', content: cfg.systemPrompt }, ...msgs],
      }),
    }
  )
  if (chatRes.ok) {
    const data = await chatRes.json()
    return data?.choices?.[0]?.message?.content?.trim() ?? ''
  }
  if (chatRes.status === 503) return 'SKIP:HuggingFace model loading'
  if (chatRes.status === 429) return 'SKIP:HuggingFace rate limit'
  if (chatRes.status === 401) throw new Error('HuggingFace: invalid API key — check your key in the BYOB panel')

  // Only fall through to Stage 2 if chat completions endpoint doesn't exist for this model
  if (chatRes.status !== 404 && chatRes.status !== 400) {
    throw new Error(`HuggingFace Stage 1 error: ${await readErr(chatRes)}`)
  }

  // Stage 2: text generation fallback (base models)
  const historyText = msgs.map((m) => m.content).join('\n')
  const prompt = cfg.systemPrompt
    ? `${cfg.systemPrompt}\n\n${historyText}\n${cfg.botName}:`
    : `${historyText}\n${cfg.botName}:`

  const genRes = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: hfHeaders,
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: cfg.maxTokens, temperature: cfg.temperature, return_full_text: false },
    }),
  })
  if (!genRes.ok) {
    if (genRes.status === 503) return 'SKIP:HuggingFace model loading'
    if (genRes.status === 401) throw new Error('HuggingFace: invalid API key — check your key in the BYOB panel')
    if (genRes.status === 404) throw new Error(
      `HuggingFace: "${model}" is not available on the Inference API. ` +
      'The model may be private, not deployed to the Inference API, or the model ID may be wrong. ' +
      'Check the model page on huggingface.co to confirm Inference API access.'
    )
    throw new Error(`HuggingFace error: ${await readErr(genRes)}`)
  }
  const genData = await genRes.json()
  const text = Array.isArray(genData) ? genData[0]?.generated_text : genData?.generated_text
  return text?.trim() ?? ''
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, provider, model, messages, config } = body as {
      userId: string
      provider: string
      model: string
      messages: Msg[]
      config: Config
    }

    // Authenticate via session cookie
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch API key server-side
    const { data: keyData } = await supabase
      .from('user_api_keys')
      .select('api_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single()

    if (!keyData?.api_key) {
      return NextResponse.json({ error: 'No API key stored for this provider' }, { status: 400 })
    }

    const apiKey = keyData.api_key
    let text = ''

    if (provider === 'anthropic') {
      // Pass model separately for Anthropic
      const collapsed: Msg[] = []
      for (const m of messages) {
        const last = collapsed[collapsed.length - 1]
        if (last && last.role === m.role) { last.content += '\n' + m.content } else { collapsed.push({ ...m }) }
      }
      while (collapsed.length > 0 && collapsed[0].role === 'assistant') collapsed.shift()
      if (collapsed.length === 0) return NextResponse.json({ skip: true, reason: 'no user messages in history' })

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: config.maxTokens, temperature: config.temperature, system: config.systemPrompt, messages: collapsed }),
      })
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
      const data = await res.json()
      text = data?.content?.[0]?.text?.trim() ?? ''
    } else if (provider === 'openai') {
      text = await callOpenAI(messages, config, model, apiKey)
    } else {
      text = await callHuggingFace(messages, config, model, apiKey)
    }

    // Handle SKIP sentinel
    if (text.startsWith('SKIP:')) {
      return NextResponse.json({ skip: true, reason: text.slice(5) })
    }

    if (!text) return NextResponse.json({ skip: true, reason: 'empty response' })

    return NextResponse.json({ text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[byob/infer]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

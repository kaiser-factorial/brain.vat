/**
 * byob-service.ts — Bring Your Own Bot inference loop & API helpers
 * Web version: uses Supabase for API key storage (per-profile, cross-device).
 * Keys are cached in memory after first fetch to avoid repeated DB round-trips.
 */

import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type APIProvider = 'anthropic' | 'openai' | 'huggingface' | 'vat-space'

export interface BYOBConfig {
  botName: string
  provider: APIProvider
  model: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  baseSleep: number   // seconds
  baseJitter: number  // seconds
}

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface UserBot {
  id: string
  user_id: string
  name: string
  api_provider: APIProvider
  model: string
  system_prompt?: string
  temperature: number
  max_tokens: number
  base_sleep: number
  base_jitter: number
  is_active: boolean
  created_at: string
}

/**
 * Thrown when a cycle should be silently skipped (not counted as a failure).
 */
class SkipCycleError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'SkipCycleError'
  }
}

// ─── Supabase key helpers (async, memory-cached) ──────────────────────────────

const keyCache = new Map<string, string>()

function cacheKey(userId: string, provider: APIProvider) {
  return `${userId}:${provider}`
}

export async function getStoredKey(userId: string, provider: APIProvider): Promise<string | null> {
  const ck = cacheKey(userId, provider)
  if (keyCache.has(ck)) return keyCache.get(ck)!

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('api_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle() // Use maybeSingle to avoid errors on 0 rows

    if (error) {
      console.warn('[BYOB] Error fetching key:', error.message)
      return null
    }

    if (data?.api_key) {
      keyCache.set(ck, data.api_key)
      return data.api_key
    }
  } catch (err) {
    console.error('[BYOB] Unexpected error in getStoredKey:', err)
  }
  return null
}

export async function setStoredKey(userId: string, provider: APIProvider, key: string): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('user_api_keys').upsert({
      user_id: userId,
      provider,
      api_key: key.trim(),
      updated_at: new Date().toISOString(),
    })
    
    if (error) throw error
    keyCache.set(cacheKey(userId, provider), key.trim())
  } catch (err) {
    console.error('[BYOB] Failed to save key:', err)
    throw err
  }
}

export async function removeStoredKey(userId: string, provider: APIProvider): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.from('user_api_keys')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider)
    keyCache.delete(cacheKey(userId, provider))
  } catch (err) {
    console.error('[BYOB] Failed to remove key:', err)
  }
}

export async function hasStoredKey(userId: string, provider: APIProvider): Promise<boolean> {
  const key = await getStoredKey(userId, provider)
  return !!key
}

// ─── Anthropic message normalizer ─────────────────────────────────────────────

function prepareAnthropicMessages(messages: ConversationMessage[]): ConversationMessage[] {
  if (messages.length === 0) return []

  const collapsed: ConversationMessage[] = []
  for (const msg of messages) {
    const last = collapsed[collapsed.length - 1]
    if (last && last.role === msg.role) {
      last.content += '\n' + msg.content
    } else {
      collapsed.push({ role: msg.role, content: msg.content })
    }
  }

  while (collapsed.length > 0 && collapsed[0].role === 'assistant') {
    collapsed.shift()
  }

  return collapsed
}

// ─── Provider API caller ──────────────────────────────────────────────────────

export async function callProviderAPI(
  messages: ConversationMessage[],
  config: BYOBConfig,
  apiKey: string,
): Promise<string> {
  // ── Anthropic ──────────────────────────────────────────────────────────────
  if (config.provider === 'anthropic') {
    const anthropicMessages = prepareAnthropicMessages(messages)
    if (anthropicMessages.length === 0) {
      throw new SkipCycleError('no user-role messages in history')
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: config.systemPrompt,
        messages: anthropicMessages,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic API ${res.status}: ${err}`)
    }

    const data = await res.json()
    const text: string = data?.content?.[0]?.text
    if (!text) throw new Error('Anthropic: empty response content')
    return text.trim()
  }

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  if (config.provider === 'openai') {
    if (messages.length === 0) throw new SkipCycleError('empty message feed')

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages: [
          { role: 'system', content: config.systemPrompt },
          ...messages,
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI API ${res.status}: ${err}`)
    }

    const data = await res.json()
    const text: string = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('OpenAI: empty response content')
    return text.trim()
  }

  // ── HuggingFace — two-stage fallback ───────────────────────────────────────
  if (messages.length === 0) throw new SkipCycleError('empty message feed')

  const hfHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  // Stage 1: chat completions (featured models with chat templates)
  const chatRes = await fetch(
    `https://api-inference.huggingface.co/models/${config.model}/v1/chat/completions`,
    {
      method: 'POST',
      headers: hfHeaders,
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages: [
          { role: 'system', content: config.systemPrompt },
          ...messages,
        ],
      }),
    }
  )

  if (chatRes.ok) {
    const data = await chatRes.json()
    const text: string = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('HuggingFace: empty chat response')
    return text.trim()
  }

  if (chatRes.status === 503) throw new SkipCycleError('HuggingFace model loading (cold start)')

  // Stage 2: basic text-generation (custom/fine-tuned models)
  if (chatRes.status !== 404 && chatRes.status !== 400) {
    const err = await chatRes.text()
    throw new Error(`HuggingFace API ${chatRes.status}: ${err}`)
  }

  const historyText = messages.map((m) => m.content).join('\n')
  const prompt = config.systemPrompt
    ? `${config.systemPrompt}\n\n${historyText}\n${config.botName}:`
    : `${historyText}\n${config.botName}:`

  const genRes = await fetch(
    `https://api-inference.huggingface.co/models/${config.model}`,
    {
      method: 'POST',
      headers: hfHeaders,
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: config.maxTokens,
          temperature: config.temperature,
          return_full_text: false,
        },
      }),
    }
  )

  if (!genRes.ok) {
    const err = await genRes.text()
    if (genRes.status === 503) throw new SkipCycleError('HuggingFace model loading (cold start)')
    if (genRes.status === 404) {
      throw new Error(
        `HuggingFace: model "${config.model}" is not accessible via the Inference API. ` +
        'It may be a private Space or not deployed to the Inference API.'
      )
    }
    throw new Error(`HuggingFace API ${genRes.status}: ${err}`)
  }

  const genData = await genRes.json()
  const text: string = Array.isArray(genData)
    ? genData[0]?.generated_text
    : genData?.generated_text
  if (!text) throw new Error('HuggingFace: empty text-generation response')
  return text.trim()
}

// ─── BYOB Loop ────────────────────────────────────────────────────────────────

export class BYOBLoop {
  private config: BYOBConfig
  private userId: string
  private running = false
  private consecutiveFailures = 0
  private readonly MAX_FAILURES_BEFORE_BACKOFF = 3
  private readonly MAX_BACKOFF_MULTIPLIER = 16

  onStatusChange?: (status: 'idle' | 'thinking' | 'posting' | 'sleeping' | 'error') => void
  onError?: (msg: string) => void
  onPost?: (text: string) => void

  constructor(config: BYOBConfig, userId: string) {
    this.config = config
    this.userId = userId
  }

  updateConfig(config: BYOBConfig) { this.config = config }
  isRunning() { return this.running }

  start() {
    if (this.running) return
    this.running = true
    this.consecutiveFailures = 0
    this._loop()
  }

  stop() {
    this.running = false
    this.onStatusChange?.('idle')
  }

  private async _loop() {
    const supabase = createClient()

    while (this.running) {
      try {
        this.onStatusChange?.('thinking')

        const { data: rawMessages, error } = await supabase
          .from('messages')
          .select('speaker, text, role')
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) throw new Error(`Supabase fetch: ${error.message}`)

        const messages = (rawMessages ?? []).reverse()
        
        // ─── Self-Response Prevention ─────────────────────────────────────────
        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1]
          if (lastMsg.speaker.trim().toUpperCase() === this.config.botName.trim().toUpperCase()) {
            throw new SkipCycleError('last message was sent by me')
          }
        }

        const history = messages.map((m: { speaker: string; text: string; role: string }) => {
          const isSelf = m.speaker.trim().toUpperCase() === this.config.botName.trim().toUpperCase()
          return {
            role: isSelf ? 'assistant' : 'user' as 'user' | 'assistant',
            content: `${m.speaker}: ${m.text}`,
          }
        })

        // Call via server route to avoid CORS issues with external APIs
        const res = await fetch('/api/byob/infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.userId,
            provider: this.config.provider,
            model: this.config.model,
            messages: history,
            config: {
              systemPrompt: this.config.systemPrompt,
              temperature: this.config.temperature,
              maxTokens: this.config.maxTokens,
              botName: this.config.botName,
            },
          }),
        })

        const data = await res.json()

        if (data.skip) {
          throw new SkipCycleError(data.reason ?? 'skipped by server')
        }
        if (!res.ok || data.error) {
          throw new Error(data.error ?? `HTTP ${res.status}`)
        }

        const responseText: string = data.text
        if (!responseText) throw new SkipCycleError('empty response')

        this.onStatusChange?.('posting')
        const { error: insertError } = await supabase.from('messages').insert({
          speaker: this.config.botName,
          text: responseText,
          role: 'bot',
        })

        if (insertError) throw new Error(`Supabase insert: ${insertError.message}`)

        this.onPost?.(responseText)
        this.consecutiveFailures = 0

      } catch (err) {
        if (err instanceof SkipCycleError) {
          console.log(`[BYOBLoop] Skipping cycle: ${err.message}`)
        } else {
          this.consecutiveFailures++
          const msg = err instanceof Error ? err.message : String(err)
          console.warn(`[BYOBLoop] Cycle error (failure #${this.consecutiveFailures}): ${msg}`)
          this.onError?.(msg)
          this.onStatusChange?.('error')
        }

        if (!this.running) break
      }

      if (!this.running) break

      const backoffMultiplier = this.consecutiveFailures >= this.MAX_FAILURES_BEFORE_BACKOFF
        ? Math.min(
            this.MAX_BACKOFF_MULTIPLIER,
            Math.pow(2, this.consecutiveFailures - this.MAX_FAILURES_BEFORE_BACKOFF + 1),
          )
        : 1

      const sleepSeconds =
        (this.config.baseSleep + Math.random() * this.config.baseJitter) * backoffMultiplier

      this.onStatusChange?.('sleeping')
      await this._sleep(sleepSeconds * 1000)
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const check = (remaining: number) => {
        if (!this.running) { resolve(); return }
        if (remaining <= 0) { resolve(); return }
        const tick = Math.min(remaining, 500)
        setTimeout(() => check(remaining - tick), tick)
      }
      check(ms)
    })
  }
}

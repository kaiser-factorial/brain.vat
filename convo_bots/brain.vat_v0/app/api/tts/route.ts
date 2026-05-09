/**
 * /api/tts — Server-side Mistral TTS proxy
 *
 * Keeps the API key server-side and avoids CORS issues.
 * POST { text, speaker } → returns audio/mpeg blob
 */

const MISTRAL_TTS_URL = 'https://api.mistral.ai/v1/audio/speech'
const VOXTRAL_MODEL   = 'mistralai/Voxtral-4B-TTS-2603'

// Registered voice IDs (from register_voices.mjs)
const VOICE_IDS: Record<string, string> = {
  MAUK:  'baae5f35-6ffe-4c15-ad55-96bdd6542b11',
  ABACI: '03f9d324-0989-4a8f-ad03-a6068397e749',
}

export async function POST(req: Request) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    console.error('[TTS] MISTRAL_API_KEY is not set!')
    return new Response('MISTRAL_API_KEY not configured', { status: 500 })
  }

  let text: string, speaker: string
  try {
    ;({ text, speaker } = await req.json())
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const clean = text?.trim()
  if (!clean || clean.length < 2) {
    return new Response('Text too short', { status: 400 })
  }

  const voiceId = VOICE_IDS[speaker]
  if (!voiceId) {
    console.error(`[TTS] Unknown speaker: ${speaker}`)
    return new Response(`Unknown speaker: ${speaker}`, { status: 400 })
  }

  const requestBody = {
    model:           VOXTRAL_MODEL,
    input:           clean,
    voice:           voiceId,
    response_format: 'mp3',
  }

  console.log(`[TTS] → Mistral | speaker=${speaker} voice=${voiceId} text_len=${clean.length}`)
  console.log(`[TTS] → Request body:`, JSON.stringify(requestBody))

  try {
    const upstream = await fetch(MISTRAL_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const contentType = upstream.headers.get('content-type') ?? 'unknown'
    console.log(`[TTS] ← Mistral status=${upstream.status} content-type=${contentType}`)

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '<unreadable>')
      console.error(`[TTS] ← Mistral error ${upstream.status}:`, errText)
      // Return the raw Mistral error so the client can log it
      return new Response(
        JSON.stringify({ mistralStatus: upstream.status, mistralError: errText }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Stream the audio straight back to the browser
    return new Response(upstream.body, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err) {
    console.error('[TTS] Fetch error:', err)
    return new Response(
      JSON.stringify({ fetchError: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

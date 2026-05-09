/**
 * /api/tts — Server-side Mistral Voxtral TTS proxy
 *
 * Keeps the API key server-side and avoids CORS issues.
 * POST { text, speaker } → returns audio/mpeg binary
 *
 * Mistral API docs: https://docs.mistral.ai/api/endpoint/audio/speech
 * - Model:    voxtral-mini-tts-2603
 * - Param:    voice_id  (not "voice")
 * - Response: JSON { audio_data: "<base64 mp3>" }  (not a binary stream)
 */

const MISTRAL_TTS_URL = 'https://api.mistral.ai/v1/audio/speech'
const VOXTRAL_MODEL   = 'voxtral-mini-tts-2603'

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
    voice_id:        voiceId,
    response_format: 'mp3',
  }

  console.log(`[TTS] → Mistral | speaker=${speaker} voice_id=${voiceId} text_len=${clean.length}`)

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
      return new Response(
        JSON.stringify({ mistralStatus: upstream.status, mistralError: errText }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Mistral returns JSON: { audio_data: "<base64-encoded mp3>" }
    const json = await upstream.json() as { audio_data: string }

    if (!json.audio_data) {
      console.error('[TTS] Mistral response missing audio_data field:', JSON.stringify(json))
      return new Response('No audio_data in Mistral response', { status: 502 })
    }

    // Decode base64 → binary buffer → send as audio/mpeg
    // Using Buffer.from() — guaranteed to work in Next.js server runtime
    const audioBuffer = Buffer.from(json.audio_data, 'base64')

    console.log(`[TTS] ✅ Decoded ${audioBuffer.length} bytes of audio for ${speaker}`)

    return new Response(audioBuffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err) {
    console.error('[TTS] Fetch/decode error:', err)
    return new Response(
      JSON.stringify({ fetchError: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

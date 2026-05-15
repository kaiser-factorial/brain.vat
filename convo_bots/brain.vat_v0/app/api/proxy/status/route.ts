import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const baseUrl = process.env.API_URL || 'https://brick-factorial-brain-vat-inference.hf.space'
    const res = await fetch(`${baseUrl}/api/status`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Inference core offline' }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Proxy Status] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

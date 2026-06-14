export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { agent, apiKey } = await req.json()
  if (!apiKey) return Response.json({ error: 'API 키가 없습니다.' }, { status: 400 })

  if (agent === 'claude') {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })
    if (!res.ok) return Response.json({ error: 'API 키가 올바르지 않습니다.' }, { status: 400 })
    const data = await res.json()
    const models: string[] = (data.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id.startsWith('claude-'))
      .sort((a: string, b: string) => b.localeCompare(a))
    return Response.json({ models })
  }

  if (agent === 'openai') {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return Response.json({ error: 'API 키가 올바르지 않습니다.' }, { status: 400 })
    const data = await res.json()
    const models: string[] = (data.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3'))
      .sort((a: string, b: string) => b.localeCompare(a))
    return Response.json({ models })
  }

  return Response.json({ error: '알 수 없는 에이전트입니다.' }, { status: 400 })
}

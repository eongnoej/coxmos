import { spawnAgentLogin, type LocalAgentId } from '@/lib/localAgents'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { agent } = await request.json() as { agent?: LocalAgentId }
  if (agent !== 'openai' && agent !== 'claude') {
    return Response.json({ error: '지원하지 않는 에이전트입니다.' }, { status: 400 })
  }

  const child = spawnAgentLogin(agent)
  if (!child) return Response.json({ error: 'CLI가 설치되지 않았습니다.' }, { status: 404 })

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (chunk: Buffer) => controller.enqueue(encoder.encode(chunk.toString()))
      child.stdout.on('data', send)
      child.stderr.on('data', send)
      child.on('error', error => {
        controller.enqueue(encoder.encode(`\n${error.message}`))
        controller.close()
      })
      child.on('close', () => controller.close())
    },
    cancel() {
      child.kill()
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

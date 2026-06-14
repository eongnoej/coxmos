export const runtime = 'nodejs'

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { getLocalAgentStatus, spawnAgentChat } from '@/lib/localAgents'

export async function POST(request: Request) {
  const { agent, messages, apiKey, model, systemPrompt, connection = 'api' } = await request.json()

  if (connection === 'account') {
    const status = getLocalAgentStatus(agent)
    if (!status.installed || !status.loggedIn) {
      return Response.json({ error: `${agent === 'openai' ? 'ChatGPT' : 'Claude'} 계정 로그인이 필요합니다.` }, { status: 401 })
    }

    const transcript = messages
      .map((message: { role: string; content: string }) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
      .join('\n\n')
    const prompt = `${systemPrompt || 'You are a helpful assistant.'}\n\n아래 대화의 마지막 사용자 요청에 답하세요. 파일을 읽거나 수정하거나 명령을 실행하지 마세요.\n\n${transcript}`
    const child = spawnAgentChat(agent, prompt, model)
    if (!child) return Response.json({ error: '로컬 CLI를 실행할 수 없습니다.' }, { status: 500 })

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        child.stdout.on('data', chunk => controller.enqueue(encoder.encode(chunk.toString())))
        let stderr = ''
        child.stderr.on('data', chunk => { stderr += chunk.toString() })
        child.on('error', error => {
          controller.enqueue(encoder.encode(`오류: ${error.message}`))
          controller.close()
        })
        child.on('close', code => {
          if (code && stderr) controller.enqueue(encoder.encode(`오류: ${stderr.trim()}`))
          controller.close()
        })
      },
      cancel() {
        child.kill()
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  if (!apiKey) {
    return Response.json({ error: 'API 키가 없습니다.' }, { status: 400 })
  }

  if (agent === 'claude') {
    const client = new Anthropic({ apiKey })
    const stream = await client.messages.stream({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt || 'You are a helpful assistant.',
      messages,
    })
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(event.delta.text))
          }
        }
        controller.close()
      },
    })
    return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  if (agent === 'openai') {
    const client = new OpenAI({ apiKey })
    const stream = await client.chat.completions.create({
      model: model || 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt || 'You are a helpful assistant.' }, ...messages],
      stream: true,
    })
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) controller.enqueue(new TextEncoder().encode(text))
        }
        controller.close()
      },
    })
    return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  return Response.json({ error: '알 수 없는 에이전트입니다.' }, { status: 400 })
}

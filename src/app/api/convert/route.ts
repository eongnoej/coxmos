import Anthropic from '@anthropic-ai/sdk'
import { getLocalAgentStatus, spawnAgentChat } from '@/lib/localAgents'

export const runtime = 'nodejs'

const CONVERT_PROMPT = `당신은 노트를 AI가 잘 읽을 수 있는 구조화된 Markdown으로 변환하는 전문가입니다.

다음 규칙을 따라 변환하세요:
1. YAML frontmatter (title, date, tags) 포함
2. ## 목표, ## 결정 사항, ## 할일 목록, ## ⚠ 미해결 질문 섹션으로 구조화
3. 할일은 - [ ] 또는 - [x] 형식 사용
4. 원문에 없는 내용을 추가하거나 추측하지 말 것
5. 한국어 원문은 한국어 그대로 유지
6. 응답은 Markdown 코드 블록 없이 순수 Markdown만 출력

---
변환할 노트:`

export async function POST(request: Request) {
  try {
    const { title, content, apiKey, connection = 'api' } = await request.json()

    if (connection === 'account') {
      const status = getLocalAgentStatus('claude')
      if (!status.loggedIn) {
        return Response.json({ error: 'Claude 계정 로그인이 필요합니다.' }, { status: 401 })
      }
      const child = spawnAgentChat('claude', `${CONVERT_PROMPT}\n\n제목: ${title}\n\n${content}`)
      if (!child) return Response.json({ error: 'Claude CLI를 실행할 수 없습니다.' }, { status: 500 })
      const markdown = await new Promise<string>((resolve, reject) => {
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', chunk => { stdout += chunk.toString() })
        child.stderr.on('data', chunk => { stderr += chunk.toString() })
        child.on('error', reject)
        child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || 'Claude 실행 실패')))
      })
      return Response.json({ markdown })
    }

    if (!apiKey) {
      return Response.json({ error: 'API 키가 없습니다.' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: `${CONVERT_PROMPT}\n\n제목: ${title}\n\n${content}`,
        },
      ],
    })

    const markdown = response.content[0].type === 'text' ? response.content[0].text : ''

    return Response.json({ markdown })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json({ error: msg }, { status: 500 })
  }
}

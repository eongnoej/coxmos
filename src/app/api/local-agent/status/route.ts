import { getLocalAgentStatus, type LocalAgentId } from '@/lib/localAgents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({
    openai: getLocalAgentStatus('openai'),
    claude: getLocalAgentStatus('claude'),
  } satisfies Record<LocalAgentId, ReturnType<typeof getLocalAgentStatus>>)
}

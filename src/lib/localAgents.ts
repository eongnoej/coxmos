import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export type LocalAgentId = 'claude' | 'openai'

export interface LocalAgentStatus {
  installed: boolean
  loggedIn: boolean
  authMethod: string
  detail: string
}

const KNOWN_BINARIES: Record<LocalAgentId, string[]> = {
  openai: [
    process.env.CODEX_CLI_PATH || '',
    '/Users/jeongeon/.vscode/extensions/openai.chatgpt-26.609.30741-darwin-arm64/bin/macos-aarch64/codex',
  ],
  claude: [
    process.env.CLAUDE_CLI_PATH || '',
    '/Users/jeongeon/.vscode/extensions/anthropic.claude-code-2.1.177-darwin-arm64/resources/native-binary/claude',
    '/Users/jeongeon/.local/bin/claude',
  ],
}

export function findAgentBinary(agent: LocalAgentId): string | null {
  const known = KNOWN_BINARIES[agent].find(path => path && existsSync(path))
  if (known) return known
  const name = agent === 'openai' ? 'codex' : 'claude'
  const found = spawnSync('which', [name], { encoding: 'utf8' }).stdout.trim()
  if (found && existsSync(found)) return found
  return null
}

function run(binary: string, args: string[]) {
  return spawnSync(binary, args, {
    encoding: 'utf8',
    timeout: 10_000,
    env: process.env,
  })
}

export function getLocalAgentStatus(agent: LocalAgentId): LocalAgentStatus {
  const binary = findAgentBinary(agent)
  if (!binary) {
    return { installed: false, loggedIn: false, authMethod: 'none', detail: 'CLI가 설치되지 않았습니다.' }
  }

  if (agent === 'openai') {
    const result = run(binary, ['login', 'status'])
    const output = `${result.stdout}\n${result.stderr}`.trim()
    const loggedIn = result.status === 0 && /logged in/i.test(output)
    return {
      installed: true,
      loggedIn,
      authMethod: loggedIn ? (output.match(/using\s+(.+)/i)?.[1]?.trim() || 'ChatGPT') : 'none',
      detail: loggedIn ? 'Codex CLI 계정 세션을 사용할 수 있습니다.' : 'ChatGPT 로그인이 필요합니다.',
    }
  }

  const result = run(binary, ['auth', 'status', '--json'])
  try {
    const parsed = JSON.parse(result.stdout)
    return {
      installed: true,
      loggedIn: Boolean(parsed.loggedIn),
      authMethod: parsed.authMethod || 'none',
      detail: parsed.loggedIn ? 'Claude Code 계정 세션을 사용할 수 있습니다.' : 'Claude 로그인이 필요합니다.',
    }
  } catch {
    return { installed: true, loggedIn: false, authMethod: 'none', detail: 'Claude 로그인 상태를 확인하지 못했습니다.' }
  }
}

export function spawnAgentLogin(agent: LocalAgentId) {
  const binary = findAgentBinary(agent)
  if (!binary) return null
  const args = agent === 'openai' ? ['login', '--device-auth'] : ['auth', 'login']
  return spawn(binary, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
}

export function spawnAgentChat(agent: LocalAgentId, prompt: string, model = '') {
  const binary = findAgentBinary(agent)
  if (!binary) return null

  const args = agent === 'openai'
    ? [
        'exec',
        '--ephemeral',
        '--skip-git-repo-check',
        '--sandbox', 'read-only',
        '--color', 'never',
        '-C', '/private/tmp',
        ...(model ? ['--model', model] : []),
        prompt,
      ]
    : [
        '--print',
        '--output-format', 'text',
        '--no-session-persistence',
        '--tools', '',
        '--permission-mode', 'dontAsk',
        ...(model ? ['--model', model] : []),
        prompt,
      ]

  return spawn(binary, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
}

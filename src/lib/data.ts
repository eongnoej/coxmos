export const AGENTS = {
  claude: { id: 'claude' as const, name: 'Claude',   company: 'Anthropic', model: 'claude-sonnet-4-6', color: '#cc785c' },
  openai: { id: 'openai' as const, name: 'ChatGPT', company: 'OpenAI',    model: 'gpt-4o',            color: '#10a37f' },
}

export const SLASH_ITEMS = [
  { type: 'p',       icon: 'T',  label: '텍스트' },
  { type: 'h1',      icon: 'H1', label: '큰 제목' },
  { type: 'h2',      icon: 'H2', label: '중간 제목' },
  { type: 'h3',      icon: 'H3', label: '소제목' },
  { type: 'todo',    icon: '☑',  label: '할 일' },
  { type: 'quote',   icon: '"',  label: '인용' },
  { type: 'code',    icon: '{}', label: '코드' },
  { type: 'divider', icon: '—',  label: '구분선' },
]

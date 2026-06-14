import type { Note, ApiKeys, AgentId, ConvertedFile, ChatSession, Theme } from './types'

const KEYS = {
  notes:           'coxmos-notes',
  keys:            'coxmos-apikeys',
  agent:           'coxmos-agent',
  converted:       'coxmos-converted',
  chats:           'coxmos-chats',
  theme:           'coxmos-theme',
  selectedModel:   'coxmos-selected-model',
  availableModels: 'coxmos-available-models',
}

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

export const storage = {
  getNotes: (): Note[] =>
    safe(() => JSON.parse(localStorage.getItem(KEYS.notes) || '[]'), []),

  saveNotes: (notes: Note[]) =>
    localStorage.setItem(KEYS.notes, JSON.stringify(notes)),

  getApiKeys: (): ApiKeys =>
    safe(() => JSON.parse(localStorage.getItem(KEYS.keys) || '{"claude":"","openai":""}'), { claude: '', openai: '' }),

  saveApiKeys: (keys: ApiKeys) =>
    localStorage.setItem(KEYS.keys, JSON.stringify(keys)),

  getAgent: (): AgentId =>
    (localStorage.getItem(KEYS.agent) as AgentId) || 'claude',

  saveAgent: (agent: AgentId) =>
    localStorage.setItem(KEYS.agent, agent),

  getChats: (): ChatSession[] =>
    safe(() => JSON.parse(localStorage.getItem(KEYS.chats) || '[]'), []),

  saveChats: (chats: ChatSession[]) =>
    localStorage.setItem(KEYS.chats, JSON.stringify(chats.slice(0, 100))),

  getTheme: (): Theme =>
    (localStorage.getItem(KEYS.theme) as Theme) || 'dark',

  saveTheme: (theme: Theme) =>
    localStorage.setItem(KEYS.theme, theme),

  getSelectedModel: (): Record<AgentId, string> =>
    safe(() => JSON.parse(localStorage.getItem(KEYS.selectedModel) || '{"claude":"","openai":""}'), { claude: '', openai: '' }),

  saveSelectedModel: (models: Record<AgentId, string>) =>
    localStorage.setItem(KEYS.selectedModel, JSON.stringify(models)),

  getAvailableModels: (): Record<AgentId, string[]> =>
    safe(() => JSON.parse(localStorage.getItem(KEYS.availableModels) || '{"claude":[],"openai":[]}'), { claude: [], openai: [] }),

  saveAvailableModels: (models: Record<AgentId, string[]>) =>
    localStorage.setItem(KEYS.availableModels, JSON.stringify(models)),

  getConvertedFiles: (): ConvertedFile[] =>
    safe(() => JSON.parse(localStorage.getItem(KEYS.converted) || '[]'), []),

  saveConvertedFile: (file: ConvertedFile) => {
    const files = storage.getConvertedFiles()
    const idx = files.findIndex(f => f.noteId === file.noteId)
    if (idx >= 0) files[idx] = file
    else files.unshift(file)
    localStorage.setItem(KEYS.converted, JSON.stringify(files.slice(0, 20)))
  },
}

export function noteToMarkdown(note: Note): string {
  const lines: string[] = []
  for (const block of note.blocks) {
    switch (block.type) {
      case 'h1':      lines.push(`# ${block.content}`); break
      case 'h2':      lines.push(`## ${block.content}`); break
      case 'h3':      lines.push(`### ${block.content}`); break
      case 'p':       lines.push(block.content); break
      case 'quote':   lines.push(`> ${block.content}`); break
      case 'code':    lines.push('```\n' + block.content + '\n```'); break
      case 'todo':    lines.push(`- [${block.checked ? 'x' : ' '}] ${block.content}`); break
      case 'divider': lines.push('---'); break
    }
  }
  return lines.join('\n\n')
}

export function downloadMd(title: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim().replace(/\s+/g, '-')}.md`
  a.click()
  URL.revokeObjectURL(url)
}

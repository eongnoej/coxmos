export type BlockType = 'h1' | 'h2' | 'h3' | 'p' | 'todo' | 'quote' | 'code' | 'divider'

export interface Block {
  id: string
  type: BlockType
  content: string
  checked?: boolean
}

export interface Note {
  id: string
  title: string
  blocks: Block[]
  createdAt: number
  updatedAt: number
}

export type AgentId = 'claude' | 'openai'

export interface AgentConfig {
  id: AgentId
  name: string
  company: string
  model: string
  color: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  id: string
  title: string
  agent: AgentId
  model: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export type Theme = 'dark' | 'light'

export interface ApiKeys {
  claude: string
  openai: string
}

export interface LocalAgentStatus {
  installed: boolean
  loggedIn: boolean
  authMethod: string
  detail: string
}

export type LocalAgentStatuses = Record<AgentId, LocalAgentStatus>

export interface ConvertedFile {
  id: string
  noteId: string
  noteTitle: string
  markdown: string
  createdAt: number
}

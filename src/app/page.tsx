'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { storage, noteToMarkdown, downloadMd } from '@/lib/storage'
import type { Note, Block, BlockType, AgentId, ChatMessage, ChatSession, ApiKeys, ConvertedFile, LocalAgentStatuses, Theme, AgentTask } from '@/lib/types'
import { AGENTS, SLASH_ITEMS } from '@/lib/data'
import {
  IconExplorer, IconSearch, IconSettings, IconPlus,
  IconFile, IconConvert, IconDownload, IconDoc,
  IconCalendar, IconUser, IconClaude, IconOpenAI, IconSend,
} from '@/components/Icons'
import { BlockEl } from '@/components/BlockEditor'
import { SettingsModal, ConvertModal, AgentDropdown } from '@/components/Modals'

function uid() { return Math.random().toString(36).slice(2, 10) }

function getCursorInfo(el: HTMLElement) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return { atStart: false, atEnd: false }
  const range = sel.getRangeAt(0)
  if (!range.collapsed) return { atStart: false, atEnd: false }

  const preRange = range.cloneRange()
  preRange.selectNodeContents(el)
  preRange.setEnd(range.startContainer, range.startOffset)
  const before = preRange.toString().length

  const postRange = range.cloneRange()
  postRange.selectNodeContents(el)
  postRange.setStart(range.endContainer, range.endOffset)
  const after = postRange.toString().length

  return { atStart: before === 0, atEnd: after === 0 }
}

function focusBlockEnd(blockId: string) {
  const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"] .block-content`)
  if (!el) return
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function focusBlockStart(blockId: string) {
  const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"] .block-content`)
  if (!el) return
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

const MARKDOWN_TRIGGERS: Record<string, BlockType> = {
  '#': 'h1',
  '##': 'h2',
  '###': 'h3',
  '>': 'quote',
  '-': 'p',
  '*': 'p',
  '[]': 'todo',
  '[ ]': 'todo',
  '```': 'code',
}

export default function App() {
  const { data: session } = useSession()
  const [notes, setNotes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [agent, setAgent] = useState<AgentId>('claude')
  const [showAgentDrop, setShowAgentDrop] = useState(false)
  const [chats, setChats] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ claude: '', openai: '' })
  const [showSettings, setShowSettings] = useState(false)
  const [draftKeys, setDraftKeys] = useState<ApiKeys>({ claude: '', openai: '' })
  const [localStatuses, setLocalStatuses] = useState<LocalAgentStatuses | null>(null)
  const [loginAgent, setLoginAgent] = useState<AgentId | null>(null)
  const [loginOutput, setLoginOutput] = useState('')
  const [theme, setTheme] = useState<Theme>('dark')
  const [selectedModel, setSelectedModel] = useState<Record<AgentId, string>>({ claude: '', openai: '' })
  const [availableModels, setAvailableModels] = useState<Record<AgentId, string[]>>({ claude: [], openai: [] })
  const [fetchingModels, setFetchingModels] = useState<Record<AgentId, boolean>>({ claude: false, openai: false })
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks' | 'files'>('chat')
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [slashMenu, setSlashMenu] = useState({ open: false, x: 0, y: 0, blockId: '' })
  const [showConvert, setShowConvert] = useState(false)
  const [convertState, setConvertState] = useState<'loading' | 'done' | null>(null)
  const [convertMd, setConvertMd] = useState('')
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([])
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const activeNoteRef = useRef<Note | null>(null)

  useEffect(() => {
    const saved = storage.getNotes()
    if (saved.length) {
      setNotes(saved)
      setActiveId(saved[0].id)
    }
    const savedKeys = storage.getApiKeys()
    setApiKeys(savedKeys)
    setAgent(storage.getAgent())
    setConvertedFiles(storage.getConvertedFiles())
    const savedTheme = storage.getTheme()
    setTheme(savedTheme)
    document.documentElement.dataset.theme = savedTheme
    setSelectedModel(storage.getSelectedModel())
    setAvailableModels(storage.getAvailableModels())
    setTasks(storage.getTasks())
    const savedChats = storage.getChats()
    if (savedChats.length) {
      setChats(savedChats)
      setActiveChatId(savedChats[0].id)
      setAgent(savedChats[0].agent)
    } else {
      const chat: ChatSession = {
        id: uid(), title: '새 대화', agent: 'claude', model: '',
        messages: [], createdAt: Date.now(), updatedAt: Date.now(),
      }
      setChats([chat])
      setActiveChatId(chat.id)
    }
    refreshLocalStatuses()
  }, [])

  useEffect(() => { if (notes.length) storage.saveNotes(notes) }, [notes])
  useEffect(() => { if (chats.length) storage.saveChats(chats) }, [chats])

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
  }, [chats, activeChatId])

  useEffect(() => {
    if (!showAgentDrop) return
    const h = () => setShowAgentDrop(false)
    setTimeout(() => document.addEventListener('click', h), 10)
    return () => document.removeEventListener('click', h)
  }, [showAgentDrop])

  const showToast = useCallback((msg: string, color = 'var(--green)') => {
    setToast({ msg, color })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const activeNote = notes.find(n => n.id === activeId) ?? null
  activeNoteRef.current = activeNote
  const activeChat = chats.find(chat => chat.id === activeChatId) ?? null
  const messages = activeChat?.messages ?? []
  const accountConnected = Boolean(localStatuses?.[agent]?.loggedIn)
  const agentAvailable = accountConnected || Boolean(apiKeys[agent])
  const currentModel = selectedModel[agent]
  const modelList = availableModels[agent] ?? []

  async function fetchModelsForAgent(agentId: AgentId, key: string) {
    if (!key) return
    setFetchingModels(prev => ({ ...prev, [agentId]: true }))
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentId, apiKey: key }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.models?.length) {
        const next = { ...availableModels, [agentId]: data.models }
        setAvailableModels(next)
        storage.saveAvailableModels(next)
        // Auto-select best model
        const bestModel = data.models[0]
        if (!selectedModel[agentId]) {
          const nextSel = { ...selectedModel, [agentId]: bestModel }
          setSelectedModel(nextSel)
          storage.saveSelectedModel(nextSel)
        }
      }
    } catch { /* ignore */ } finally {
      setFetchingModels(prev => ({ ...prev, [agentId]: false }))
    }
  }

  function updateMessages(updater: ChatMessage[] | ((current: ChatMessage[]) => ChatMessage[])) {
    setChats(current => current.map(chat => {
      if (chat.id !== activeChatId) return chat
      const next = typeof updater === 'function' ? updater(chat.messages) : updater
      const firstUser = next.find(message => message.role === 'user')?.content.trim()
      return {
        ...chat,
        messages: next,
        title: chat.title === '새 대화' && firstUser ? firstUser.slice(0, 32) : chat.title,
        updatedAt: Date.now(),
      }
    }))
  }

  function newChat() {
    const chat: ChatSession = {
      id: uid(), title: '새 대화', agent, model: currentModel,
      messages: [], createdAt: Date.now(), updatedAt: Date.now(),
    }
    setChats(current => [chat, ...current])
    setActiveChatId(chat.id)
    setShowChatHistory(false)
  }

  function openChat(chat: ChatSession) {
    setActiveChatId(chat.id)
    setAgent(chat.agent)
    setShowChatHistory(false)
  }

  function changeModel(value: string) {
    const next = { ...selectedModel, [agent]: value }
    setSelectedModel(next)
    storage.saveSelectedModel(next)
    setChats(current => current.map(chat =>
      chat.id === activeChatId ? { ...chat, model: value, updatedAt: Date.now() } : chat
    ))
  }

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    storage.saveTheme(next)
    document.documentElement.dataset.theme = next
  }

  async function refreshLocalStatuses() {
    try {
      const res = await fetch('/api/local-agent/status', { cache: 'no-store' })
      if (res.ok) setLocalStatuses(await res.json())
    } catch {
      setLocalStatuses(null)
    }
  }

  async function loginLocalAgent(id: AgentId) {
    setLoginAgent(id)
    setLoginOutput('')
    try {
      const res = await fetch('/api/local-agent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '로그인을 시작하지 못했습니다.')
      }
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          setLoginOutput(output => output + decoder.decode(value, { stream: true }))
        }
      }
      await refreshLocalStatuses()
      showToast(`${id === 'openai' ? 'ChatGPT' : 'Claude'} 계정 상태를 갱신했습니다.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.'
      setLoginOutput(message)
      showToast(message, 'var(--red)')
    } finally {
      setLoginAgent(null)
    }
  }

  function updateNote(partial: Partial<Note>) {
    setNotes(ns => ns.map(n => n.id === activeId ? { ...n, ...partial, updatedAt: Date.now() } : n))
  }

  function newNote() {
    const note: Note = { id: uid(), title: '', blocks: [{ id: uid(), type: 'p', content: '' }], createdAt: Date.now(), updatedAt: Date.now() }
    setNotes(ns => [note, ...ns])
    setActiveId(note.id)
  }

  function deleteNote(id: string) {
    const updated = notes.filter(n => n.id !== id)
    setNotes(updated)
    if (activeId === id) setActiveId(updated[0]?.id ?? null)
  }

  function updateBlock(blockId: string, content: string) {
    const note = activeNoteRef.current
    if (!note) return
    setNotes(ns => ns.map(n => n.id === note.id
      ? { ...n, blocks: n.blocks.map(b => b.id === blockId ? { ...b, content } : b), updatedAt: Date.now() }
      : n
    ))
  }

  function toggleTodo(blockId: string) {
    if (!activeNote) return
    updateNote({ blocks: activeNote.blocks.map(b => b.id === blockId ? { ...b, checked: !b.checked } : b) })
  }

  function addBlockAfter(afterId: string | null, type: BlockType = 'p') {
    const note = activeNoteRef.current
    if (!note) return
    const nb: Block = { id: uid(), type, content: '' }
    const blocks = [...note.blocks]
    const idx = afterId ? blocks.findIndex(b => b.id === afterId) : blocks.length - 1
    blocks.splice(idx + 1, 0, nb)
    setNotes(ns => ns.map(n => n.id === note.id ? { ...n, blocks, updatedAt: Date.now() } : n))
    setTimeout(() => focusBlockStart(nb.id), 30)
  }

  function deleteBlock(blockId: string) {
    const note = activeNoteRef.current
    if (!note || note.blocks.length <= 1) return
    const idx = note.blocks.findIndex(b => b.id === blockId)
    const prevId = note.blocks[Math.max(0, idx - 1)]?.id
    setNotes(ns => ns.map(n => n.id === note.id
      ? { ...n, blocks: n.blocks.filter(b => b.id !== blockId), updatedAt: Date.now() }
      : n
    ))
    setTimeout(() => { if (prevId) focusBlockEnd(prevId) }, 10)
  }

  function changeBlockType(blockId: string, type: BlockType, clearContent = false) {
    const note = activeNoteRef.current
    if (!note) return
    setNotes(ns => ns.map(n => n.id === note.id
      ? { ...n, blocks: n.blocks.map(b => b.id === blockId ? { ...b, type, ...(clearContent ? { content: '' } : {}) } : b), updatedAt: Date.now() }
      : n
    ))
    setSlashMenu(s => ({ ...s, open: false }))
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"] .block-content`)
      if (el) { if (clearContent) el.textContent = ''; el.focus() }
    }, 30)
  }

  function handleBlockKeyDown(e: React.KeyboardEvent<HTMLElement>, block: Block) {
    const el = e.currentTarget as HTMLElement
    const text = el.textContent || ''
    const { atStart, atEnd } = getCursorInfo(el)
    const isMac = navigator.platform.startsWith('Mac')
    const mod = isMac ? e.metaKey : e.ctrlKey

    // Cmd/Ctrl+Enter → toggle todo
    if (mod && e.key === 'Enter' && block.type === 'todo') {
      e.preventDefault()
      toggleTodo(block.id)
      return
    }

    // Enter → new block
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addBlockAfter(block.id)
      return
    }

    // Backspace on empty block → delete
    if (e.key === 'Backspace' && !text.trim()) {
      e.preventDefault()
      deleteBlock(block.id)
      return
    }

    // Markdown triggers on Space
    if (e.key === ' ') {
      const trimmed = text.trimEnd()
      const triggerType = MARKDOWN_TRIGGERS[trimmed]
      if (triggerType) {
        e.preventDefault()
        if (triggerType === 'p' && block.type === 'p') return // no-op for '-' in text block
        changeBlockType(block.id, triggerType, true)
        return
      }
      // '---' → divider
      if (trimmed === '--') {
        e.preventDefault()
        changeBlockType(block.id, 'divider', true)
        setTimeout(() => addBlockAfter(block.id), 50)
        return
      }
    }

    // Arrow Up → previous block
    if (e.key === 'ArrowUp' && atStart) {
      const note = activeNoteRef.current
      if (!note) return
      const idx = note.blocks.findIndex(b => b.id === block.id)
      if (idx > 0) {
        e.preventDefault()
        focusBlockEnd(note.blocks[idx - 1].id)
      }
      return
    }

    // Arrow Down → next block
    if (e.key === 'ArrowDown' && atEnd) {
      const note = activeNoteRef.current
      if (!note) return
      const idx = note.blocks.findIndex(b => b.id === block.id)
      if (idx < note.blocks.length - 1) {
        e.preventDefault()
        focusBlockStart(note.blocks[idx + 1].id)
      }
      return
    }

    // Slash menu
    if (e.key === '/') {
      if (text.trim()) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      setSlashMenu({
        open: true,
        x: Math.min(rect.left, window.innerWidth - 218),
        y: Math.min(rect.bottom + 4, window.innerHeight - 328),
        blockId: block.id,
      })
      return
    }

    if (e.key === 'Escape') { setSlashMenu(s => ({ ...s, open: false })); return }
    if (slashMenu.open && e.key !== 'Escape') setSlashMenu(s => ({ ...s, open: false }))
  }

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || isStreaming) return
    const key = apiKeys[agent]
    if (!accountConnected && !key) {
      showToast('계정 로그인 또는 API 키 설정이 필요합니다.', 'var(--yellow)')
      setShowSettings(true)
      return
    }
    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMsgs = [...messages, userMsg]
    updateMessages([...newMsgs, { role: 'assistant', content: '' }])
    setChatInput('')
    setIsStreaming(true)

    // Record task
    const taskId = uid()
    const newTask: AgentTask = {
      id: taskId, agentId: agent, prompt: text, result: '',
      status: 'running', noteTitle: activeNoteRef.current?.title || '',
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    setTasks(prev => {
      const next = [newTask, ...prev]
      storage.saveTasks(next)
      return next
    })

    try {
      const note = activeNoteRef.current
      const noteCtx = note ? `현재 노트 (${note.title}):\n\n${noteToMarkdown(note)}\n\n---\n\n` : ''
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent, apiKey: key, model: currentModel || undefined,
          connection: accountConnected ? 'account' : 'api',
          systemPrompt: '당신은 코스모스(Coxmos)의 AI 어시스턴트입니다. 사용자의 노트를 바탕으로 도와드리세요. 한국어로 답변하세요.',
          messages: [...(noteCtx ? [{ role: 'user', content: noteCtx }] : []), ...newMsgs],
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value, { stream: true })
        updateMessages(prev => {
          const n = [...prev]
          n[n.length - 1] = { role: 'assistant', content: full }
          return n
        })
      }
      // Update task as done
      setTasks(prev => {
        const next = prev.map(t => t.id === taskId
          ? { ...t, status: 'done' as const, result: full.slice(0, 300), updatedAt: Date.now() }
          : t
        )
        storage.saveTasks(next)
        return next
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.'
      updateMessages(prev => {
        const n = [...prev]
        n[n.length - 1] = { role: 'assistant', content: `오류: ${msg}` }
        return n
      })
      setTasks(prev => {
        const next = prev.map(t => t.id === taskId
          ? { ...t, status: 'error' as const, result: msg, updatedAt: Date.now() }
          : t
        )
        storage.saveTasks(next)
        return next
      })
    } finally { setIsStreaming(false) }
  }

  async function startConvert() {
    if (!activeNote) return
    const claudeConnected = Boolean(localStatuses?.claude.loggedIn)
    if (!claudeConnected && !apiKeys.claude) {
      showToast('Claude 계정 로그인 또는 API 키 설정이 필요합니다.', 'var(--yellow)')
      setShowSettings(true)
      return
    }
    setShowConvert(true); setConvertState('loading'); setConvertMd('')
    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeNote.title,
          content: noteToMarkdown(activeNote),
          apiKey: apiKeys.claude,
          connection: claudeConnected ? 'account' : 'api',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setConvertMd(data.markdown); setConvertState('done')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '변환 실패', 'var(--red)')
      setShowConvert(false); setConvertState(null)
    }
  }

  function saveConvertedFile() {
    if (!activeNote || !convertMd) return
    const file: ConvertedFile = { id: uid(), noteId: activeNote.id, noteTitle: activeNote.title, markdown: convertMd, createdAt: Date.now() }
    storage.saveConvertedFile(file)
    setConvertedFiles(storage.getConvertedFiles())
    downloadMd(activeNote.title, convertMd)
    setShowConvert(false); setConvertState(null)
    showToast('MD 파일로 저장되었습니다.')
    setActiveTab('files')
  }

  async function openSettings() {
    setDraftKeys({ ...apiKeys })
    setShowSettings(true)
    refreshLocalStatuses()
  }

  async function saveSettings() {
    setApiKeys(draftKeys)
    storage.saveApiKeys(draftKeys)
    setShowSettings(false)
    showToast('저장되었습니다. 사용 가능한 모델을 불러오는 중...')
    // Fetch models for both agents after saving keys
    if (draftKeys.claude) fetchModelsForAgent('claude', draftKeys.claude)
    if (draftKeys.openai) fetchModelsForAgent('openai', draftKeys.openai)
  }

  function selectAgent(id: AgentId) {
    setAgent(id)
    storage.saveAgent(id)
    setShowAgentDrop(false)
    setChats(current => current.map(chat =>
      chat.id === activeChatId ? { ...chat, agent: id, model: selectedModel[id], updatedAt: Date.now() } : chat
    ))
  }

  const filtered = notes.filter(n => n.title.toLowerCase().includes(sidebarSearch.toLowerCase()))
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const AgentIco = agent === 'claude' ? IconClaude : IconOpenAI
  const userName = session?.user?.name ?? '나'
  const userImage = session?.user?.image

  return (
    <>
      <div id="app">
        <div className="workbench">

          {/* Activity Bar */}
          <nav className="activity-bar">
            <div className="act-top">
              <button className="act-btn active" title="탐색기"><IconExplorer /></button>
              <button className="act-btn" title="검색"><IconSearch /></button>
            </div>
            <div className="act-bottom">
              <button className="act-btn" title={theme === 'dark' ? '라이트 모드' : '다크 모드'} onClick={toggleTheme}>
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
              <button className="act-btn" title="설정" onClick={openSettings}><IconSettings /></button>
            </div>
          </nav>

          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-header">탐색기</div>
            <div className="search-box">
              <IconSearch />
              <input placeholder="노트 검색..." value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)} />
            </div>
            <div className="tree">
              <div className="tree-section-label">COXMOS</div>
              {filtered.length === 0 && (
                <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--fg3)' }}>
                  {notes.length === 0 ? '새 노트를 만들어보세요' : '검색 결과 없음'}
                </div>
              )}
              {filtered.map(note => (
                <div key={note.id} className={`tree-item i1 ${note.id === activeId ? 'active' : ''}`} onClick={() => setActiveId(note.id)}>
                  <span className="chevron" />
                  <span className="t-icon"><IconFile /></span>
                  <span className="t-label">{note.title || '제목 없음'}</span>
                  <span className="tree-actions">
                    <button className="tree-act-btn" onClick={e => { e.stopPropagation(); deleteNote(note.id) }}>×</button>
                  </span>
                </div>
              ))}
              <div className="sidebar-divider" style={{ margin: '6px 0' }} />
              <div className="tree-section-label">변환된 파일</div>
              {convertedFiles.length === 0
                ? <div style={{ padding: '4px 12px', fontSize: '12px', color: 'var(--fg3)' }}>아직 없음</div>
                : convertedFiles.slice(0, 5).map(f => (
                  <div key={f.id} className="tree-item i1" onClick={() => { downloadMd(f.noteTitle, f.markdown); showToast('다운로드됨') }}>
                    <span className="chevron" />
                    <span className="t-icon" style={{ color: 'var(--green)' }}><IconFile /></span>
                    <span className="t-label" style={{ color: 'var(--green)', fontSize: '12px' }}>{f.noteTitle}.md</span>
                  </div>
                ))
              }
            </div>
            <div className="sidebar-footer">
              <button className="new-note-btn" onClick={newNote}><IconPlus /> 새 노트</button>
              {session?.user && (
                <div className="user-row" onClick={() => signOut({ callbackUrl: '/login' })} title="로그아웃">
                  {userImage
                    ? <img src={userImage} alt={userName} className="user-avatar" />
                    : <div className="user-avatar-fallback">{userName[0]}</div>
                  }
                  <span className="user-name">{userName}</span>
                  <span className="user-logout-hint">로그아웃</span>
                </div>
              )}
            </div>
          </aside>

          {/* Editor */}
          <div className="editor-group">
            <div className="editor-tabs">
              {activeNote ? (
                <div className="tab active">
                  <IconFile />
                  <span>{activeNote.title || '제목 없음'}</span>
                  <button className="tab-close" onClick={() => setActiveId(null)}>×</button>
                </div>
              ) : (
                <div className="tab-empty">노트를 선택하거나 새로 만드세요</div>
              )}
            </div>
            {activeNote && (
              <div className="breadcrumb">
                <span>coxmos</span>
                <span className="sep">›</span>
                <span style={{ color: 'var(--fg2)' }}>{activeNote.title || '제목 없음'}</span>
              </div>
            )}

            {activeNote ? (
              <div className="editor-body">
                <div className="page-inner">
                  <div className="page-actions">
                    <button className="page-action-btn primary" onClick={startConvert}>
                      <IconConvert /> AI가 정리하기
                    </button>
                    <button className="page-action-btn" onClick={() => { downloadMd(activeNote.title, noteToMarkdown(activeNote)); showToast('다운로드됨') }}>
                      <IconDownload /> 내보내기
                    </button>
                  </div>

                  <textarea
                    className="page-title-input"
                    rows={1}
                    placeholder="제목 없음"
                    value={activeNote.title}
                    onChange={e => {
                      const el = e.target; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'
                      updateNote({ title: e.target.value })
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBlockAfter(null) } }}
                  />

                  <div className="page-meta">
                    <div className="page-meta-item"><IconCalendar /><span>{today}</span></div>
                    <div className="page-meta-item">
                      {userImage
                        ? <img src={userImage} alt={userName} style={{ width: 14, height: 14, borderRadius: '50%' }} />
                        : <IconUser />
                      }
                      <span>{userName}</span>
                    </div>
                  </div>

                  <div className="blocks">
                    {activeNote.blocks.map(block => (
                      <BlockEl
                        key={block.id}
                        block={block}
                        onChange={c => updateBlock(block.id, c)}
                        onToggle={() => toggleTodo(block.id)}
                        onKeyDown={e => handleBlockKeyDown(e, block)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="editor-empty">
                <div className="editor-empty-icon">
                  <IconFile />
                </div>
                <div className="editor-empty-title">노트를 선택하거나 새로 만드세요</div>
                <div className="editor-empty-hint">
                  왼쪽 사이드바에서 노트를 선택하거나<br />아래 버튼으로 새 노트를 만들어보세요
                </div>
                <button className="page-action-btn primary" onClick={newNote} style={{ marginTop: 16 }}>
                  <IconPlus /> 새 노트 만들기
                </button>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <aside className="right-panel">
            <div className="panel-tabs">
              {(['chat', 'tasks', 'files'] as const).map(t => (
                <div key={t} className={`p-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                  {t === 'chat' ? 'CHAT' : t === 'tasks' ? 'TASKS' : 'FILES'}
                  {t === 'tasks' && tasks.filter(tk => tk.status === 'running').length > 0 && (
                    <span className="tasks-badge">{tasks.filter(tk => tk.status === 'running').length}</span>
                  )}
                </div>
              ))}
            </div>

            {/* CHAT */}
            {activeTab === 'chat' && (
              <div className="panel-pane active">
                <div className="agent-selector-bar">
                  <div style={{ position: 'relative' }}>
                    <button className="agent-selector-btn" onClick={e => { e.stopPropagation(); setShowAgentDrop(d => !d) }}>
                      <div className={`agent-icon agent-${agent}-icon`}><AgentIco /></div>
                      <span className="agent-name">{AGENTS[agent].name}</span>
                      <span className="agent-model">{currentModel || '모델 선택'}</span>
                      <span className="agent-chevron">▾</span>
                    </button>
                    {showAgentDrop && <AgentDropdown current={agent} onSelect={selectAgent} />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <select
                      className="model-select"
                      aria-label="모델 선택"
                      value={currentModel}
                      onChange={e => changeModel(e.target.value)}
                      disabled={fetchingModels[agent]}
                    >
                      {fetchingModels[agent]
                        ? <option>불러오는 중...</option>
                        : modelList.length === 0
                          ? <option value="">모델 미설정 (API 키 입력 필요)</option>
                          : modelList.map(m => <option key={m} value={m}>{m}</option>)
                      }
                    </select>
                  </div>
                  <div className="chat-tools">
                    <button className="chat-tool-btn" onClick={() => setShowChatHistory(value => !value)}>목록</button>
                    <button className="chat-tool-btn" onClick={newChat}>새 대화</button>
                  </div>
                </div>

                {showChatHistory ? (
                  <div className="chat-history">
                    <div className="chat-history-head">
                      <span className="chat-history-title">전체 대화</span>
                      <button className="chat-tool-btn" onClick={newChat}>새 대화</button>
                    </div>
                    {chats.map(chat => (
                      <div key={chat.id} className={`chat-history-item ${chat.id === activeChatId ? 'active' : ''}`} onClick={() => openChat(chat)}>
                        <div className="chat-history-name">{chat.title}</div>
                        <div className="chat-history-meta">
                          {AGENTS[chat.agent].name} · {chat.model || '자동'} · {new Date(chat.updatedAt).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {activeNote && (
                      <div className="chat-ctx">
                        <IconDoc />
                        {activeNote.title || '제목 없음'} — 컨텍스트 연결됨
                      </div>
                    )}
                    <div className="chat-body" ref={chatBodyRef}>
                      {messages.length === 0 && (
                        <div className="chat-msg ai">
                          <div className="chat-bubble">
                            안녕하세요! <strong>{AGENTS[agent].name}</strong>입니다.
                            {activeNote ? ` "${activeNote.title || '이 노트'}"를 읽고 있어요.` : ''}
                            {' '}무엇을 도와드릴까요?
                          </div>
                        </div>
                      )}
                      {messages.map((msg, i) => (
                        <div key={i} className={`chat-msg ${msg.role === 'user' ? 'user' : 'ai'}`}>
                          <div className="chat-bubble">
                            {msg.content || (isStreaming && i === messages.length - 1
                              ? <><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></>
                              : null
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="chat-footer">
                      {!agentAvailable && (
                        <button className="chat-tool-btn" onClick={openSettings}>
                          계정 연결 또는 API 키 설정
                        </button>
                      )}
                      <div className="chat-input-row">
                        <textarea
                          className="chat-textarea"
                          placeholder={agentAvailable ? '메시지 입력... (Shift+Enter 줄바꿈)' : '먼저 API 키를 설정해주세요'}
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                          rows={1}
                        />
                        <button className="chat-send" onClick={sendChat} disabled={isStreaming || !chatInput.trim()}>
                          <IconSend />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TASKS */}
            {activeTab === 'tasks' && (
              <div className="panel-pane active">
                <div className="tasks-header">
                  <span className="tasks-header-label">에이전트 태스크</span>
                  {tasks.length > 0 && <span className="tasks-count-badge">{tasks.length}</span>}
                </div>
                {tasks.length === 0 ? (
                  <div style={{ padding: '20px 14px', fontSize: '12.5px', color: 'var(--fg3)', lineHeight: 1.7 }}>
                    아직 AI에게 시킨 작업이 없어요.<br />
                    CHAT 탭에서 메시지를 보내면<br />여기에 기록됩니다.
                  </div>
                ) : (
                  <div className="tasks-body">
                    {tasks.map(task => (
                      <div key={task.id} className={`task-row ${task.status}`}>
                        <div className={`task-dot ${task.status}`} />
                        <div className="task-main">
                          <div className="task-name">{task.prompt.slice(0, 60)}{task.prompt.length > 60 ? '...' : ''}</div>
                          <div className="task-meta">
                            {AGENTS[task.agentId].name}
                            {task.noteTitle ? ` · ${task.noteTitle}` : ''}
                            {' · '}{new Date(task.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {task.status === 'done' && task.result && (
                            <div className="task-result">{task.result}</div>
                          )}
                          {task.status === 'error' && (
                            <div className="task-result error">{task.result}</div>
                          )}
                        </div>
                        <span className="task-pct" style={{
                          color: task.status === 'done' ? 'var(--green)' : task.status === 'error' ? 'var(--red)' : 'var(--yellow)'
                        }}>
                          {task.status === 'done' ? '완료' : task.status === 'error' ? '오류' : '실행중'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FILES */}
            {activeTab === 'files' && (
              <div className="panel-pane active">
                <div className="files-header">변환된 파일</div>
                <div className="files-body">
                  {convertedFiles.length === 0 ? (
                    <div style={{ padding: '16px 12px', fontSize: '12.5px', color: 'var(--fg3)', lineHeight: 1.6 }}>
                      아직 변환된 파일이 없어요.<br />
                      노트에서 &quot;AI가 정리하기&quot; 버튼을 눌러보세요.
                    </div>
                  ) : (
                    convertedFiles.map((f, i) => (
                      <div key={f.id} className={`file-row ${i === 0 ? 'new' : ''}`} onClick={() => { downloadMd(f.noteTitle, f.markdown); showToast('다운로드됨') }}>
                        <IconFile />
                        <span className="file-name">{f.noteTitle}.md</span>
                        {i === 0 && <span className="file-tag new">최신</span>}
                      </div>
                    ))
                  )}
                </div>
                {activeNote && (
                  <button className="files-export-btn" onClick={() => { downloadMd(activeNote.title, noteToMarkdown(activeNote)); showToast('내보내기 완료') }}>
                    현재 노트 MD 내보내기
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>

        {/* Status Bar */}
        <div className="statusbar">
          <div className="sb-item">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 3h3.5l1 1H10v6H1V3z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity=".3"/></svg>
            coxmos
          </div>
          <div className="sb-item">
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: agentAvailable ? 'var(--green)' : 'var(--fg3)' }} />
            {accountConnected ? `${AGENTS[agent].name} 계정 연결됨` : apiKeys[agent] ? `${AGENTS[agent].name} API 연결됨` : `${AGENTS[agent].name} 연결 필요`}
          </div>
          <div className="sb-right">
            <div className="sb-item">{activeNote?.blocks.length ?? 0}개 블록</div>
            <div className="sb-item">Markdown</div>
            <div className="sb-item" onClick={openSettings} style={{ cursor: 'pointer' }}>
              {agentAvailable ? '● 연결됨' : '○ 연결 필요'}
            </div>
          </div>
        </div>
      </div>

      {/* Slash Menu */}
      {slashMenu.open && (
        <div className="slash-menu" style={{ left: slashMenu.x, top: slashMenu.y }}>
          <div className="slash-header">블록 유형</div>
          {SLASH_ITEMS.map(item => (
            <div key={item.type} className="slash-item" onClick={() => changeBlockType(slashMenu.blockId, item.type as BlockType, true)}>
              <span className="slash-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* Convert Modal */}
      {showConvert && convertState && (
        <ConvertModal
          state={convertState}
          markdown={convertMd}
          noteTitle={activeNote?.title ?? ''}
          onClose={() => { setShowConvert(false); setConvertState(null) }}
          onSave={saveConvertedFile}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          draft={draftKeys}
          onChange={setDraftKeys}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
          statuses={localStatuses}
          loginAgent={loginAgent}
          loginOutput={loginOutput}
          onLogin={loginLocalAgent}
          onRefresh={refreshLocalStatuses}
          fetchingModels={fetchingModels}
          availableModels={availableModels}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="toast show">
          <div className="toast-dot" style={{ background: toast.color }} />
          {toast.msg}
        </div>
      )}
    </>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { storage, noteToMarkdown, downloadMd } from '@/lib/storage'
import type { Note, Block, BlockType, AgentId, ChatMessage, ChatSession, ApiKeys, ConvertedFile, LocalAgentStatuses, Theme } from '@/lib/types'
import { AGENTS, SLASH_ITEMS, DEMO_TASKS, DEMO_BLOCKS } from '@/lib/data'
import {
  IconExplorer, IconSearch, IconSettings, IconPlus,
  IconFile, IconConvert, IconDownload, IconDoc,
  IconCalendar, IconUser, IconClaude, IconOpenAI, IconSend,
} from '@/components/Icons'
import { BlockEl } from '@/components/BlockEditor'
import { SettingsModal, ConvertModal, AgentDropdown } from '@/components/Modals'

function uid() { return Math.random().toString(36).slice(2, 10) }

const MODEL_OPTIONS: Record<AgentId, { value: string; label: string }[]> = {
  claude: [
    { value: '', label: '자동' },
    { value: 'sonnet', label: 'Sonnet' },
    { value: 'opus', label: 'Opus' },
    { value: 'haiku', label: 'Haiku' },
    { value: 'custom', label: '직접 입력' },
  ],
  openai: [
    { value: '', label: '자동' },
    { value: 'custom', label: '직접 입력' },
  ],
}

export default function App() {
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
  const [models, setModels] = useState<Record<AgentId, string>>({ claude: '', openai: '' })
  const [customModels, setCustomModels] = useState<Record<AgentId, string>>({ claude: '', openai: '' })
  const [localFolder, setLocalFolder] = useState<{ name: string; entries: { name: string; kind: string }[] } | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks' | 'files'>('chat')
  const [slashMenu, setSlashMenu] = useState({ open: false, x: 0, y: 0, blockId: '' })
  const [showConvert, setShowConvert] = useState(false)
  const [convertState, setConvertState] = useState<'loading' | 'done' | null>(null)
  const [convertMd, setConvertMd] = useState('')
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([])
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const saved = storage.getNotes()
    if (saved.length) {
      setNotes(saved)
      setActiveId(saved[0].id)
    } else {
      const note: Note = { id: uid(), title: '팀 회의 메모', blocks: DEMO_BLOCKS, createdAt: Date.now(), updatedAt: Date.now() }
      setNotes([note])
      setActiveId(note.id)
    }
    setApiKeys(storage.getApiKeys())
    setAgent(storage.getAgent())
    setConvertedFiles(storage.getConvertedFiles())
    const savedTheme = storage.getTheme()
    setTheme(savedTheme)
    document.documentElement.dataset.theme = savedTheme
    const savedModels = storage.getModels()
    setModels(savedModels)
    setCustomModels(storage.getCustomModels())
    const savedChats = storage.getChats()
    if (savedChats.length) {
      setChats(savedChats)
      setActiveChatId(savedChats[0].id)
      setAgent(savedChats[0].agent)
    } else {
      const chat: ChatSession = {
        id: uid(), title: '새 대화', agent: 'claude', model: savedModels.claude,
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
  const activeChat = chats.find(chat => chat.id === activeChatId) ?? null
  const messages = activeChat?.messages ?? []
  const accountConnected = Boolean(localStatuses?.[agent]?.loggedIn)
  const agentAvailable = accountConnected || Boolean(apiKeys[agent])
  const selectedModel = models[agent] === 'custom' ? customModels[agent].trim() : models[agent]

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
      id: uid(), title: '새 대화', agent, model: selectedModel,
      messages: [], createdAt: Date.now(), updatedAt: Date.now(),
    }
    setChats(current => [chat, ...current])
    setActiveChatId(chat.id)
    setShowChatHistory(false)
  }

  function openChat(chat: ChatSession) {
    setActiveChatId(chat.id)
    setAgent(chat.agent)
    setModels(current => ({ ...current, [chat.agent]: chat.model }))
    setShowChatHistory(false)
  }

  function changeModel(value: string) {
    const next = { ...models, [agent]: value }
    setModels(next)
    storage.saveModels(next)
    setChats(current => current.map(chat => chat.id === activeChatId ? { ...chat, model: value, updatedAt: Date.now() } : chat))
  }

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    storage.saveTheme(next)
    document.documentElement.dataset.theme = next
  }

  async function openLocalFolder() {
    const picker = (window as typeof window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle & {
        entries: () => AsyncIterableIterator<[string, FileSystemHandle]>
      }>
    }).showDirectoryPicker
    if (!picker) {
      showToast('이 브라우저는 로컬 폴더 열기를 지원하지 않습니다.', 'var(--yellow)')
      return
    }
    try {
      const directory = await picker()
      const entries: { name: string; kind: string }[] = []
      for await (const [name, handle] of directory.entries()) {
        entries.push({ name, kind: handle.kind })
        if (entries.length >= 100) break
      }
      entries.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1)
      setLocalFolder({ name: directory.name, entries })
      setActiveTab('files')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      showToast('폴더를 열지 못했습니다.', 'var(--red)')
    }
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
    if (!activeNote) return
    updateNote({ blocks: activeNote.blocks.map(b => b.id === blockId ? { ...b, content } : b) })
  }

  function toggleTodo(blockId: string) {
    if (!activeNote) return
    updateNote({ blocks: activeNote.blocks.map(b => b.id === blockId ? { ...b, checked: !b.checked } : b) })
  }

  function addBlockAfter(afterId: string | null, type: BlockType = 'p') {
    if (!activeNote) return
    const nb: Block = { id: uid(), type, content: '' }
    const blocks = [...activeNote.blocks]
    const idx = afterId ? blocks.findIndex(b => b.id === afterId) : blocks.length - 1
    blocks.splice(idx + 1, 0, nb)
    updateNote({ blocks })
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${nb.id}"] .block-content`)
      el?.focus()
    }, 30)
  }

  function deleteBlock(blockId: string) {
    if (!activeNote || activeNote.blocks.length <= 1) return
    const idx = activeNote.blocks.findIndex(b => b.id === blockId)
    const blocks = activeNote.blocks.filter(b => b.id !== blockId)
    updateNote({ blocks })
    setTimeout(() => {
      const prevId = activeNote.blocks[Math.max(0, idx - 1)]?.id
      if (prevId) document.querySelector<HTMLElement>(`[data-block-id="${prevId}"] .block-content`)?.focus()
    }, 10)
  }

  function changeBlockType(blockId: string, type: BlockType) {
    if (!activeNote) return
    updateNote({ blocks: activeNote.blocks.map(b => b.id === blockId ? { ...b, type } : b) })
    setSlashMenu(s => ({ ...s, open: false }))
    setTimeout(() => document.querySelector<HTMLElement>(`[data-block-id="${blockId}"] .block-content`)?.focus(), 30)
  }

  function handleBlockKeyDown(e: React.KeyboardEvent<HTMLElement>, block: Block) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addBlockAfter(block.id)
    }
    if (e.key === 'Backspace') {
      const t = e.currentTarget as HTMLElement
      if (!t.textContent?.trim()) { e.preventDefault(); deleteBlock(block.id) }
    }
    if (e.key === '/') {
      const target = e.currentTarget as HTMLElement
      if (target.textContent?.trim()) return
      e.preventDefault()
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const menuWidth = 210
      const menuHeight = 320
      setSlashMenu({
        open: true,
        x: Math.min(rect.left, window.innerWidth - menuWidth - 8),
        y: Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8),
        blockId: block.id,
      })
    } else if (e.key !== 'Escape') {
      if (slashMenu.open) setSlashMenu(s => ({ ...s, open: false }))
    }
    if (e.key === 'Escape') setSlashMenu(s => ({ ...s, open: false }))
  }

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || isStreaming) return
    const key = apiKeys[agent]
    if (!accountConnected && !key) { showToast('계정 로그인 또는 API 키 설정이 필요합니다.', 'var(--yellow)'); setShowSettings(true); return }
    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMsgs = [...messages, userMsg]
    updateMessages([...newMsgs, { role: 'assistant', content: '' }])
    setChatInput('')
    setIsStreaming(true)
    try {
      const noteCtx = activeNote ? `현재 노트 (${activeNote.title}):\n\n${noteToMarkdown(activeNote)}\n\n---\n\n` : ''
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent, apiKey: key, model: selectedModel || undefined,
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
        updateMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: full }; return n })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.'
      updateMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: `오류: ${msg}` }; return n })
    } finally { setIsStreaming(false) }
  }

  async function startConvert() {
    if (!activeNote) return
    const claudeAccountConnected = Boolean(localStatuses?.claude.loggedIn)
    if (!claudeAccountConnected && !apiKeys.claude) { showToast('Claude 계정 로그인 또는 API 키 설정이 필요합니다.', 'var(--yellow)'); setShowSettings(true); return }
    setShowConvert(true); setConvertState('loading'); setConvertMd('')
    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeNote.title,
          content: noteToMarkdown(activeNote),
          apiKey: apiKeys.claude,
          connection: claudeAccountConnected ? 'account' : 'api',
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

  function openSettings() { setDraftKeys({ ...apiKeys }); setShowSettings(true); refreshLocalStatuses() }
  function saveSettings() { setApiKeys(draftKeys); storage.saveApiKeys(draftKeys); setShowSettings(false); showToast('설정이 저장되었습니다.') }

  function selectAgent(id: AgentId) {
    setAgent(id)
    storage.saveAgent(id)
    setShowAgentDrop(false)
    setChats(current => current.map(chat => chat.id === activeChatId ? { ...chat, agent: id, model: models[id], updatedAt: Date.now() } : chat))
  }

  const filtered = notes.filter(n => n.title.includes(sidebarSearch))
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const AgentIco = agent === 'claude' ? IconClaude : IconOpenAI

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
                <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--fg3)' }}>노트가 없습니다</div>
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
            </div>
          </aside>

          {/* Editor */}
          <div className="editor-group">
            <div className="editor-tabs">
              {activeNote && (
                <div className="tab active">
                  <IconFile />
                  <span>{activeNote.title || '제목 없음'}</span>
                  <button className="tab-close" onClick={newNote}>×</button>
                </div>
              )}
            </div>
            <div className="breadcrumb">
              <span>coxmos</span>
              <span className="sep">›</span>
              <span style={{ color: 'var(--fg2)' }}>{activeNote?.title || '제목 없음'}</span>
            </div>

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
                    <div className="page-meta-item"><IconUser /><span>나</span></div>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--fg3)', fontSize: '14px' }}>
                왼쪽에서 노트를 선택하거나 새로 만드세요
              </div>
            )}
          </div>

          {/* Right Panel */}
          <aside className="right-panel">
            <div className="panel-tabs">
              {(['chat', 'tasks', 'files'] as const).map(t => (
                <div key={t} className={`p-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                  {t === 'chat' ? 'CHAT' : t === 'tasks' ? 'TASKS' : 'FILES'}
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
                      <span className="agent-model">{selectedModel || '자동'}</span>
                      <span className="agent-chevron">▾</span>
                    </button>
                    {showAgentDrop && <AgentDropdown current={agent} onSelect={selectAgent} />}
                  </div>
                  <select className="model-select" aria-label="모델 선택" value={models[agent]} onChange={e => changeModel(e.target.value)}>
                    {MODEL_OPTIONS[agent].map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <div className="chat-tools">
                    <button className="chat-tool-btn" onClick={() => setShowChatHistory(value => !value)}>목록</button>
                    <button className="chat-tool-btn" onClick={newChat}>새 대화</button>
                  </div>
                </div>

                {models[agent] === 'custom' && (
                  <div style={{ padding: '0 10px 7px' }}>
                    <input
                      className="model-custom"
                      aria-label="사용자 지정 모델 ID"
                      placeholder="모델 ID"
                      value={customModels[agent]}
                      onChange={e => {
                        const next = { ...customModels, [agent]: e.target.value }
                        setCustomModels(next)
                        storage.saveCustomModels(next)
                      }}
                    />
                  </div>
                )}

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
                        {activeNote.title} — 컨텍스트 연결됨
                      </div>
                    )}
                    <div className="chat-body" ref={chatBodyRef}>
                      {messages.length === 0 && (
                        <div className="chat-msg ai">
                          <div className="chat-bubble">
                            안녕하세요! <strong>{AGENTS[agent].name}</strong>입니다.
                            {activeNote ? ` "${activeNote.title}"를 읽고 있어요.` : ''}
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
                      {!agentAvailable && <button className="chat-tool-btn" onClick={openSettings}>계정 연결 또는 API 키 설정</button>}
                      <div className="chat-input-row">
                        <textarea
                          className="chat-textarea"
                          placeholder={agentAvailable ? '메시지 입력... (Shift+Enter 줄바꿈)' : '계정 로그인 또는 API 키 설정이 필요합니다'}
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
                  <span className="tasks-count-badge">4</span>
                </div>
                <div className="tasks-body">
                  {DEMO_TASKS.map(task => (
                    <div key={task.id}>
                      <div className={`task-row ${task.status}`} onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}>
                        <div className={`task-dot ${task.status}`} />
                        <span className="task-name">{task.name}</span>
                        <span className="task-pct" style={{ color: task.status === 'done' ? 'var(--green)' : task.status === 'waiting' ? 'var(--yellow)' : undefined }}>
                          {task.status === 'done' ? '완료' : task.status === 'waiting' ? '대기' : task.pct + '%'}
                        </span>
                        <button className="task-btn">{task.status === 'running' ? '중지' : task.status === 'done' ? '보기' : '시작'}</button>
                      </div>
                      <div className={`task-expand ${expandedTask === task.id ? 'open' : ''}`}>
                        {task.status === 'running' && (
                          <div className="task-progress"><div className="task-progress-fill" style={{ width: task.pct + '%' }} /></div>
                        )}
                        {task.status === 'done'
                          ? <div className="task-result">{task.result}</div>
                          : <div className="task-expand-desc">{task.desc}</div>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FILES */}
            {activeTab === 'files' && (
              <div className="panel-pane active">
                <div className="files-header">로컬 폴더와 변환 파일</div>
                <button className="folder-open-btn" onClick={openLocalFolder}>로컬 폴더 열기...</button>
                {localFolder && (
                  <>
                    <div className="folder-name">{localFolder.name}</div>
                    <div style={{ maxHeight: 150, overflowY: 'auto', borderBottom: '1px solid var(--border)' }}>
                      {localFolder.entries.map(entry => (
                        <div className="folder-entry" key={`${entry.kind}-${entry.name}`}>
                          <span>{entry.kind === 'directory' ? '▸' : '·'}</span>
                          <span>{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
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
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
            {accountConnected ? `${AGENTS[agent].name} 계정 연결됨` : apiKeys[agent] ? `${AGENTS[agent].name} API 연결됨` : `${AGENTS[agent].name} 연결 필요`}
          </div>
          <div className="sb-right">
            <div className="sb-item">{activeNote?.blocks.length ?? 0}개 블록</div>
            <div className="sb-item">Markdown</div>
            <div className="sb-item" onClick={openSettings} style={{ cursor: 'pointer' }}>
              {accountConnected ? '● 구독 계정 연결됨' : apiKeys[agent] ? '● API 연결됨' : '○ 연결 필요'}
            </div>
          </div>
        </div>
      </div>

      {/* Slash Menu */}
      {slashMenu.open && (
        <div className="slash-menu" style={{ left: slashMenu.x, top: slashMenu.y }}>
          <div className="slash-header">블록 유형</div>
          {SLASH_ITEMS.map(item => (
            <div key={item.type} className="slash-item" onClick={() => changeBlockType(slashMenu.blockId, item.type as BlockType)}>
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

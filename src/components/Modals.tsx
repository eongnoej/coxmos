'use client'

import type { ApiKeys, AgentId, LocalAgentStatuses } from '@/lib/types'
import { IconSettings, IconClaude, IconOpenAI, IconConvert } from './Icons'

// ── Settings Modal ────────────────────────────────────────────────
interface SettingsProps {
  draft: ApiKeys
  onChange: (k: ApiKeys) => void
  onSave: () => void
  onClose: () => void
  statuses: LocalAgentStatuses | null
  loginAgent: AgentId | null
  loginOutput: string
  onLogin: (agent: AgentId) => void
  onRefresh: () => void
}

export function SettingsModal({ draft, onChange, onSave, onClose, statuses, loginAgent, loginOutput, onLogin, onRefresh }: SettingsProps) {
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal settings-modal">
        <div className="modal-head">
          <IconSettings />
          <span className="modal-title">설정</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-section">
          <div className="settings-label">구독 계정 연결 (로컬 CLI)</div>
          {(['openai', 'claude'] as AgentId[]).map(id => {
            const status = statuses?.[id]
            const name = id === 'openai' ? 'ChatGPT / Codex' : 'Claude'
            return (
              <div className="account-row" key={id}>
                <div>
                  <div className="account-name">{name}</div>
                  <div className={`account-status ${status?.loggedIn ? 'connected' : ''}`}>
                    {status?.loggedIn ? `연결됨 · ${status.authMethod}` : status?.detail || '확인 중...'}
                  </div>
                </div>
                <button
                  className="modal-btn cancel"
                  disabled={loginAgent !== null || status?.loggedIn}
                  onClick={() => onLogin(id)}
                >
                  {loginAgent === id ? '로그인 중...' : status?.loggedIn ? '연결됨' : '계정 로그인'}
                </button>
              </div>
            )
          })}
          <button className="account-refresh" onClick={onRefresh}>로그인 상태 새로고침</button>
          {loginOutput && <pre className="login-output">{loginOutput}</pre>}
          <div className="settings-hint">
            Coxmos는 로그인 토큰을 읽거나 저장하지 않습니다. 설치된 Codex/Claude CLI의 공식 계정 세션을 사용합니다.
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-label">API 키 (계정 연결 불가 시 fallback)</div>

          <div className="settings-row">
            <div className="agent-label">
              <div className="agent-icon agent-claude-icon"><IconClaude /></div>
              Claude
            </div>
            <input
              type="password"
              className="key-input"
              placeholder="sk-ant-..."
              value={draft.claude}
              onChange={e => onChange({ ...draft, claude: e.target.value })}
            />
          </div>

          <div className="settings-row">
            <div className="agent-label">
              <div className="agent-icon agent-openai-icon"><IconOpenAI /></div>
              ChatGPT
            </div>
            <input
              type="password"
              className="key-input"
              placeholder="sk-..."
              value={draft.openai}
              onChange={e => onChange({ ...draft, openai: e.target.value })}
            />
          </div>

          <div className="settings-hint">
            키는 브라우저에만 저장되며 외부로 전송되지 않습니다.<br />
            Claude:{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
            &nbsp;/&nbsp;ChatGPT:{' '}
            <a href="https://platform.openai.com" target="_blank" rel="noreferrer">
              platform.openai.com
            </a>
          </div>
        </div>

        <div className="modal-foot">
          <button className="modal-btn cancel" onClick={onClose}>취소</button>
          <button className="modal-btn primary" onClick={onSave}>저장</button>
        </div>
      </div>
    </div>
  )
}

// ── Convert Modal ─────────────────────────────────────────────────
interface ConvertProps {
  state: 'loading' | 'done'
  markdown: string
  noteTitle: string
  onClose: () => void
  onSave: () => void
}

export function ConvertModal({ state, markdown, noteTitle, onClose, onSave }: ConvertProps) {
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal convert-modal">
        <div className="modal-head">
          <IconConvert />
          <span className="modal-title">AI가 정리하기</span>
          <span className="modal-subtitle">— 구조화된 Markdown으로 변환</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {state === 'loading' && (
          <div className="modal-loading">
            <div className="spinner" />
            <div style={{ color: 'var(--fg2)', fontSize: '13px' }}>Claude가 노트를 분석하고 있어요...</div>
            <div style={{ color: 'var(--fg3)', fontSize: '11.5px', marginTop: 5 }}>
              목표·결정·할일·미해결 항목 추출 중
            </div>
          </div>
        )}

        {state === 'done' && (
          <>
            <div className="modal-stats">
              <span className="modal-badge">변환 완료</span>
              <span>구조화된 Markdown이 생성되었습니다</span>
            </div>
            <div className="modal-preview">
              <pre>{markdown}</pre>
            </div>
            <div className="modal-foot">
              <div className="modal-path"><span>{noteTitle}.md</span></div>
              <button className="modal-btn cancel" onClick={onClose}>취소</button>
              <button className="modal-btn primary" onClick={onSave}>다운로드 및 저장</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Agent Dropdown ────────────────────────────────────────────────
import { AGENTS } from '@/lib/data'
import { IconClaude as IC, IconOpenAI as IO } from './Icons'

interface AgentDropProps {
  current: AgentId
  onSelect: (id: AgentId) => void
}

export function AgentDropdown({ current, onSelect }: AgentDropProps) {
  return (
    <div className="agent-dropdown open" onClick={e => e.stopPropagation()}>
      {(Object.values(AGENTS) as (typeof AGENTS)[AgentId][]).map(ag => {
        const Ico = ag.id === 'claude' ? IC : IO
        return (
          <div
            key={ag.id}
            className={`agent-option ${current === ag.id ? 'selected' : ''}`}
            onClick={() => onSelect(ag.id as AgentId)}
          >
            <div className={`agent-icon agent-${ag.id}-icon`}><Ico /></div>
            <div className="agent-option-info">
              <div className="agent-option-name">{ag.name}</div>
              <div className="agent-option-sub">{ag.company} · {ag.model}</div>
            </div>
            {current === ag.id && <span className="agent-option-check">✓</span>}
          </div>
        )
      })}
    </div>
  )
}

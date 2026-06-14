import type { Block } from './types'

function uid() { return Math.random().toString(36).slice(2, 10) }

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

export const DEMO_TASKS = [
  { id: 't1', name: '경쟁사 분석 에이전트',  status: 'running', pct: 72, desc: 'Notion AI, Obsidian, Mem.ai 기능 비교 중', result: '' },
  { id: 't2', name: 'MD 변환 에이전트',      status: 'running', pct: 38, desc: '현재 노트를 구조화된 Markdown으로 변환 중', result: '' },
  { id: 't3', name: '일정 정리 에이전트',    status: 'done',    pct: 100, desc: '', result: '다음주 일정 5건 정리, 캘린더 반영됨' },
  { id: 't4', name: '랜딩 페이지 초안',      status: 'waiting', pct: 0, desc: 'MD 변환 완료 후 자동으로 실행됩니다', result: '' },
]

export const DEMO_BLOCKS: Block[] = [
  { id: uid(), type: 'p',     content: 'DuAI 런치톤 해커톤 준비에 대해 논의했다. 코스모스(Coxmos) 제품을 핵심으로 4일 내 POC 완성을 목표로 한다.' },
  { id: uid(), type: 'h1',    content: '결정 사항' },
  { id: uid(), type: 'todo',  content: '제품명 코스모스(Coxmos) 최종 확정', checked: true },
  { id: uid(), type: 'todo',  content: 'React + Next.js + Claude API 기술 스택 확정', checked: true },
  { id: uid(), type: 'todo',  content: '디자인 시스템 선정', checked: false },
  { id: uid(), type: 'todo',  content: '데모 시나리오 1개 완성', checked: false },
  { id: uid(), type: 'h1',    content: 'AI에게 시킬 일' },
  { id: uid(), type: 'quote', content: '경쟁사 분석: Notion AI, Obsidian, Mem.ai를 비교하고 코스모스만의 차별점을 정리해줘.' },
  { id: uid(), type: 'p',     content: '랜딩 페이지 텍스트 초안도 작성해줘. 비개발자도 쉽게 이해할 수 있게.' },
  { id: uid(), type: 'h1',    content: '미해결 질문' },
  { id: uid(), type: 'p',     content: '로컬 저장 vs 클라우드 저장 방식 최종 결정 필요' },
]

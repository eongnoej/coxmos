'use client'

import { useRef, useEffect } from 'react'
import type { Block, BlockType } from '@/lib/types'

export function blockPlaceholder(type: BlockType): string {
  const m: Record<BlockType, string> = {
    h1: '큰 제목', h2: '중간 제목', h3: '소제목',
    p: "AI 기능은 '스페이스 키', 명령어는 '/'를 입력하세요.",
    todo: '할 일', quote: '인용문', code: '코드', divider: '',
  }
  return m[type]
}

interface Props {
  block: Block
  onChange: (content: string) => void
  onToggle: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void
}

export function BlockEl({ block, onChange, onToggle, onKeyDown }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.textContent !== block.content) {
      el.textContent = block.content
    }
  })

  if (block.type === 'divider') {
    return (
      <div className="block" data-block-id={block.id}>
        <hr className="block-divider" />
      </div>
    )
  }

  if (block.type === 'todo') {
    return (
      <div className="block" data-block-id={block.id}>
        <div className="block-handle"><button className="block-handle-btn">⠿</button></div>
        <div className="block-todo-wrap">
          <div className={`todo-check ${block.checked ? 'checked' : ''}`} onClick={onToggle} />
          <div
            ref={ref}
            contentEditable suppressContentEditableWarning
            className={`todo-text ${block.checked ? 'done' : ''} block-content`}
            data-placeholder={blockPlaceholder('todo')}
            onInput={e => onChange((e.currentTarget as HTMLDivElement).textContent || '')}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="block" data-block-id={block.id}>
      <div className="block-handle"><button className="block-handle-btn">⠿</button></div>
      <div
        ref={ref}
        contentEditable suppressContentEditableWarning
        className="block-content"
        data-block-type={block.type}
        data-placeholder={blockPlaceholder(block.type)}
        onInput={e => onChange((e.currentTarget as HTMLDivElement).textContent || '')}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}

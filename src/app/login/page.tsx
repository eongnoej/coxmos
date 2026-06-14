'use client'

import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      flexDirection: 'column',
      gap: '32px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Coxmos
        </div>
        <div style={{ fontSize: '14px', color: 'var(--fg3)' }}>
          기록하면 AI가 움직인다
        </div>
      </div>

      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '32px',
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fg1)', textAlign: 'center' }}>
          로그인
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--fg3)', textAlign: 'center', lineHeight: 1.6 }}>
          Google 계정으로 로그인하여<br />노트와 AI 대화를 안전하게 저장하세요
        </div>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '10px 16px',
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--fg1)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg3)')}
        >
          <GoogleIcon />
          Google로 계속하기
        </button>
      </div>

      <div style={{ fontSize: '11.5px', color: 'var(--fg3)', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6 }}>
        로그인하면 노트는 브라우저에 저장됩니다.<br />
        AI 기능은 별도로 API 키가 필요합니다.
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

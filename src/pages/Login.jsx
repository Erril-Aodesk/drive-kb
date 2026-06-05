import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [msg, setMsg] = useState(null)
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    setBusy(true); setMsg(null); setSuccess(false)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
        setSuccess(true)
        setMsg('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img
          src="/logo.png"
          alt="Drive Personnel"
          className="auth-logo"
          onError={(e) => { e.target.style.display = 'none' }}
        />
        <h1>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h1>
        <p className="muted">Drive Personnel · Knowledge Base</p>

        {mode === 'signup' && (
          <input placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} />
        )}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input
          type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button className="primary" style={{ width: '100%' }} onClick={handleSubmit} disabled={busy}>
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>

        {msg && <p className={success ? 'auth-success' : 'auth-msg'} style={{ marginTop: 12 }}>{msg}</p>}

        <p className="switch">
          {mode === 'signin' ? "Don't have an account?" : 'Already have one?'}{' '}
          <button className="link" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null) }}>
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
/**
 * LoginPage 3.0 — Polished Sicredi branding, theme-aware
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../contexts/ThemeContext'

export default function LoginPage() {
  const { login, user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch {
      setError('Credenciais inválidas. Verifique usuário e senha.')
    } finally {
      setLoading(false)
    }
  }

  if (user) {
    if (user.role === 'associate') navigate('/associate/dashboard')
    else if (user.role === 'admin') navigate('/admin/dashboard')
    else navigate('/analyst/dashboard')
    return null
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark
        ? 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)'
        : 'linear-gradient(135deg, #003D1C 0%, #005B2B 50%, #007A3A 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', position: 'relative',
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute', top: '1.5rem', right: '1.5rem',
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8, padding: '0.5rem 0.75rem',
          color: '#fff', cursor: 'pointer', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}
      >
        {isDark ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
      </button>

      <div style={{
        background: isDark ? '#161b22' : '#ffffff',
        borderRadius: 16,
        padding: '2.5rem',
        width: '100%', maxWidth: '420px',
        boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.2)',
        border: isDark ? '1px solid #30363d' : 'none',
        animation: 'fadeIn 0.3s ease',
      }}>
        {/* Logo & Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: isDark ? '#004D23' : '#005B2B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 4px 16px rgba(0,91,43,0.35)',
          }}>
            <span style={{ fontSize: '1.8rem' }}>🛡</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: isDark ? '#e6edf3' : '#005B2B', margin: 0, letterSpacing: '-0.5px' }}>
            Sicredi Guardião
          </h1>
          <p style={{ color: isDark ? '#8b949e' : '#57606a', fontSize: '0.88rem', marginTop: '0.3rem' }}>
            Sistema de Prevenção a Fraudes
          </p>
          <p style={{ color: isDark ? '#444c56' : '#9ca3af', fontSize: '0.72rem', marginTop: '0.2rem' }}>
            Inteligência que protege
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: isDark ? '#e6edf3' : '#1f2328' }}>
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: carlos ou ana.ferreira"
              required
              autoFocus
              style={{
                padding: '0.65rem 0.85rem',
                border: `1.5px solid ${isDark ? '#30363d' : '#e5e7eb'}`,
                borderRadius: 8, fontSize: '0.95rem',
                outline: 'none',
                background: isDark ? '#1c2128' : '#ffffff',
                color: isDark ? '#e6edf3' : '#1f2328',
                transition: 'border-color 0.15s',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: isDark ? '#e6edf3' : '#1f2328' }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="sicredi123"
              required
              style={{
                padding: '0.65rem 0.85rem',
                border: `1.5px solid ${isDark ? '#30363d' : '#e5e7eb'}`,
                borderRadius: 8, fontSize: '0.95rem',
                outline: 'none',
                background: isDark ? '#1c2128' : '#ffffff',
                color: isDark ? '#e6edf3' : '#1f2328',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: isDark ? '#2d1515' : '#fef2f2',
              border: `1px solid ${isDark ? '#5c2222' : '#fecaca'}`,
              color: isDark ? '#f87171' : '#dc2626',
              borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? (isDark ? '#004D23' : '#007A3A') : '#005B2B',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '0.75rem', fontSize: '1rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              transition: 'background 0.15s',
            }}
          >
            {loading && (
              <span style={{
                width: 16, height: 16,
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
                display: 'inline-block',
              }} />
            )}
            {loading ? 'Entrando...' : 'Entrar no Guardião'}
          </button>
        </form>

        {/* Demo credentials */}
        <div style={{
          marginTop: '1.5rem', padding: '1rem',
          background: isDark ? '#1c2128' : '#f7f8fa',
          borderRadius: 10,
          border: `1px solid ${isDark ? '#30363d' : '#e5e7eb'}`,
        }}>
          <p style={{ fontWeight: 700, fontSize: '0.78rem', color: isDark ? '#e6edf3' : '#1f2328', margin: '0 0 0.5rem' }}>
            Credenciais de demonstração
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            {[
              { label: 'Associados', value: 'carlos, mariana, joao, beatriz, lucas' },
              { label: 'Analistas', value: 'ana.ferreira, roberto.silva' },
              { label: 'Admin', value: 'admin' },
              { label: 'Senha', value: 'sicredi123' },
            ].map(item => (
              <div key={item.label} style={{ gridColumn: item.label === 'Senha' ? 'span 2' : undefined }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isDark ? '#8b949e' : '#6b7280' }}>{item.label}: </span>
                <span style={{ fontSize: '0.72rem', color: isDark ? '#e6edf3' : '#1f2328' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{
          textAlign: 'center', fontSize: '0.7rem',
          color: isDark ? '#444c56' : '#9ca3af',
          marginTop: '1rem',
        }}>
          Protótipo Acadêmico — IBM AI Experiential Learning Lab 2026
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

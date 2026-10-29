/**
 * AdminLayout — admin portal layout
 */
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../contexts/ThemeContext'

const NAV_ITEMS = [
  { path: '/admin/dashboard', label: 'Painel Admin', icon: '⊞' },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <aside style={{
        width: 240, background: isDark ? 'var(--surface)' : '#1a1f2e',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
        boxShadow: 'var(--shadow-lg)', borderRight: '1px solid var(--border)',
      }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#fff', fontWeight: 700 }}>Sicredi Guardião</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>Portal Admin</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{user?.full_name}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>Administrador</div>
        </div>
        <nav style={{ flex: 1, padding: '0.5rem 0' }}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  width: '100%', padding: '0.65rem 1.25rem',
                  background: active ? 'rgba(0,166,80,0.2)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: active ? '#00A650' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                  textAlign: 'left',
                  borderLeft: active ? '3px solid #00A650' : '3px solid transparent',
                }}>
                <span>{item.icon}</span>{item.label}
              </button>
            )
          })}
        </nav>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '0.75rem 1.25rem' }}>
          <button onClick={toggleTheme}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.4rem 0', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
            {isDark ? '☀️' : '🌙'} {isDark ? 'Modo Claro' : 'Modo Escuro'}
          </button>
          <button onClick={() => { logout(); navigate('/login') }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.4rem 0', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
            ← Sair
          </button>
        </div>
      </aside>
      <main style={{ marginLeft: 240, flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '2rem', flex: 1, animation: 'fadeIn 0.2s ease' }}>{children}</div>
        <footer style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.72rem', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          Protótipo Acadêmico — IBM AI Experiential Learning Lab 2026
        </footer>
      </main>
    </div>
  )
}

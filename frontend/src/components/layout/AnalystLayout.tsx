/**
 * Analyst Portal Layout — professional monitoring platform, theme-aware
 */
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../contexts/ThemeContext'

const NAV_ITEMS = [
  { path: '/analyst/dashboard',      label: 'Visão Geral',       icon: '⊞', exact: true },
  { path: '/analyst/wallet',         label: 'Minha Carteira',    icon: '👥', exact: true },
  { path: '/analyst/alerts',         label: 'Alertas',           icon: '⚠',  exact: false },
  { path: '/analyst/investigations', label: 'Investigações',     icon: '🔎', exact: true },
  { path: '/analyst/ai-chat',        label: 'Guardião IA',       icon: '🤖', exact: true },
  { path: '/analyst/simulator',      label: 'Simulador',         icon: '⚙',  exact: true },
]

export default function AnalystLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebarWidth = collapsed ? 64 : 240

  const isActive = (item: typeof NAV_ITEMS[0]) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarWidth,
        background: isDark ? 'var(--surface)' : '#1a1f2e',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 100,
        transition: 'width 0.2s ease',
        boxShadow: 'var(--shadow-lg)',
        borderRight: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{
          padding: collapsed ? '1.25rem 0' : '1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: '0.5rem', overflow: 'hidden',
        }}>
          {!collapsed && (
            <div>
              <div style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700 }}>
                Sicredi Guardião
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', marginTop: 1 }}>
                Command Center
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)',
              width: 28, height: 28, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', flexShrink: 0,
            }}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* User info */}
        {!collapsed && (
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#005B2B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem',
            }}>
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
              Analista / Gerente
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.5rem 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : '0.75rem',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  width: '100%', padding: collapsed ? '0.75rem 0' : '0.65rem 1.25rem',
                  background: active ? 'rgba(0,166,80,0.2)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: active ? '#00A650' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                  textAlign: 'left',
                  borderLeft: active ? '3px solid #00A650' : '3px solid transparent',
                  transition: 'all 0.15s',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && item.label}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: collapsed ? '0.75rem 0' : '0.75rem 1.25rem' }}>
          <button
            onClick={toggleTheme}
            title={isDark ? 'Modo claro' : 'Modo escuro'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '0.5rem', width: '100%',
              padding: collapsed ? '0.5rem 0' : '0.5rem 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem',
            }}
          >
            <span style={{ fontSize: '1rem' }}>{isDark ? '☀️' : '🌙'}</span>
            {!collapsed && <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>}
          </button>
          <button
            onClick={handleLogout}
            title="Sair"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '0.5rem', width: '100%',
              padding: collapsed ? '0.5rem 0' : '0.5rem 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem',
            }}
          >
            <span>←</span>
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{
        marginLeft: sidebarWidth,
        flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column',
        transition: 'margin-left 0.2s ease',
      }}>
        <div style={{ padding: '2rem', flex: 1, animation: 'fadeIn 0.2s ease' }}>
          {children}
        </div>
        <footer style={{
          textAlign: 'center', padding: '0.75rem 1rem',
          color: 'var(--text-muted)', fontSize: '0.72rem',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          Protótipo Acadêmico — IBM AI Experiential Learning Lab 2026 — ByteLab
        </footer>
      </main>
    </div>
  )
}

/**
 * Associate Portal Layout — banking-style, theme-aware, with theme toggle
 */
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../contexts/ThemeContext'

interface NavItem {
  path: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { path: '/associate/dashboard',     label: 'Início',             icon: '⊞' },
  { path: '/associate/pix',           label: 'Fazer PIX',          icon: '⟳' },
  { path: '/associate/extrato',       label: 'Extrato',            icon: '≡' },
  { path: '/associate/notifications', label: 'Notificações',       icon: '🔔' },
  { path: '/associate/security',      label: 'Central de Segurança', icon: '🛡' },
  { path: '/associate/ai-chat',       label: 'Guardião IA',        icon: '🤖' },
]

export default function AssociateLayout({ children }: { children: ReactNode }) {
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarWidth,
        background: isDark ? 'var(--surface)' : 'var(--green-700)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 100,
        transition: 'width 0.2s ease',
        boxShadow: 'var(--shadow-lg)',
        borderRight: isDark ? '1px solid var(--border)' : 'none',
        overflow: 'hidden',
      }}>
        {/* Brand + collapse toggle */}
        <div style={{
          padding: collapsed ? '1.25rem 0' : '1.25rem',
          borderBottom: `1px solid ${isDark ? 'var(--border)' : 'rgba(255,255,255,0.1)'}`,
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: '0.5rem', overflow: 'hidden',
        }}>
          {!collapsed && (
            <div>
              <div style={{ color: isDark ? 'var(--text-primary)' : '#fff', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                Sicredi
              </div>
              <div style={{ color: isDark ? 'var(--text-secondary)' : 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: 1 }}>
                Guardião 3.0
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            style={{
              background: isDark ? 'var(--surface-2)' : 'rgba(255,255,255,0.15)',
              border: 'none', cursor: 'pointer',
              color: isDark ? 'var(--text-secondary)' : 'rgba(255,255,255,0.8)',
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
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: `1px solid ${isDark ? 'var(--border)' : 'rgba(255,255,255,0.1)'}`,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: isDark ? 'var(--green-700)' : 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem',
            }}>
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div style={{ color: isDark ? 'var(--text-primary)' : '#fff', fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name}
            </div>
            <div style={{ color: isDark ? 'var(--text-secondary)' : 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>
              Associado
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.5rem 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path
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
                  background: active ? (isDark ? 'var(--green-100)' : 'rgba(255,255,255,0.15)') : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: active ? (isDark ? 'var(--green-700)' : '#fff') : (isDark ? 'var(--text-secondary)' : 'rgba(255,255,255,0.72)'),
                  fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                  textAlign: 'left',
                  borderLeft: active ? `3px solid ${isDark ? 'var(--green-600)' : '#fff'}` : '3px solid transparent',
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

        {/* Bottom: theme + logout */}
        <div style={{ borderTop: `1px solid ${isDark ? 'var(--border)' : 'rgba(255,255,255,0.1)'}`, padding: collapsed ? '0.75rem 0' : '0.75rem 1.25rem' }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Modo claro' : 'Modo escuro'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '0.5rem', width: '100%',
              padding: collapsed ? '0.5rem 0' : '0.5rem 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: isDark ? 'var(--text-secondary)' : 'rgba(255,255,255,0.6)', fontSize: '0.85rem',
            }}
          >
            <span style={{ fontSize: '1rem' }}>{isDark ? '☀️' : '🌙'}</span>
            {!collapsed && <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>}
          </button>
          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Sair"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '0.5rem', width: '100%',
              padding: collapsed ? '0.5rem 0' : '0.5rem 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: isDark ? 'var(--text-secondary)' : 'rgba(255,255,255,0.6)', fontSize: '0.85rem',
            }}
          >
            <span>←</span>
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        marginLeft: sidebarWidth,
        flex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
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

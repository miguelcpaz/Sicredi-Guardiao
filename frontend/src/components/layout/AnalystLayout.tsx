/**
 * Analyst Portal Layout — professional monitoring platform, theme-aware
 * Responsive: desktop sidebar + mobile drawer with hamburger toggle
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../contexts/ThemeContext'
import {
  LayoutDashboard, Users, ShieldAlert, Search, Bot, Settings2,
  Sun, Moon, LogOut, ChevronRight, ChevronLeft, Menu, X,
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/analyst/dashboard',      label: 'Visão Geral',       Icon: LayoutDashboard, exact: true },
  { path: '/analyst/wallet',         label: 'Minha Carteira',    Icon: Users,           exact: true },
  { path: '/analyst/alerts',         label: 'Alertas',           Icon: ShieldAlert,     exact: false },
  { path: '/analyst/investigations', label: 'Investigações',     Icon: Search,          exact: true },
  { path: '/analyst/ai-chat',        label: 'Guardião IA',       Icon: Bot,             exact: true },
  { path: '/analyst/simulator',      label: 'Simulador',         Icon: Settings2,       exact: true },
]

export default function AnalystLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebarWidth = collapsed ? 64 : 240

  const isActive = (item: typeof NAV_ITEMS[0]) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)

  // Close mobile sidebar on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && mobileOpen) setMobileOpen(false)
  }, [mobileOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleNavClick = (path: string) => {
    navigate(path)
    setMobileOpen(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>

      {/* Mobile hamburger button */}
      <button
        className="sidebar-toggle-btn"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu de navegação"
        aria-expanded={mobileOpen}
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay active"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Navegação principal"
        style={{
          width: sidebarWidth,
          background: 'var(--sidebar-analyst-bg)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          zIndex: 100,
          transition: 'width 0.2s ease, transform 0.25s ease',
          boxShadow: 'var(--shadow-lg)',
          borderRight: '1px solid var(--sidebar-analyst-border)',
          overflow: 'hidden',
          /* On mobile, sidebar slides in/out */
          transform: mobileOpen ? 'translateX(0)' : undefined,
        }}
        /* Mobile: always show as full-width drawer when open, hidden offscreen when closed */
        className={mobileOpen ? 'sidebar-mobile-open' : ''}
      >
        {/* Brand */}
        <div style={{
          padding: collapsed ? '1.25rem 0' : '1.25rem',
          borderBottom: '1px solid var(--sidebar-analyst-border)',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: '0.5rem', overflow: 'hidden',
        }}>
          {!collapsed && (
            <div>
              <div style={{ color: 'var(--sidebar-analyst-text)', fontSize: '1.05rem', fontWeight: 700 }}>
                Sicredi Guardião
              </div>
              <div style={{ color: 'var(--sidebar-analyst-muted)', fontSize: '0.72rem', marginTop: 1 }}>
                Command Center
              </div>
            </div>
          )}
          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="desktop-only"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-analyst-muted)',
              width: 28, height: 28, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="mobile-only"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-analyst-muted)',
              width: 28, height: 28, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginLeft: 'auto',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* User info */}
        {!collapsed && (
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--sidebar-analyst-border)' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--sidebar-analyst-active-bg)',
              border: '2px solid var(--sidebar-analyst-indicator)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--sidebar-analyst-indicator)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem',
            }}>
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div style={{ color: 'var(--sidebar-analyst-text)', fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name}
            </div>
            <div style={{ color: 'var(--sidebar-analyst-muted)', fontSize: '0.72rem' }}>
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
                onClick={() => handleNavClick(item.path)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : '0.75rem',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  width: '100%', padding: collapsed ? '0.75rem 0' : '0.65rem 1.25rem',
                  background: active ? 'var(--sidebar-analyst-active-bg)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: active ? 'var(--sidebar-analyst-indicator)' : 'var(--sidebar-analyst-muted)',
                  fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                  textAlign: 'left',
                  borderLeft: active ? `3px solid var(--sidebar-analyst-indicator)` : '3px solid transparent',
                  transition: 'all 0.15s',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-analyst-hover-bg)'
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <item.Icon size={17} style={{ flexShrink: 0 }} />
                {!collapsed && item.label}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid var(--sidebar-analyst-border)', padding: collapsed ? '0.75rem 0' : '0.75rem 1.25rem' }}>
          <button
            onClick={toggleTheme}
            title={isDark ? 'Modo claro' : 'Modo escuro'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '0.5rem', width: '100%',
              padding: collapsed ? '0.5rem 0' : '0.5rem 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-analyst-muted)', fontSize: '0.85rem',
              transition: 'color 0.15s',
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
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
              color: 'var(--sidebar-analyst-muted)', fontSize: '0.85rem',
              transition: 'color 0.15s',
            }}
          >
            <LogOut size={16} />
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main
        className="main-content-wrapper"
        style={{
          marginLeft: sidebarWidth,
          flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column',
          transition: 'margin-left 0.2s ease',
          minWidth: 0,
        }}
      >
        <div className="page-pad" style={{ flex: 1, animation: 'fadeIn 0.2s ease' }}>
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

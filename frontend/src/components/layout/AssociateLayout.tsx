/**
 * Associate Portal Layout — banking-style, theme-aware, with theme toggle
 * Responsive: desktop sidebar + mobile drawer with hamburger toggle
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../contexts/ThemeContext'
import {
  LayoutDashboard, ArrowLeftRight, FileText, Bell, ShieldCheck, Bot,
  Sun, Moon, LogOut, ChevronRight, ChevronLeft, Menu, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  path: string
  label: string
  Icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { path: '/associate/dashboard',     label: 'Início',              Icon: LayoutDashboard },
  { path: '/associate/pix',           label: 'Fazer PIX',           Icon: ArrowLeftRight },
  { path: '/associate/extrato',       label: 'Extrato',             Icon: FileText },
  { path: '/associate/notifications', label: 'Notificações',        Icon: Bell },
  { path: '/associate/security',      label: 'Central de Segurança', Icon: ShieldCheck },
  { path: '/associate/ai-chat',       label: 'Guardião IA',         Icon: Bot },
]

export default function AssociateLayout({ children }: { children: ReactNode }) {
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
          background: 'var(--sidebar-bg)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          zIndex: 100,
          transition: 'width 0.2s ease, transform 0.25s ease',
          boxShadow: 'var(--shadow-lg)',
          borderRight: '1px solid var(--sidebar-border)',
          overflow: 'hidden',
          transform: mobileOpen ? 'translateX(0)' : undefined,
        }}
        className={mobileOpen ? 'sidebar-mobile-open' : ''}
      >
        {/* Brand + collapse toggle */}
        <div style={{
          padding: collapsed ? '1.25rem 0' : '1.25rem',
          borderBottom: `1px solid var(--sidebar-border)`,
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: '0.5rem', overflow: 'hidden',
        }}>
          {!collapsed && (
            <div>
              <div style={{ color: 'var(--sidebar-text)', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                Sicredi
              </div>
              <div style={{ color: 'var(--sidebar-muted)', fontSize: '0.72rem', marginTop: 1 }}>
                Guardião 3.0
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
              background: 'var(--sidebar-hover-bg)',
              border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-text)',
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
              background: 'var(--sidebar-hover-bg)',
              border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-text)',
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
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: `1px solid var(--sidebar-border)`,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--sidebar-active-bg)',
              border: `2px solid var(--sidebar-text)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem',
            }}>
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div style={{ color: 'var(--sidebar-text)', fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name}
            </div>
            <div style={{ color: 'var(--sidebar-muted)', fontSize: '0.72rem' }}>
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
                onClick={() => handleNavClick(item.path)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : '0.75rem',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  width: '100%', padding: collapsed ? '0.75rem 0' : '0.65rem 1.25rem',
                  background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: active ? 'var(--sidebar-text)' : 'var(--sidebar-muted)',
                  fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                  textAlign: 'left',
                  borderLeft: active ? `3px solid var(--sidebar-text)` : '3px solid transparent',
                  transition: 'all 0.15s',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)'
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

        {/* Bottom: theme + logout */}
        <div style={{ borderTop: `1px solid var(--sidebar-border)`, padding: collapsed ? '0.75rem 0' : '0.75rem 1.25rem' }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Modo claro' : 'Modo escuro'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '0.5rem', width: '100%',
              padding: collapsed ? '0.5rem 0' : '0.5rem 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-muted)', fontSize: '0.85rem',
              transition: 'color 0.15s',
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
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
              color: 'var(--sidebar-muted)', fontSize: '0.85rem',
              transition: 'color 0.15s',
            }}
          >
            <LogOut size={16} />
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className="main-content-wrapper"
        style={{
          marginLeft: sidebarWidth,
          flex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
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

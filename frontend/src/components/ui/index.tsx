/**
 * Sicredi Guardião 3.0 — Shared UI components (theme-aware via CSS variables)
 */
import type { ReactNode, CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
interface CardProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
  onClick?: () => void
  hover?: boolean
}
export function Card({ children, style, className, onClick, hover }: CardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        cursor: onClick ? 'pointer' : undefined,
        transition: hover ? 'box-shadow 0.15s, transform 0.15s' : undefined,
        ...style,
      }}
      onMouseEnter={hover && onClick ? (e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = 'var(--shadow-md)'
        el.style.transform = 'translateY(-1px)'
      } : undefined}
      onMouseLeave={hover && onClick ? (e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = 'var(--shadow-sm)'
        el.style.transform = 'translateY(0)'
      } : undefined}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
type BadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'gray'
export function Badge({ children, variant = 'gray' }: { children: ReactNode; variant?: BadgeVariant }) {
  const styles: Record<BadgeVariant, CSSProperties> = {
    green:  { background: 'var(--green-100)', color: 'var(--green-700)' },
    red:    { background: 'var(--red-100)',    color: 'var(--red-600)' },
    yellow: { background: 'var(--yellow-100)', color: 'var(--yellow-600)' },
    blue:   { background: 'var(--blue-100)',   color: 'var(--blue-600)' },
    gray:   { background: 'var(--surface-3)',  color: 'var(--text-secondary)' },
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.2rem 0.65rem',
      borderRadius: 20,
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.01em',
      ...styles[variant],
    }}>
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning'
interface BtnProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: BtnVariant
  type?: 'button' | 'submit' | 'reset'
  style?: CSSProperties
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}
export function Button({
  children, onClick, disabled, variant = 'primary', type = 'button',
  style, fullWidth, size = 'md', loading,
}: BtnProps) {
  const sizes: Record<'sm' | 'md' | 'lg', CSSProperties> = {
    sm: { padding: '0.35rem 0.8rem', fontSize: '0.8rem' },
    md: { padding: '0.55rem 1.2rem', fontSize: '0.9rem' },
    lg: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
  }
  const variants: Record<BtnVariant, CSSProperties> = {
    primary:   { background: 'var(--green-700)', color: '#fff', border: '1px solid var(--green-700)' },
    secondary: { background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
    danger:    { background: 'var(--red-600)', color: '#fff', border: '1px solid var(--red-600)' },
    ghost:     { background: 'transparent', color: 'var(--green-600)', border: '1px solid var(--green-600)' },
    warning:   { background: 'var(--yellow-100)', color: 'var(--yellow-600)', border: '1px solid var(--yellow-200)' },
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        borderRadius: 'var(--radius-sm)',
        fontWeight: 600,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.65 : 1,
        transition: 'all 0.15s',
        width: fullWidth ? '100%' : undefined,
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
    >
      {loading && (
        <span style={{
          width: 14, height: 14,
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
          display: 'inline-block',
          flexShrink: 0,
        }} />
      )}
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
interface InputProps {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  error?: string
  prefix?: string
  suffix?: string
  disabled?: boolean
  hint?: string
  style?: CSSProperties
}
export function Input({ label, value, onChange, placeholder, type = 'text', required, error, prefix, suffix, disabled, hint, style }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {label && (
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {label}{required && <span style={{ color: 'var(--red-600)' }}> *</span>}
        </label>
      )}
      {hint && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{hint}</span>}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {prefix && (
          <span style={{
            padding: '0.6rem 0.75rem',
            background: 'var(--surface-2)',
            border: '1.5px solid var(--border)',
            borderRight: 'none',
            borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '0.6rem 0.75rem',
            border: `1.5px solid ${error ? 'var(--red-600)' : 'var(--border)'}`,
            borderRadius: prefix ? `0 var(--radius-sm) var(--radius-sm) 0` : suffix ? `var(--radius-sm) 0 0 var(--radius-sm)` : 'var(--radius-sm)',
            fontSize: '0.95rem',
            outline: 'none',
            background: disabled ? 'var(--surface-2)' : 'var(--surface)',
            color: 'var(--text-primary)',
            ...style,
          }}
        />
        {suffix && (
          <span style={{
            padding: '0.6rem 0.75rem',
            background: 'var(--surface-2)',
            border: '1.5px solid var(--border)',
            borderLeft: 'none',
            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
          }}>
            {suffix}
          </span>
        )}
      </div>
      {error && <span style={{ fontSize: '0.8rem', color: 'var(--red-600)' }}>{error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
export function Spinner({ size = 24, color }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size,
      height: size,
      border: `3px solid var(--border)`,
      borderTopColor: color || 'var(--green-600)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

// ---------------------------------------------------------------------------
// AlertBox (inline alert / toast)
// ---------------------------------------------------------------------------
type AlertType = 'success' | 'error' | 'warning' | 'info'
export function AlertBox({ type, message, onClose, style: outerStyle }: { type: AlertType; message: string; onClose?: () => void; style?: CSSProperties }) {
  const styles: Record<AlertType, CSSProperties> = {
    success: { background: 'var(--green-100)', border: '1px solid var(--green-200)', color: 'var(--green-700)' },
    error:   { background: 'var(--red-100)',   border: '1px solid var(--red-200)',   color: 'var(--red-600)' },
    warning: { background: 'var(--yellow-100)',border: '1px solid var(--yellow-200)',color: 'var(--yellow-600)' },
    info:    { background: 'var(--blue-100)',  border: '1px solid var(--blue-200)',  color: 'var(--blue-600)' },
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: '0.75rem', padding: '0.75rem 1rem',
      borderRadius: 'var(--radius-sm)', fontSize: '0.9rem',
      animation: 'fadeIn 0.2s ease',
      ...styles[type],
      ...outerStyle,
    }}>
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.1rem', lineHeight: 1, flexShrink: 0 }}
        >×</button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function EmptyState({ icon, title, description, action }: { icon?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
      {icon && <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>}
      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>{title}</p>
      {description && <p style={{ fontSize: '0.85rem', marginBottom: action ? '1rem' : 0 }}>{description}</p>}
      {action}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Risk badge
// ---------------------------------------------------------------------------
export function RiskBadge({ level, score }: { level: string; score?: number }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    low:    { label: 'Baixo', variant: 'green' },
    medium: { label: 'Médio', variant: 'yellow' },
    high:   { label: 'Alto',  variant: 'red' },
  }
  const info = map[level] || { label: level, variant: 'gray' as BadgeVariant }
  return (
    <Badge variant={info.variant}>
      {info.label}{score !== undefined ? ` (${score})` : ''}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    approved:       { label: 'Aprovada',       variant: 'green' },
    blocked:        { label: 'Bloqueada',       variant: 'red' },
    pending_review: { label: 'Em Verificação',  variant: 'yellow' },
    retained:       { label: 'Retida',          variant: 'yellow' },
    investigating:  { label: 'Em Investigação', variant: 'blue' },
    resolved:       { label: 'Resolvida',       variant: 'gray' },
    confirmed:      { label: 'Confirmada',      variant: 'green' },
    disputed:       { label: 'Contestada',      variant: 'red' },
    closed:         { label: 'Encerrada',       variant: 'gray' },
    pending:        { label: 'Pendente',        variant: 'yellow' },
    processing:     { label: 'Processando',     variant: 'blue' },
  }
  const info = map[status] || { label: status, variant: 'gray' as BadgeVariant }
  return <Badge variant={info.variant}>{info.label}</Badge>
}

// ---------------------------------------------------------------------------
// Risk meter (visual gauge 0-100)
// ---------------------------------------------------------------------------
export function RiskMeter({ score, level }: { score: number; level: string }) {
  const color = level === 'high' ? 'var(--red-600)' : level === 'medium' ? 'var(--yellow-600)' : 'var(--green-600)'
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Score de Risco</span>
        <span style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{score}<span style={{ fontSize: '0.75rem', fontWeight: 400 }}>/100</span></span>
      </div>
      <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function Modal({ title, children, onClose, size = 'md' }: {
  title: string; children: ReactNode; onClose: () => void; size?: 'sm' | 'md' | 'lg'
}) {
  const maxWidth = { sm: 420, md: 560, lg: 800 }
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: maxWidth[size],
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border)',
        animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'var(--text-secondary)', lineHeight: 1 }}
          >×</button>
        </div>
        <div style={{ padding: '1.5rem' }}>{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table wrapper
// ---------------------------------------------------------------------------
export function Table({ headers, children, loading }: { headers: string[]; children: ReactNode; loading?: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: 40 }} />
          ))}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {headers.map(h => (
                <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </div>
  )
}

export function Tr({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      style={{
        borderBottom: '1px solid var(--surface-2)',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'background 0.1s',
      }}
      onMouseEnter={onClick ? (e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' } : undefined}
      onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' } : undefined}
    >
      {children}
    </tr>
  )
}

export function Td({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-primary)', ...style }}>
      {children}
    </td>
  )
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
export function formatCurrency(v: number | string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}

export function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDateShort(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Toast system
// ---------------------------------------------------------------------------
import { useState, useCallback } from 'react'

export interface ToastMessage {
  id: number
  type: AlertType
  message: string
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: AlertType, message: string) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

export function ToastContainer({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: number) => void }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem',
      maxWidth: 380,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ animation: 'slideInLeft 0.2s ease' }}>
          <AlertBox type={t.type} message={t.message} onClose={() => onRemove(t.id)} />
        </div>
      ))}
    </div>
  )
}

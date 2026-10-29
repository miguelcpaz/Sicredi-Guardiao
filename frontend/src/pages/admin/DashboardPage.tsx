/**
 * Admin Dashboard — system overview for administrators
 */
import { useEffect, useState } from 'react'
import { Card, Spinner, AlertBox, Badge, formatDate } from '../../components/ui/index'
import api from '../../api/client'

interface AdminStats {
  total_users: number
  active_associates: number
  total_analysts: number
  total_transactions: number
  total_alerts: number
  pending_alerts: number
  total_incidents: number
  open_incidents: number
  ai_provider: string
  db_size_mb?: number
}

interface AuditEntry {
  id: number
  actor: string
  action: string
  entity_type: string
  created_at: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/audit-log?limit=15'),
    ])
      .then(([s, a]) => {
        setStats(s.data)
        setAudit(a.data)
      })
      .catch(() => setError('Erro ao carregar dados administrativos.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
      <Spinner size={36} />
    </div>
  )

  return (
    <div>
      {error && <AlertBox type="error" message={error} style={{ marginBottom: '1rem' }} />}

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          ⚙️ Painel Administrativo
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Visão geral do sistema Sicredi Guardião 3.0
        </p>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total de Usuários', value: stats?.total_users ?? 0, icon: '👤' },
          { label: 'Associados', value: stats?.active_associates ?? 0, icon: '🏦' },
          { label: 'Analistas', value: stats?.total_analysts ?? 0, icon: '🔍' },
          { label: 'Transações', value: stats?.total_transactions ?? 0, icon: '💳' },
          { label: 'Alertas Pendentes', value: stats?.pending_alerts ?? 0, icon: '⚠️' },
          { label: 'Incidentes Abertos', value: stats?.open_incidents ?? 0, icon: '🔒' },
        ].map(item => (
          <Card key={item.label} style={{ padding: '1rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{item.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{item.label}</div>
          </Card>
        ))}
      </div>

      {/* System status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <Card>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Status dos Serviços</h3>
          {[
            { label: 'Backend FastAPI', status: 'online' },
            { label: 'Banco de Dados SQLite', status: 'online' },
            { label: `IA Provider (${stats?.ai_provider || 'mock'})`, status: stats?.ai_provider === 'mock' ? 'simulated' : 'online' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.label}</span>
              <Badge variant={item.status === 'online' ? 'green' : item.status === 'simulated' ? 'yellow' : 'red'}>
                {item.status === 'online' ? 'Online' : item.status === 'simulated' ? 'Simulado' : 'Offline'}
              </Badge>
            </div>
          ))}
        </Card>

        <Card>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Configurações</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Provedor IA</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stats?.ai_provider || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Versão</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>3.0.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ambiente</span>
              <Badge variant="yellow">Demonstração</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Audit log */}
      <Card>
        <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Registro de Auditoria Recente</h3>
        {audit.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Nenhum registro disponível.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Ator', 'Ação', 'Entidade', 'Data'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--surface-2)' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.actor}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{entry.action}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{entry.entity_type}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>{formatDate(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

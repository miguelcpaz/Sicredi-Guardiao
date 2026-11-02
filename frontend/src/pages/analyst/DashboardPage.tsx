/**
 * Analyst Dashboard — Command Center with enriched charts and metrics.
 * All data sourced from backend — no hardcoded numbers.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { CreditCard, Banknote, ShieldAlert, Lock, Ban, Search, Bell } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import AnalystLayout from '../../components/layout/AnalystLayout'
import { Card, Spinner, AlertBox, RiskBadge, formatCurrency, formatDate } from '../../components/ui/index'
import { getAnalystDashboard } from '../../api/client'
import type { AnalystDashboard } from '../../api/client'

const RISK_COLORS: Record<string, string> = {
  low: '#3fa535',
  medium: '#d97706',
  high: '#dc2626',
}
const PIE_COLORS = ['#3fa535', '#d97706', '#dc2626', '#2563eb', '#7c3aed']

const STATUS_LABELS: Record<string, string> = {
  approved: 'Aprovadas',
  pending_review: 'Em Verificação',
  blocked: 'Bloqueadas',
  investigating: 'Investigando',
  resolved: 'Resolvidas',
  closed: 'Encerradas',
  confirmed: 'Confirmadas',
  disputed: 'Contestadas',
}

function MetricCard({
  label, value, sub, color, Icon,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  Icon?: LucideIcon
}) {
  return (
    <Card style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.35rem' }}>{label}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
          {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{sub}</div>}
        </div>
        {Icon && <Icon size={22} style={{ opacity: 0.55, color: color || 'var(--text-secondary)', flexShrink: 0 }} />}
      </div>
    </Card>
  )
}

export default function AnalystDashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<AnalystDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAnalystDashboard()
      .then((r) => setData(r.data))
      .catch(() => setError('Erro ao carregar dados do painel.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <AnalystLayout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Spinner size={36} />
      </div>
    </AnalystLayout>
  )

  // --- Chart data from backend ---

  // Risk distribution pie
  const riskDistData = Object.entries(data?.risk_distribution ?? {}).map(([level, count]) => ({
    name: level === 'low' ? 'Baixo' : level === 'medium' ? 'Médio' : 'Alto',
    value: count,
    level,
  }))

  // Time-series bar chart (last 14 days)
  const timeSeriesData = (data?.time_series ?? []).map((row) => ({
    date: new Date(row.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    count: row.count,
    volume: Math.round(row.volume),
  }))

  // Risk score distribution from recent_alerts
  const scoreData = (data?.recent_alerts ?? []).slice(0, 8).map((a) => ({
    label: a.associate_name?.split(' ')[0] ?? `#${a.id}`,
    score: a.risk_score,
    level: a.risk_level,
  }))

  // Status pie for transactions
  const statusData = [
    { name: 'Aprovadas', value: (data?.total_transactions ?? 0) - (data?.retained_transactions ?? 0) - (data?.blocked_transactions ?? 0) - (data?.resolved_count ?? 0) },
    { name: 'Retidas', value: data?.retained_transactions ?? 0 },
    { name: 'Bloqueadas', value: data?.blocked_transactions ?? 0 },
    { name: 'Resolvidas', value: data?.resolved_count ?? 0 },
  ].filter((d) => d.value > 0)

  return (
    <AnalystLayout>
      {error && <AlertBox type="error" message={error} />}

      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
          Visão Geral — {data?.full_name}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Monitorando {data?.associates_count} associado(s) · dados em tempo real
        </p>
      </div>

      {/* Key metrics row */}
      <div className="cards-grid" style={{ marginBottom: '1.75rem' }}>
        <MetricCard label="Transações" value={data?.total_transactions ?? 0} Icon={CreditCard} />
        <MetricCard
          label="Volume Total"
          value={formatCurrency(data?.total_volume ?? 0)}
          Icon={Banknote}
          sub="monitorado"
        />
        <MetricCard
          label="Alertas Pendentes"
          value={data?.pending_alerts ?? 0}
          color={(data?.pending_alerts ?? 0) > 0 ? 'var(--yellow-600)' : 'var(--text-primary)'}
          Icon={ShieldAlert}
          sub={(data?.pending_alerts ?? 0) > 0 ? 'Requer atenção' : 'Sem pendências'}
        />
        <MetricCard
          label="Em Verificação"
          value={data?.retained_transactions ?? 0}
          color={(data?.retained_transactions ?? 0) > 0 ? 'var(--yellow-600)' : 'var(--text-primary)'}
          Icon={Lock}
        />
        <MetricCard
          label="Bloqueadas"
          value={data?.blocked_transactions ?? 0}
          color={(data?.blocked_transactions ?? 0) > 0 ? 'var(--red-600)' : 'var(--text-primary)'}
          Icon={Ban}
        />
        <MetricCard
          label="Investigações"
          value={data?.investigating_count ?? 0}
          color={(data?.investigating_count ?? 0) > 0 ? 'var(--blue-600)' : 'var(--text-primary)'}
          Icon={Search}
          sub={`${data?.resolved_count ?? 0} encerradas`}
        />
        <MetricCard label="Notificações" value={data?.unread_notifications ?? 0} Icon={Bell} sub="não lidas" />
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
        {[
          { label: 'Ver Alertas', path: '/analyst/alerts', primary: true },
          { label: 'Minha Carteira', path: '/analyst/wallet' },
          { label: 'Investigações', path: '/analyst/investigations' },
          { label: 'Guardião IA', path: '/analyst/ai-chat' },
          { label: 'Simulador', path: '/analyst/simulator' },
        ].map((btn) => (
          <button
            key={btn.path}
            onClick={() => navigate(btn.path)}
            style={{
              padding: '0.6rem 1.2rem',
              background: btn.primary ? 'var(--green-700)' : 'var(--surface)',
              color: btn.primary ? '#fff' : 'var(--text-primary)',
              border: btn.primary ? 'none' : '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Charts row — time series + risk distribution */}
      <div className="charts-row" style={{ marginBottom: '1.75rem' }}>
        {/* Daily transaction volume */}
        <Card>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
            Transações por Dia — 14 dias
          </h3>
          {timeSeriesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={timeSeriesData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'var(--surface-2)' }}
                  formatter={(v, name) => {
                    const num = typeof v === 'number' ? v : Number(v)
                    return name === 'volume' ? [formatCurrency(num), 'Volume'] : [num, 'Transações']
                  }}
                />
                <Bar dataKey="count" fill="var(--green-600)" radius={[4, 4, 0, 0]} name="Transações" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Sem dados nos últimos 14 dias.
            </div>
          )}
        </Card>

        {/* Risk distribution pie */}
        <Card>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
            Distribuição de Risco
          </h3>
          {riskDistData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={riskDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                  {riskDistData.map((entry, i) => (
                    <Cell key={i} fill={RISK_COLORS[entry.level] ?? PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Sem alertas registrados.
            </div>
          )}
        </Card>
      </div>

      {/* Charts row — score bar + status pie */}
      <div className="charts-row" style={{ marginBottom: '1.75rem' }}>
        {/* Risk scores of recent alerts */}
        <Card>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
            Score de Risco — Alertas Recentes
          </h3>
          {scoreData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={scoreData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'var(--surface-2)' }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]} name="Score">
                  {scoreData.map((entry, i) => (
                    <Cell key={i} fill={entry.score >= 70 ? 'var(--red-600)' : entry.score >= 30 ? 'var(--yellow-600)' : 'var(--green-600)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Nenhum alerta recente.
            </div>
          )}
        </Card>

        {/* Transaction status distribution */}
        <Card>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
            Status das Transações
          </h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Sem dados suficientes
            </div>
          )}
        </Card>
      </div>

      {/* Recent alerts table */}
      {data?.recent_alerts && data.recent_alerts.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Alertas Recentes</h2>
            <button
              onClick={() => navigate('/analyst/alerts')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green-600)', fontSize: '0.85rem', fontWeight: 600 }}
            >
              Ver todos →
            </button>
          </div>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 480 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Associado', 'Estabelecimento', 'Valor', 'Risco', 'Status', 'Data'].map((h) => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent_alerts.map((a) => (
                  <tr
                    key={a.id}
                    style={{ borderBottom: '1px solid var(--surface-2)', cursor: 'pointer' }}
                    onClick={() => navigate(`/analyst/alerts/${a.id}`)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 500, color: 'var(--text-primary)' }}>{a.associate_name}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.merchant}</td>
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {a.amount !== null ? formatCurrency(a.amount) : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <RiskBadge level={a.risk_level} score={a.risk_score} />
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>{formatDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AnalystLayout>
  )
}

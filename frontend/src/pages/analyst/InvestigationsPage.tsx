/**
 * Analyst Investigations Page
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AnalystLayout from '../../components/layout/AnalystLayout'
import { Card, Spinner, EmptyState, StatusBadge, formatCurrency, formatDate } from '../../components/ui/index'
import { listIncidents } from '../../api/client'

interface Incident {
  id: number
  transaction_id: number
  alert_id: number | null
  status: string
  description: string
  created_at: string
  amount: number | null
  associate_name: string | null
}

export default function InvestigationsPage() {
  const navigate = useNavigate()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listIncidents()
      .then((r) => setIncidents(r.data as Incident[]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AnalystLayout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2328' }}>Investigações</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          {incidents.filter((i) => i.status === 'investigating').length} caso(s) em investigação ativa
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner size={36} />
        </div>
      ) : incidents.length === 0 ? (
        <Card>
          <EmptyState icon="🔎" title="Nenhuma investigação encontrada" description="Casos de alta prioridade aparecerão aqui." />
        </Card>
      ) : (
        <Card>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                {['#', 'Associado', 'Valor', 'Status', 'Descrição', 'Data', ''].map((h) => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr
                  key={inc.id}
                  style={{ borderBottom: '1px solid #f9fafb', cursor: 'pointer' }}
                  onClick={() => inc.alert_id && navigate(`/analyst/alerts/${inc.alert_id}`)}
                >
                  <td style={{ padding: '0.7rem 0.75rem', color: '#9ca3af', fontSize: '0.82rem' }}>
                    #{inc.id}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600 }}>
                    {inc.associate_name || '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600 }}>
                    {inc.amount !== null ? formatCurrency(inc.amount) : '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <StatusBadge status={inc.status} />
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: '#4b5563', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inc.description}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                    {formatDate(inc.created_at)}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    {inc.alert_id && (
                      <span style={{ color: '#005B2B', fontSize: '0.82rem', fontWeight: 600 }}>Ver alerta →</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AnalystLayout>
  )
}

/**
 * Associate Extrato (Statement) Page
 */
import { useEffect, useState } from 'react'
import AssociateLayout from '../../components/layout/AssociateLayout'
import { Card, Spinner, EmptyState, StatusBadge, formatCurrency, formatDate } from '../../components/ui/index'
import { listPixTransfers } from '../../api/client'
import type { PixTransfer } from '../../api/client'

const STATUS_ICONS: Record<string, string> = {
  approved: '✅',
  retained: '⏳',
  blocked: '🛡️',
  processing: '⟳',
}

export default function ExtratoPage() {
  const [transfers, setTransfers] = useState<PixTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PixTransfer | null>(null)

  useEffect(() => {
    listPixTransfers()
      .then((r) => setTransfers(r.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AssociateLayout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2328' }}>Extrato</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Suas transferências PIX recentes</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner size={36} />
        </div>
      ) : transfers.length === 0 ? (
        <Card>
          <EmptyState
            icon="≡"
            title="Nenhuma transferência encontrada"
            description="Suas transferências PIX aparecerão aqui."
          />
        </Card>
      ) : (
        <Card>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                {['Data', 'Destinatário', 'Descrição', 'Valor', 'Status', 'Detalhes'].map((h) => (
                  <th key={h} style={{
                    padding: '0.6rem 0.75rem', textAlign: 'left',
                    color: '#6b7280', fontWeight: 600, fontSize: '0.78rem',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr
                  key={t.id}
                  style={{
                    borderBottom: '1px solid #f9fafb',
                    cursor: 'pointer',
                    background: selected?.id === t.id ? '#f4faf6' : 'transparent',
                  }}
                  onClick={() => setSelected(selected?.id === t.id ? null : t)}
                >
                  <td style={{ padding: '0.7rem 0.75rem', color: '#6b7280' }}>
                    {formatDate(t.initiated_at)}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', fontWeight: 500 }}>
                    {STATUS_ICONS[t.status] || '⟳'} {t.recipient_name}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: '#6b7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description || '—'}
                  </td>
                  <td style={{
                    padding: '0.7rem 0.75rem',
                    fontWeight: 700,
                    color: t.status === 'approved' ? '#005B2B' : '#1f2328',
                  }}>
                    {formatCurrency(t.amount)}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <StatusBadge status={t.status} />
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <span style={{ color: '#005B2B', fontSize: '0.82rem', fontWeight: 600 }}>
                      {selected?.id === t.id ? 'Fechar' : 'Ver'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Inline detail */}
          {selected && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1.25rem',
              background: '#f4faf6',
              borderRadius: 8,
              border: '1px solid #bbf7d0',
            }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#1f2328' }}>
                Detalhes da Transferência #{selected.id}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { label: 'Destinatário', value: selected.recipient_name },
                  { label: 'Chave PIX', value: selected.pix_key },
                  { label: 'Valor', value: formatCurrency(selected.amount) },
                  { label: 'Descrição', value: selected.description || '—' },
                  { label: 'Status', value: <StatusBadge status={selected.status} /> },
                  { label: 'Data', value: formatDate(selected.initiated_at) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.2rem' }}>{label}</p>
                    <p style={{ fontWeight: 600, color: '#1f2328', fontSize: '0.88rem' }}>{value as string}</p>
                  </div>
                ))}
              </div>
              {selected.status !== 'approved' && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 6,
                }}>
                  <p style={{ fontSize: '0.82rem', color: '#92400e', margin: 0 }}>
                    {selected.status === 'retained'
                      ? 'Esta transferência está em análise de segurança. O valor não foi debitado.'
                      : selected.status === 'blocked'
                      ? 'Esta transferência foi bloqueada por motivos de segurança. O valor não foi debitado.'
                      : 'Transferência em processamento.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </AssociateLayout>
  )
}

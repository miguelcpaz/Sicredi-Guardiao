/**
 * Associate Extrato (Statement) Page
 */
import { useEffect, useState } from 'react'
import AssociateLayout from '../../components/layout/AssociateLayout'
import { Card, Spinner, EmptyState, StatusBadge, formatCurrency, formatDate } from '../../components/ui/index'
import { listPixTransfers } from '../../api/client'
import type { PixTransfer } from '../../api/client'

const STATUS_ICONS: Record<string, string> = {
  approved: '✓',
  retained: '…',
  blocked: '✕',
  processing: '↻',
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
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Extrato</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Suas transferências PIX recentes</p>
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
          <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Data', 'Destinatário', 'Descrição', 'Valor', 'Status', 'Detalhes'].map((h) => (
                  <th key={h} style={{
                    padding: '0.6rem 0.75rem', textAlign: 'left',
                    color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem',
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
                    borderBottom: '1px solid var(--surface-2)',
                    cursor: 'pointer',
                    background: selected?.id === t.id ? 'var(--surface-2)' : 'transparent',
                  }}
                  onClick={() => setSelected(selected?.id === t.id ? null : t)}
                  onMouseEnter={(e) => { if (selected?.id !== t.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { if (selected?.id !== t.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-secondary)' }}>
                    {formatDate(t.initiated_at)}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {STATUS_ICONS[t.status] || '⟳'} {t.recipient_name}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description || '—'}
                  </td>
                  <td style={{
                    padding: '0.7rem 0.75rem',
                    fontWeight: 700,
                    color: t.status === 'approved' ? 'var(--green-600)' : 'var(--text-primary)',
                  }}>
                    {formatCurrency(t.amount)}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <StatusBadge status={t.status} />
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <span style={{ color: 'var(--green-600)', fontSize: '0.82rem', fontWeight: 600 }}>
                      {selected?.id === t.id ? 'Fechar' : 'Ver'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Inline detail */}
          {selected && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1.25rem',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Detalhes da Transferência #{selected.id}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {[
                  { label: 'Destinatário', value: selected.recipient_name },
                  { label: 'Chave PIX', value: selected.pix_key },
                  { label: 'Valor', value: formatCurrency(selected.amount) },
                  { label: 'Descrição', value: selected.description || '—' },
                  { label: 'Status', value: <StatusBadge status={selected.status} /> },
                  { label: 'Data', value: formatDate(selected.initiated_at) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.2rem' }}>{label}</p>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{value as string}</p>
                  </div>
                ))}
              </div>
              {selected.status !== 'approved' && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: 'var(--yellow-100)',
                  border: '1px solid var(--yellow-200)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--yellow-600)', margin: 0 }}>
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

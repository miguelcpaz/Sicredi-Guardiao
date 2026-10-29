/**
 * Analyst Wallet Page — associates portfolio management
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AnalystLayout from '../../components/layout/AnalystLayout'
import { Card, Spinner, EmptyState, Badge, formatCurrency } from '../../components/ui/index'
import { listWalletAssociates, getAssociateTransactions } from '../../api/client'
import type { WalletAssociate } from '../../api/client'

export default function WalletPage() {
  const navigate = useNavigate()
  const [associates, setAssociates] = useState<WalletAssociate[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [txs, setTxs] = useState<Record<number, unknown[]>>({})
  const [txLoading, setTxLoading] = useState<number | null>(null)

  useEffect(() => {
    listWalletAssociates()
      .then((r) => setAssociates(r.data))
      .finally(() => setLoading(false))
  }, [])

  const handleExpand = async (assocId: number) => {
    if (expanded === assocId) { setExpanded(null); return }
    setExpanded(assocId)
    if (!txs[assocId]) {
      setTxLoading(assocId)
      try {
        const r = await getAssociateTransactions(assocId)
        setTxs((prev) => ({ ...prev, [assocId]: r.data }))
      } finally {
        setTxLoading(null)
      }
    }
  }

  return (
    <AnalystLayout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2328' }}>Minha Carteira</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          {associates.length} associado(s) vinculados à sua carteira
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner size={36} />
        </div>
      ) : associates.length === 0 ? (
        <Card>
          <EmptyState icon="👥" title="Nenhum associado encontrado" description="Você não possui associados vinculados." />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {associates.map((a) => (
            <Card key={a.id} style={{ overflow: 'hidden' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => handleExpand(a.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: '#005B2B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0,
                  }}>
                    {a.full_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1f2328', fontSize: '0.95rem' }}>{a.full_name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                      @{a.username} · Conta {a.account_number}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Saldo</div>
                    <div style={{ fontWeight: 700, color: '#005B2B' }}>{formatCurrency(a.balance)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Alertas</div>
                    <div>
                      <Badge variant={a.pending_alerts > 0 ? 'red' : 'green'}>
                        {a.pending_alerts}
                      </Badge>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Transações</div>
                    <div style={{ fontWeight: 600 }}>{a.total_transactions}</div>
                  </div>
                  <button
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '1.2rem', color: '#6b7280',
                    }}
                  >
                    {expanded === a.id ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {/* Expanded transactions */}
              {expanded === a.id && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid #f3f4f6', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1f2328' }}>
                      Transações Recentes
                    </h3>
                    <button
                      onClick={() => navigate(`/analyst/alerts?associate=${a.id}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#005B2B', fontSize: '0.82rem', fontWeight: 600 }}
                    >
                      Ver alertas →
                    </button>
                  </div>

                  {txLoading === a.id ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                      <Spinner size={24} />
                    </div>
                  ) : !txs[a.id]?.length ? (
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                      Nenhuma transação encontrada.
                    </p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                          {['Data', 'Destinatário', 'Valor', 'Score', 'Status'].map((h) => (
                            <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontSize: '0.72rem', fontWeight: 600 }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(txs[a.id] as Array<{
                          id: number; amount: number; merchant: string; status: string;
                          timestamp: string; risk_score?: number; risk_level?: string
                        }>).slice(0, 8).map((t) => (
                          <tr
                            key={t.id}
                            style={{ borderBottom: '1px solid #f9fafb', cursor: 'pointer' }}
                            onClick={() => navigate(`/analyst/transactions/${t.id}`)}
                          >
                            <td style={{ padding: '0.5rem', color: '#6b7280' }}>
                              {t.timestamp ? new Date(t.timestamp).toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td style={{ padding: '0.5rem', fontWeight: 500 }}>{t.merchant}</td>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              {t.risk_score !== undefined ? (
                                <Badge variant={t.risk_level === 'high' ? 'red' : t.risk_level === 'medium' ? 'yellow' : 'green'}>
                                  {t.risk_score}
                                </Badge>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <Badge variant={t.status === 'approved' ? 'green' : t.status === 'blocked' ? 'red' : 'yellow'}>
                                {t.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AnalystLayout>
  )
}

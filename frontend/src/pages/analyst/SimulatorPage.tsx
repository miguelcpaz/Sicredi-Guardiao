/**
 * Simulator Page — technical demo tool for analysts
 */
import { useState } from 'react'
import AnalystLayout from '../../components/layout/AnalystLayout'
import { Card, Button, AlertBox, Spinner } from '../../components/ui/index'
import { listScenarios, prepareScenario, resetSimulator } from '../../api/client'
import { useEffect } from 'react'

interface Scenario {
  id: string
  name: string
  description: string
  associate: string
  recipient: string
  amount: string
  expected_risk: string
}

export default function SimulatorPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [instructions, setInstructions] = useState<string[]>([])
  const [activeScenario, setActiveScenario] = useState<string | null>(null)

  useEffect(() => {
    listScenarios()
      .then((r) => setScenarios(r.data as Scenario[]))
      .finally(() => setLoading(false))
  }, [])

  const handlePrepare = async (id: string) => {
    setPreparing(id)
    setSuccessMsg('')
    setErrorMsg('')
    try {
      const r = await prepareScenario(id)
      const data = r.data as { message: string; instructions: string[] }
      setSuccessMsg(data.message)
      setInstructions(data.instructions || [])
      setActiveScenario(id)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorMsg(detail || 'Erro ao preparar cenário.')
    } finally {
      setPreparing(null)
    }
  }

  const handleReset = async () => {
    if (!window.confirm('Confirma o reset do banco de dados para o estado inicial de demonstração? Todas as transações serão removidas.')) return
    setResetting(true)
    setSuccessMsg('')
    setErrorMsg('')
    try {
      const r = await resetSimulator()
      setSuccessMsg((r.data as { message: string }).message)
      setInstructions([])
      setActiveScenario(null)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorMsg(detail || 'Erro ao resetar simulador.')
    } finally {
      setResetting(false)
    }
  }

  const RISK_COLORS: Record<string, string> = {
    low: '#005B2B',
    medium: '#d97706',
    high: '#dc2626',
  }

  const RISK_LABELS: Record<string, string> = {
    low: 'Baixo Risco',
    medium: 'Risco Médio',
    high: 'Alto Risco',
  }

  return (
    <AnalystLayout>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2328' }}>⚙️ Simulador Técnico</h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            Cenários de demonstração acadêmica — IBM AI Experiential Learning Lab 2026
          </p>
        </div>
        <Button
          variant="danger"
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? <Spinner size={16} /> : '🔄'} Resetar Banco de Dados
        </Button>
      </div>

      <div style={{
        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
        padding: '0.75rem 1rem', marginBottom: '1.5rem',
      }}>
        <p style={{ fontSize: '0.85rem', color: '#92400e', margin: 0 }}>
          ⚠️ <strong>Ambiente de Demonstração Acadêmica.</strong> Este simulador prepara dados fictícios controlados
          para apresentações. O motor antifraude real é sempre executado — não há resultados artificiais.
          Todas as ações são auditadas.
        </p>
      </div>

      {successMsg && (
        <AlertBox type="success" message={successMsg} onClose={() => setSuccessMsg('')} style={{ marginBottom: '1rem' }} />
      )}
      {errorMsg && (
        <AlertBox type="error" message={errorMsg} onClose={() => setErrorMsg('')} style={{ marginBottom: '1rem' }} />
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner size={36} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {scenarios.map((s) => (
            <Card key={s.id} style={{ border: activeScenario === s.id ? '2px solid #005B2B' : '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{
                      background: '#1f2328', color: '#fff',
                      borderRadius: 6, padding: '0.15rem 0.5rem',
                      fontWeight: 700, fontSize: '0.82rem',
                    }}>
                      Cenário {s.id}
                    </span>
                    <span style={{
                      color: RISK_COLORS[s.expected_risk] || '#1f2328',
                      fontWeight: 700, fontSize: '0.78rem',
                    }}>
                      {RISK_LABELS[s.expected_risk] || s.expected_risk}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2328' }}>{s.name}</h3>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem', lineHeight: 1.5 }}>
                {s.description}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 0.15rem' }}>Associado</p>
                  <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>@{s.associate}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 0.15rem' }}>Valor</p>
                  <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>R$ {s.amount}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 0.15rem' }}>Destinatário</p>
                  <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.recipient}</p>
                </div>
              </div>

              <Button
                onClick={() => handlePrepare(s.id)}
                disabled={preparing === s.id}
                fullWidth
                variant={activeScenario === s.id ? 'secondary' : 'primary'}
              >
                {preparing === s.id ? <Spinner size={16} /> : null}
                {preparing === s.id ? 'Preparando...' : '▶ Preparar Cenário'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Instructions */}
      {activeScenario && instructions.length > 0 && (
        <Card style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontWeight: 700, color: '#1f2328', marginBottom: '1rem', fontSize: '1rem' }}>
            📋 Roteiro — Cenário {activeScenario}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {instructions.map((step, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                  padding: '0.6rem 0.75rem',
                  background: '#f9fafb', borderRadius: 6,
                  fontSize: '0.875rem', color: '#1f2328',
                }}
              >
                {step}
              </div>
            ))}
          </div>
        </Card>
      )}
    </AnalystLayout>
  )
}

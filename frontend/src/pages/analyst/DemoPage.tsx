/**
 * Demo Mode Page — IBM presentation scenarios
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AnalystLayout from '../../components/layout/AnalystLayout'
import { Card, Button, Badge } from '../../components/ui/index'
import { prepareScenario, resetSimulator } from '../../api/client'

interface Scenario {
  id: string
  title: string
  description: string
  steps: string[]
  risk: 'low' | 'medium' | 'high'
  action: string
}

const SCENARIOS: Scenario[] = [
  {
    id: 'normal_pix',
    title: 'Cenário 1 — PIX Normal',
    description: 'O associado Carlos realiza um PIX de baixo valor para um destinatário conhecido. O motor antifraude classifica como baixo risco e aprova automaticamente.',
    steps: [
      'Login como Carlos (associado)',
      'Navegue para Fazer PIX',
      'Chave: cpf • Destinatário: Supermercado Esperança • Valor: R$ 45,00',
      'Observe a análise antifraude em tempo real',
      'Resultado: Aprovado ✅',
    ],
    risk: 'low',
    action: 'Preparar Cenário Normal',
  },
  {
    id: 'suspicious_pix',
    title: 'Cenário 2 — Transação Suspeita',
    description: 'O associado Beatriz tenta um PIX de alto valor para destinatário desconhecido fora do horário típico. Múltiplos fatores de risco são ativados.',
    steps: [
      'Login como Beatriz (associado)',
      'Navegue para Fazer PIX',
      'Chave: email • Destinatário: Novo Contato • Valor: R$ 4.500,00',
      'Motor identifica: valor alto + destinatário desconhecido + horário atípico',
      'Resultado: Transação Retida / Bloqueada ⚠️',
    ],
    risk: 'high',
    action: 'Preparar Cenário Suspeito',
  },
  {
    id: 'investigation',
    title: 'Cenário 3 — Investigação Inteligente',
    description: 'O analista Ana Ferreira recebe um alerta de alto risco, abre os detalhes, consulta o Guardião IA e registra uma decisão fundamentada.',
    steps: [
      'Login como ana.ferreira (analista)',
      'Acesse Alertas no menu lateral',
      'Clique em um alerta de alto risco',
      'Analise o score, fatores e explicação da IA',
      'Use o Guardião IA para suporte contextual',
      'Registre a decisão: Investigar / Aprovar / Bloquear',
    ],
    risk: 'high',
    action: 'Ver Alertas',
  },
]

const riskColors = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
} as const

const riskLabels = { low: 'Baixo Risco', medium: 'Médio Risco', high: 'Alto Risco' }

export default function DemoPage() {
  const navigate = useNavigate()
  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState('')
  const [step, setStep] = useState(0)

  const handlePrepare = async (s: Scenario) => {
    setLoading(true)
    setActiveScenario(s.id)
    setStep(0)
    setMessage('')
    try {
      await prepareScenario(s.id)
      setMessage(`✅ Cenário "${s.title}" preparado. Siga os passos abaixo.`)
    } catch {
      setMessage('⚠️ Cenário preparado com dados padrão. Siga os passos.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await resetSimulator()
      setMessage('✅ Sistema reinicializado com dados demonstrativos.')
      setActiveScenario(null)
      setStep(0)
    } catch {
      setMessage('⚠️ Reinicialização parcial. Alguns dados podem persistir.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <AnalystLayout>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              🎯 Modo Demonstração IBM
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
              Cenários reproduzíveis para apresentação do Sicredi Guardião 3.0
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleReset} loading={resetting}>
            🔄 Reinicializar Dados
          </Button>
        </div>

        {message && (
          <div style={{
            padding: '0.75rem 1rem', marginBottom: '1.5rem',
            background: 'var(--green-100)', border: '1px solid var(--green-200)',
            borderRadius: 8, fontSize: '0.9rem', color: 'var(--green-700)',
          }}>
            {message}
          </div>
        )}

        {/* Introduction */}
        <Card style={{ marginBottom: '1.5rem', background: 'var(--surface-2)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            🎬 Roteiro de Apresentação (~5–7 min)
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Esta tela guia a demonstração do Sicredi Guardião para a IBM. Selecione um cenário abaixo para preparar os dados, siga os passos indicados e navegue entre os portais. Todos os dados são fictícios e destinados exclusivamente à demonstração.
          </p>
        </Card>

        {/* Scenarios */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {SCENARIOS.map((s, idx) => (
            <Card key={s.id} style={{
              borderLeft: activeScenario === s.id ? '4px solid var(--green-600)' : '4px solid var(--border)',
              padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--green-700)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                  }}>{idx + 1}</div>
                  <div>
                    <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem', margin: 0 }}>{s.title}</h3>
                    <Badge variant={riskColors[s.risk]}>{riskLabels[s.risk]}</Badge>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button
                    variant={activeScenario === s.id ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => handlePrepare(s)}
                    loading={loading && activeScenario === s.id}
                  >
                    {s.action}
                  </Button>
                  {s.id === 'investigation' && (
                    <Button variant="ghost" size="sm" onClick={() => navigate('/analyst/alerts')}>
                      Ir para Alertas →
                    </Button>
                  )}
                </div>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{s.description}</p>

              {activeScenario === s.id && (
                <div style={{ marginTop: '0.75rem', animation: 'fadeIn 0.2s ease' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Passos:</p>
                  <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {s.steps.map((st, i) => (
                      <li
                        key={i}
                        onClick={() => setStep(i)}
                        style={{
                          fontSize: '0.875rem',
                          color: i <= step ? 'var(--text-primary)' : 'var(--text-muted)',
                          fontWeight: i === step ? 600 : 400,
                          cursor: 'pointer',
                          padding: '0.2rem 0',
                          borderLeft: i === step ? '2px solid var(--green-600)' : '2px solid transparent',
                          paddingLeft: '0.5rem',
                          marginLeft: '-0.75rem',
                          listStyle: 'none',
                          transition: 'all 0.1s',
                        }}
                      >
                        {i < step ? '✅ ' : i === step ? '▶ ' : '○ '}{st}
                      </li>
                    ))}
                  </ol>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <Button variant="secondary" size="sm" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                      ← Anterior
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => setStep(Math.min(s.steps.length - 1, step + 1))} disabled={step === s.steps.length - 1}>
                      Próximo →
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Quick navigation */}
        <Card style={{ background: 'var(--surface-2)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Navegação Rápida</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {[
              { label: '⊞ Dashboard Analista', path: '/analyst/dashboard' },
              { label: '⚠ Central de Alertas', path: '/analyst/alerts' },
              { label: '🔎 Investigações', path: '/analyst/investigations' },
              { label: '🤖 Guardião IA', path: '/analyst/ai-chat' },
              { label: '⚙ Simulador', path: '/analyst/simulator' },
            ].map(item => (
              <Button key={item.path} variant="secondary" size="sm" onClick={() => navigate(item.path)}>
                {item.label}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </AnalystLayout>
  )
}

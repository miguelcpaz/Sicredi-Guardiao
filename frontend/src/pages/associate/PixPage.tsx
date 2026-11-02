/**
 * PIX Transfer Page — full flow: form → confirm → processing → result
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, ShieldX, XCircle, AlertTriangle } from 'lucide-react'
import AssociateLayout from '../../components/layout/AssociateLayout'
import { Card, Button, Input, AlertBox, Spinner, formatCurrency } from '../../components/ui/index'
import { createPixTransfer } from '../../api/client'
import type { PixTransferResponse } from '../../api/client'

type Step = 'form' | 'confirm' | 'processing' | 'result'

export default function PixPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')
  const [pixKey, setPixKey] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<PixTransferResponse | null>(null)
  const [apiError, setApiError] = useState('')

  const validate = () => {
    const e: Record<string, string> = {}
    if (!pixKey.trim()) e.pixKey = 'Informe a chave PIX.'
    if (!recipientName.trim()) e.recipientName = 'Informe o nome do destinatário.'
    const v = parseFloat(amount.replace(',', '.'))
    if (isNaN(v) || v <= 0) e.amount = 'Informe um valor válido.'
    return e
  }

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    setErrors({})
    setStep('confirm')
  }

  const handleConfirm = async () => {
    setStep('processing')
    setApiError('')
    try {
      const amtStr = parseFloat(amount.replace(',', '.')).toFixed(2)
      const resp = await createPixTransfer({
        pix_key: pixKey,
        recipient_name: recipientName,
        amount: amtStr,
        description,
      })
      setResult(resp.data)
      setStep('result')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setApiError(msg || 'Erro ao processar transferência. Tente novamente.')
      setStep('form')
    }
  }

  const handleNewPix = () => {
    setPixKey(''); setRecipientName(''); setAmount(''); setDescription('')
    setResult(null); setErrors({}); setApiError('')
    setStep('form')
  }

  const amountNum = parseFloat(amount.replace(',', '.')) || 0

  return (
    <AssociateLayout>
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Fazer PIX</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Transferência instantânea</p>
        </div>

        {apiError && <AlertBox type="error" message={apiError} onClose={() => setApiError('')} style={{ marginBottom: '1rem' }} />}

        {/* Step: Form */}
        {step === 'form' && (
          <Card>
            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <Input
                label="Chave PIX do Destinatário"
                value={pixKey}
                onChange={setPixKey}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                required
                error={errors.pixKey}
                hint="Exemplo: joao@email.com ou 000.000.000-00"
              />
              <Input
                label="Nome do Destinatário"
                value={recipientName}
                onChange={setRecipientName}
                placeholder="Nome completo ou empresa"
                required
                error={errors.recipientName}
              />
              <Input
                label="Valor"
                value={amount}
                onChange={setAmount}
                placeholder="0,00"
                prefix="R$"
                required
                error={errors.amount}
                hint="Use vírgula ou ponto como separador decimal"
              />
              <Input
                label="Descrição (opcional)"
                value={description}
                onChange={setDescription}
                placeholder="Ex: pagamento aluguel"
              />
              <Button type="submit" fullWidth>Continuar</Button>
            </form>
          </Card>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <Card>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              Confirmar Transferência
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Destinatário', value: recipientName },
                { label: 'Chave PIX', value: pixKey },
                { label: 'Valor', value: formatCurrency(amountNum) },
                { label: 'Descrição', value: description || '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--yellow-100)', border: '1px solid var(--yellow-200)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1.5rem' }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--yellow-600)', margin: 0 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                Verifique os dados antes de confirmar. PIX não pode ser cancelado após o processamento.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="secondary" onClick={() => setStep('form')} fullWidth>Voltar</Button>
              <Button onClick={handleConfirm} fullWidth>Confirmar PIX</Button>
            </div>
          </Card>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <Card style={{ textAlign: 'center', padding: '3rem' }}>
            <Spinner size={40} />
            <p style={{ marginTop: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Processando sua transferência...
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
              Aguarde enquanto verificamos sua operação.
            </p>
          </Card>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <Card>
            {result.result_screen === 'approved' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={48} style={{ color: 'var(--green-600)' }} /></div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--green-600)', marginBottom: '0.5rem' }}>
                  PIX Realizado com Sucesso!
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  {result.message}
                </p>
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Destinatário</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{recipientName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Valor transferido</span>
                    <span style={{ fontWeight: 700, color: 'var(--green-600)', fontSize: '1.1rem' }}>{formatCurrency(amountNum)}</span>
                  </div>
                </div>
              </div>
            )}

            {result.result_screen === 'retained' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}><Clock size={48} style={{ color: 'var(--yellow-600)' }} /></div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--yellow-600)', marginBottom: '0.5rem' }}>
                  Verificação de Segurança
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  {result.message}
                </p>
                <div style={{ background: 'var(--yellow-100)', border: '1px solid var(--yellow-200)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--yellow-600)', margin: 0 }}>
                    Sua equipe de segurança irá verificar esta operação e entrará em contato caso necessário.
                    O valor <strong>não foi debitado</strong> da sua conta.
                  </p>
                </div>
              </div>
            )}

            {result.result_screen === 'blocked' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}><ShieldX size={48} style={{ color: 'var(--red-600)' }} /></div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--red-600)', marginBottom: '0.5rem' }}>
                  Transferência Não Concluída
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  {result.message}
                </p>
                <div style={{ background: 'var(--red-100)', border: '1px solid var(--red-200)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--red-600)', margin: 0 }}>
                    Sua transferência foi bloqueada por motivos de segurança.
                    O valor <strong>não foi debitado</strong>. Aguarde o contato da equipe de segurança.
                  </p>
                </div>
              </div>
            )}

            {result.result_screen === 'insufficient_funds' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}><XCircle size={48} style={{ color: 'var(--red-600)' }} /></div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--red-600)', marginBottom: '0.5rem' }}>
                  Saldo Insuficiente
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{result.message}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => navigate('/associate/dashboard')} fullWidth>
                Ir para Início
              </Button>
              <Button onClick={handleNewPix} fullWidth>Novo PIX</Button>
            </div>
          </Card>
        )}
      </div>
    </AssociateLayout>
  )
}

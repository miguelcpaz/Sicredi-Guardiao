/**
 * Complete API client for Sicredi Guardião V2.
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoginResponse {
  access_token: string
  token_type: string
  role: string
  username: string
  full_name: string
}

export interface UserOut {
  id: number
  username: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export interface PixTransferRequest {
  pix_key: string
  recipient_name: string
  amount: string
  description?: string
}

export interface PixTransferResponse {
  pix_transfer_id: number
  status: string
  result_screen: string
  transaction_id?: number
  risk_score?: number
  risk_level?: string
  message: string
  alert_id?: number
}

export interface PixTransfer {
  id: number
  pix_key: string
  recipient_name: string
  amount: number
  description: string
  status: string
  transaction_id?: number
  initiated_at: string
  processed_at?: string
}

export interface TransactionOut {
  id: number
  associate_id: number
  amount: number
  merchant: string
  category: string
  location: string
  mode: string
  status: string
  timestamp: string
  created_at: string
}

export interface Notification {
  id: number
  title: string
  message: string
  is_read: boolean
  created_at: string
  alert_id?: number
}

export interface AssociateDashboard {
  balance: number
  account_number: string
  full_name: string
  pending_alerts: number
  total_transactions: number
  unread_notifications: number
  recent_transactions: {
    id: number
    amount: number
    merchant: string
    status: string
    timestamp: string
    mode: string
  }[]
}

export interface AnalystDashboard {
  full_name: string
  total_transactions: number
  total_volume: number
  pending_alerts: number
  retained_transactions: number
  blocked_transactions: number
  investigating_count: number
  resolved_count: number
  unread_notifications: number
  associates_count: number
  risk_distribution: Record<string, number>
  time_series: { date: string; count: number; volume: number }[]
  recent_alerts: {
    id: number
    risk_score: number
    risk_level: string
    status: string
    amount: number
    merchant: string
    associate_name: string
    created_at: string
  }[]
}

export interface WalletAssociate {
  id: number
  user_id: number
  account_number: string
  balance: number
  full_name: string
  username: string
  email: string
  is_active: boolean
  pending_alerts: number
  total_transactions: number
}

export interface AlertDetail {
  alert: {
    id: number
    risk_score: number
    risk_level: string
    status: string
    response: string | null
    created_at: string
  }
  transaction: {
    id: number
    amount: number
    merchant: string
    category: string
    location: string
    mode: string
    status: string
    timestamp: string
  }
  associate: {
    id: number
    full_name: string
    username: string
    account_number: string
    user_id: number
  }
  risk_analysis: {
    risk_score: number
    risk_level: string
    explanation: string
    provider: string
    signals: {
      rule_id: string
      rule_name: string
      triggered: boolean
      score_contribution: number
      evidence: string
    }[]
  } | null
  incidents: { id: number; status: string; description: string; created_at: string }[]
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const login = (username: string, password: string) =>
  api.post<LoginResponse>('/auth/login', { username, password })

export const getMe = () => api.get<UserOut>('/auth/me')

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export const getAssociateDashboard = () =>
  api.get<AssociateDashboard>('/dashboard/associate')

export const getAnalystDashboard = () =>
  api.get<AnalystDashboard>('/dashboard/analyst')

// ---------------------------------------------------------------------------
// PIX
// ---------------------------------------------------------------------------
export const createPixTransfer = (data: PixTransferRequest) =>
  api.post<PixTransferResponse>('/pix/transfer', data)

export const listPixTransfers = () =>
  api.get<PixTransfer[]>('/pix/transfers')

// ---------------------------------------------------------------------------
// Transactions (associate)
// ---------------------------------------------------------------------------
export const listTransactions = (associate_id?: number) =>
  api.get<TransactionOut[]>('/transactions', { params: associate_id ? { associate_id } : {} })

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const listNotifications = () =>
  api.get<Notification[]>('/notifications')

export const getUnreadCount = () =>
  api.get<{ count: number }>('/notifications/unread-count')

export const markNotificationRead = (id: number) =>
  api.patch(`/notifications/${id}/read`)

export const markAllNotificationsRead = () =>
  api.patch('/notifications/read-all')

export const respondToNotification = (id: number, response: 'recognized' | 'unrecognized') =>
  api.post(`/notifications/${id}/respond`, { response })

export const sendNotification = (data: {
  associate_user_id: number
  title: string
  message: string
  alert_id?: number
}) => api.post('/notifications/send', data)

// ---------------------------------------------------------------------------
// Wallet (analyst)
// ---------------------------------------------------------------------------
export const listWalletAssociates = () =>
  api.get<WalletAssociate[]>('/wallet/associates')

export const getWalletAssociate = (id: number) =>
  api.get('/wallet/associates/' + id)

export const getAssociateTransactions = (id: number) =>
  api.get('/wallet/associates/' + id + '/transactions')

export const getAssociateAlerts = (id: number) =>
  api.get('/wallet/associates/' + id + '/alerts')

// ---------------------------------------------------------------------------
// Analyst alerts & actions
// ---------------------------------------------------------------------------
export const listAnalystAlerts = () =>
  api.get('/analyst/alerts')

export const getAlertDetail = (id: number) =>
  api.get<AlertDetail>('/analyst/alerts/' + id)

export const takeAlertAction = (id: number, action: string, data: {
  justification?: string
  notification_message?: string
}) => api.patch('/analyst/alerts/' + id + '/action', { action, ...data })

export const listIncidents = () =>
  api.get('/analyst/incidents')

export const getTransactionDetail = (id: number) =>
  api.get('/analyst/transactions/' + id + '/detail')

// ---------------------------------------------------------------------------
// Guardião AI chat — analyst
// ---------------------------------------------------------------------------
export const getAIStatus = () =>
  api.get('/ai/status')

export const createChatSession = (transaction_id: number) =>
  api.post('/ai/sessions', { transaction_id })

export const createFreeChatSession = () =>
  api.post('/ai/sessions/free')

export const renameChatSession = (session_id: number, title: string) =>
  api.patch('/ai/sessions/' + session_id + '/rename', { title })

export const deleteChatSession = (session_id: number) =>
  api.delete('/ai/sessions/' + session_id)

export const sendChatMessage = (session_id: number, message: string) =>
  api.post('/ai/sessions/' + session_id + '/message', { message })

export const getChatMessages = (session_id: number) =>
  api.get<ChatMessage[]>('/ai/sessions/' + session_id + '/messages')

export const listChatSessions = () =>
  api.get('/ai/sessions')

// ---------------------------------------------------------------------------
// Guardião AI chat — associate
// ---------------------------------------------------------------------------
export const createAssociateChatSession = () =>
  api.post('/ai/associate/sessions')

export const listAssociateChatSessions = () =>
  api.get('/ai/associate/sessions')

export const deleteAssociateChatSession = (session_id: number) =>
  api.delete('/ai/associate/sessions/' + session_id)

export const sendAssociateChatMessage = (session_id: number, message: string) =>
  api.post('/ai/associate/sessions/' + session_id + '/message', { message })

export const getAssociateChatMessages = (session_id: number) =>
  api.get('/ai/associate/sessions/' + session_id + '/messages')

/**
 * Stream a Guardião AI response via Fetch + ReadableStream.
 * Returns a cancel function.
 */
export function streamAnalystMessage(
  session_id: number,
  message: string,
  token: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  const url = `/api/v1/ai/sessions/${session_id}/stream?message=${encodeURIComponent(message)}`
  let aborted = false
  const controller = new AbortController()

  fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok || !res.body) { onError('Erro na conexão com o Guardião AI.'); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const pump = (): Promise<void> =>
        reader.read().then(({ value, done }) => {
          if (done || aborted) { onDone(); return }
          const text = decoder.decode(value, { stream: true })
          text.split('\n').forEach((line) => {
            if (!line.startsWith('data: ')) return
            try {
              const d = JSON.parse(line.slice(6))
              if (d.done) { onDone(); return }
              if (d.error) { onError(d.token || 'Erro no Guardião AI.'); return }
              if (d.token) onToken(d.token.replace(/\\n/g, '\n'))
            } catch { /* ignore malformed lines */ }
          })
          return pump()
        })
      pump().catch((e) => { if (!aborted) onError(String(e)) })
    })
    .catch((e) => { if (!aborted) onError(String(e)) })

  return () => { aborted = true; controller.abort() }
}

export function streamAssociateMessage(
  session_id: number,
  message: string,
  token: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  const url = `/api/v1/ai/associate/sessions/${session_id}/stream?message=${encodeURIComponent(message)}`
  let aborted = false
  const controller = new AbortController()

  fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok || !res.body) { onError('Erro na conexão com o Guardião IA.'); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const pump = (): Promise<void> =>
        reader.read().then(({ value, done }) => {
          if (done || aborted) { onDone(); return }
          const text = decoder.decode(value, { stream: true })
          text.split('\n').forEach((line) => {
            if (!line.startsWith('data: ')) return
            try {
              const d = JSON.parse(line.slice(6))
              if (d.done) { onDone(); return }
              if (d.error) { onError(d.token || 'Erro no assistente.'); return }
              if (d.token) onToken(d.token.replace(/\\n/g, '\n'))
            } catch { /* ignore */ }
          })
          return pump()
        })
      pump().catch((e) => { if (!aborted) onError(String(e)) })
    })
    .catch((e) => { if (!aborted) onError(String(e)) })

  return () => { aborted = true; controller.abort() }
}

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------
export const listScenarios = () =>
  api.get('/simulator/scenarios')

export const prepareScenario = (id: string) =>
  api.post('/simulator/scenario/' + id)

export const resetSimulator = () =>
  api.post('/simulator/reset')

export default api

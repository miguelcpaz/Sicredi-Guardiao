import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './contexts/ThemeContext'

// Auth
import LoginPage from './pages/auth/LoginPage'

// Associate portal
import AssociateDashboard from './pages/associate/DashboardPage'
import PixPage from './pages/associate/PixPage'
import ExtratoPage from './pages/associate/ExtratoPage'
import NotificationsPage from './pages/associate/NotificationsPage'
import SecurityPage from './pages/associate/SecurityPage'
import AssociateAIChatPage from './pages/associate/AIChatPage'

// Analyst portal
import AnalystDashboard from './pages/analyst/DashboardPage'
import WalletPage from './pages/analyst/WalletPage'
import AlertsPage from './pages/analyst/AlertsPage'
import AlertDetailPage from './pages/analyst/AlertDetailPage'
import InvestigationsPage from './pages/analyst/InvestigationsPage'
import AIChatPage from './pages/analyst/AIChatPage'
import SimulatorPage from './pages/analyst/SimulatorPage'
import DemoPage from './pages/analyst/DemoPage'

// Admin portal
import AdminDashboard from './pages/admin/DashboardPage'
import AdminLayout from './components/layout/AdminLayout'

// Protected route
function RequireAuth({ children, role }: { children: React.ReactElement; role?: string | string[] }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--green-600)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (role) {
    const roles = Array.isArray(role) ? role : [role]
    if (!roles.includes(user.role)) return <Navigate to="/login" replace />
  }
  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Associate routes */}
      <Route path="/associate/dashboard" element={<RequireAuth role="associate"><AssociateDashboard /></RequireAuth>} />
      <Route path="/associate/pix" element={<RequireAuth role="associate"><PixPage /></RequireAuth>} />
      <Route path="/associate/extrato" element={<RequireAuth role="associate"><ExtratoPage /></RequireAuth>} />
      <Route path="/associate/notifications" element={<RequireAuth role="associate"><NotificationsPage /></RequireAuth>} />
      <Route path="/associate/security" element={<RequireAuth role="associate"><SecurityPage /></RequireAuth>} />
      <Route path="/associate/ai-chat" element={<RequireAuth role="associate"><AssociateAIChatPage /></RequireAuth>} />

      {/* Analyst routes */}
      <Route path="/analyst/dashboard" element={<RequireAuth role="analyst"><AnalystDashboard /></RequireAuth>} />
      <Route path="/analyst/wallet" element={<RequireAuth role="analyst"><WalletPage /></RequireAuth>} />
      <Route path="/analyst/transactions/:id" element={<RequireAuth role="analyst"><AlertDetailPage /></RequireAuth>} />
      <Route path="/analyst/alerts" element={<RequireAuth role="analyst"><AlertsPage /></RequireAuth>} />
      <Route path="/analyst/alerts/:id" element={<RequireAuth role="analyst"><AlertDetailPage /></RequireAuth>} />
      <Route path="/analyst/investigations" element={<RequireAuth role="analyst"><InvestigationsPage /></RequireAuth>} />
      <Route path="/analyst/ai-chat" element={<RequireAuth role="analyst"><AIChatPage /></RequireAuth>} />
      <Route path="/analyst/simulator" element={<RequireAuth role="analyst"><SimulatorPage /></RequireAuth>} />
      <Route path="/analyst/demo" element={<RequireAuth role="analyst"><DemoPage /></RequireAuth>} />

      {/* Admin routes */}
      <Route path="/admin/dashboard" element={
        <RequireAuth role="admin">
          <AdminLayout><AdminDashboard /></AdminLayout>
        </RequireAuth>
      } />

      {/* Default redirect */}
      <Route
        path="/"
        element={
          user
            ? <Navigate to={
                user.role === 'associate' ? '/associate/dashboard' :
                user.role === 'admin' ? '/admin/dashboard' :
                '/analyst/dashboard'
              } replace />
            : <Navigate to="/login" replace />
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

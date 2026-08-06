import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SettingsPage from './pages/SettingsPage'
import CallsPage from './pages/CallsPage'
import CallReportPage from './pages/CallReportPage'
import UsagePage from './pages/UsagePage'
import ProfilePage from './pages/ProfilePage'
import LoginPage from './pages/LoginPage'
import MainLayout from './layouts/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      {/* Standalone protected routes (no MainLayout) */}
      <Route path="/calls/:id/report" element={
        <ProtectedRoute>
          <CallReportPage />
        </ProtectedRoute>
      } />
      
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<HomePage />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="usage" element={
          <ProtectedRoute allowedRoles={['super_admin']}><UsagePage /></ProtectedRoute>
        } />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback for unmatched routes */}
      <Route path="*" element={<LoginPage />} />
    </Routes>
  )
}

export default App
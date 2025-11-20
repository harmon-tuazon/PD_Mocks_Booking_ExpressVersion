import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute'
import MockExams from './pages/MockExams'
import MockExamsDashboard from './pages/MockExamsDashboard'
import MockExamDetail from './pages/MockExamDetail'
import TraineeDashboard from './pages/TraineeDashboard'
import Login from './pages/Login'
import PasswordReset from './pages/PasswordReset'
import MainLayout from './components/layout/MainLayout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      cacheTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          // Default duration for all toasts
          duration: 4000,
          // Global base styling
          style: {
            padding: '16px 20px',
            fontSize: '15px',
            fontWeight: '500',
            minWidth: '300px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
          },
          // Success toast styling
          success: {
            duration: 4000,
            style: {
              background: '#10B981',
              color: '#ffffff',
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#10B981',
            },
          },
          // Error toast styling
          error: {
            duration: 5000,
            style: {
              background: '#EF4444',
              color: '#ffffff',
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#EF4444',
            },
          },
        }}
      />
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<PasswordReset />} />

              <Route
                path="/"
                element={
                  <ProtectedAdminRoute>
                    <MainLayout />
                  </ProtectedAdminRoute>
                }
              >
                {/* Redirect root to mock-exams */}
                <Route index element={<Navigate to="/mock-exams" replace />} />

                {/* Mock Exams Dashboard - List View */}
                <Route path="mock-exams" element={<MockExamsDashboard />} />

                {/* Mock Exams Creation - Form View */}
                <Route path="mock-exams/create" element={<MockExams />} />

                {/* Mock Exam Detail View */}
                <Route path="mock-exams/:id" element={<MockExamDetail />} />

                {/* Trainee Dashboard */}
                <Route path="trainees" element={<TraineeDashboard />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute'
import MockExams from './pages/MockExams'
import MockExamsDashboard from './pages/MockExamsDashboard'
import MockExamDetail from './pages/MockExamDetail'
import Login from './pages/Login'
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
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

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
              </Route>
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App

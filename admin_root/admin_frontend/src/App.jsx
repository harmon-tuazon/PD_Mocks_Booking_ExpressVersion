import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import MockExams from './pages/MockExams'
import Reports from './pages/Reports'
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
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check for admin token
    const token = localStorage.getItem('adminToken')
    setIsAuthenticated(!!token)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login setAuth={setIsAuthenticated} />} />

          <Route
            path="/"
            element={
              isAuthenticated ? (
                <MainLayout />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="mock-exams" element={<MockExams />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  )
}

export default App
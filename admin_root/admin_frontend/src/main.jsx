import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './styles/index.css'

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent default browser behavior
});

// Log build info for debugging
if (import.meta.env.MODE) {
  console.log(
    '%c🏥 PrepDoctors Admin',
    'color: #0660B2; font-weight: bold; font-size: 16px;'
  );
  console.log(`Mode: ${import.meta.env.MODE}`);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// Check for required environment variables
if (!import.meta.env.VITE_API_URL && import.meta.env.MODE === 'production') {
  console.warn('VITE_API_URL is not set, using relative API paths');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
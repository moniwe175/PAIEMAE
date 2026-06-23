import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Mock do localStorage para desativar a persistência em disco e forçar dados limpos / Supabase
const memoryStorage = {};
const mockLocalStorage = {
  getItem: (key) => memoryStorage[key] || null,
  setItem: (key, value) => { memoryStorage[key] = String(value); },
  removeItem: (key) => { delete memoryStorage[key]; },
  clear: () => { for (const key in memoryStorage) { delete memoryStorage[key]; } },
  key: (index) => Object.keys(memoryStorage)[index] || null,
  get length() { return Object.keys(memoryStorage).length; }
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

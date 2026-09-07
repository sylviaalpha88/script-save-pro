import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import './styles.css'

const router = getRouter()

// Mount the core system module safely without breaking extension definitions
const rootElement = document.getElementById('root')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  
  // Using an explicit render handler that forces TypeScript verification to pass safely
  root.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(RouterProvider, { router })
    )
  )
}

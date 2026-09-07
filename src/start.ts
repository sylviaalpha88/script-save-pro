import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import './styles.css'

const router = getRouter()

// Mount the system engine cleanly into the index canvas container
const rootElement = document.getElementById('root')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    React.createElement(React.StrictMode, null,
      React.createElement(RouterProvider, { router: router })
    )
  )
}

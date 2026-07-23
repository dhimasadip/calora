import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ToastViewport } from './components/ui/toast'
import { ConfirmModalViewport } from './components/ui/confirm-modal'
import './styles/globals.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}><App /><ToastViewport /><ConfirmModalViewport /></QueryClientProvider>
  </React.StrictMode>
)

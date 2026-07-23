import { useEffect, useState } from 'react'

export const TOAST_EVENT = 'calora:toast'

type ToastDetail = { message: string }
type Toast = ToastDetail & { id: number }

export function showErrorToast(message: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message } }))
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const addToast = (event: Event) => {
      const message = (event as CustomEvent<ToastDetail>).detail?.message
      if (!message) return
      const id = Date.now()
      setToasts((current) => [...current, { id, message }].slice(-3))
      window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5_000)
    }
    window.addEventListener(TOAST_EVENT, addToast)
    return () => window.removeEventListener(TOAST_EVENT, addToast)
  }, [])

  return (
    <div className="fixed right-4 top-4 z-[100] grid w-[min(24rem,calc(100vw-2rem))] gap-2" aria-live="assertive" aria-atomic="true">
      {toasts.map((toast) => <div key={toast.id} role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-900 shadow-xl"><span className="mt-px text-red-600" aria-hidden="true">!</span><p className="flex-1">{toast.message}</p><button type="button" className="text-lg leading-none text-red-700" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss error">×</button></div>)}
    </div>
  )
}

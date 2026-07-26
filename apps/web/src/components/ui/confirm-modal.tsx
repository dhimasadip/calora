import { useCallback, useEffect, useRef, useState } from 'react'

const CONFIRM_EVENT = 'calora:confirm'

type ConfirmOptions = {
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
}

type ConfirmRequest = ConfirmOptions & { resolve: (confirmed: boolean) => void }

export function showConfirmModal(options: ConfirmOptions) {
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmRequest>(CONFIRM_EVENT, { detail: { ...options, resolve } }))
  })
}

export function ConfirmModalViewport() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const open = (event: Event) => setRequest((event as CustomEvent<ConfirmRequest>).detail)
    window.addEventListener(CONFIRM_EVENT, open)
    return () => window.removeEventListener(CONFIRM_EVENT, open)
  }, [])

  const close = useCallback((confirmed: boolean) => {
    request?.resolve(confirmed)
    setRequest(null)
  }, [request])

  useEffect(() => {
    if (!request) return
    confirmButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [request, close])

  if (!request) return null

  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={() => close(false)}>
      <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-description" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">Please confirm</p>
        <h2 id="confirm-modal-title">{request.title}</h2>
        <p id="confirm-modal-description">{request.description}</p>
        <div className="confirm-actions">
          <button type="button" className="secondary-action" onClick={() => close(false)}>Cancel</button>
          <button ref={confirmButton} type="button" className={request.destructive ? 'danger-action' : 'primary-action'} onClick={() => close(true)}>{request.confirmLabel ?? 'Continue'}</button>
        </div>
      </section>
    </div>
  )
}

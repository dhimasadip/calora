import { useState, type FormEvent } from 'react'
import { api, ApiError } from '@/lib/api'
import type { RedeemPromoResponse } from '@calora/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  // Called after a successful redemption (e.g. to refresh auth + usage state).
  onSuccess?: (result: RedeemPromoResponse) => void
}

export function PromoCodeForm({ onSuccess }: Props) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'redeeming' | 'success'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!code.trim() || status === 'redeeming') return
    setError(null)
    setStatus('redeeming')
    try {
      const result = await api<RedeemPromoResponse>('/promo/redeem', {
        method: 'POST',
        body: { code: code.trim() },
      })
      setStatus('success')
      setCode('')
      onSuccess?.(result)
    } catch (err) {
      setStatus('idle')
      setError(err instanceof ApiError ? err.message : 'Could not redeem code')
    }
  }

  if (status === 'success') {
    return <p className="text-sm font-medium text-primary">🎉 Pro unlocked! Enjoy higher chat limits.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter promo code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1"
        />
        <Button type="submit" disabled={status === 'redeeming' || !code.trim()}>
          {status === 'redeeming' ? 'Redeeming…' : 'Redeem'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}

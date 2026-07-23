import { useEffect, useMemo, useState } from 'react'
import type { AiUsage, ExerciseEntry, FoodEntry, MealType, WorkoutIntensity } from '@calora/shared'
import { ApiError, caloraApi } from '@/lib/api'
import { queueMutation } from '@/lib/offline'

type EntryKind = 'food' | 'workout'
type EntryMode = 'manual' | 'ai'
type EditableEntry = FoodEntry | ExerciseEntry

interface Props {
  kind: EntryKind
  open: boolean
  date?: string
  entry?: EditableEntry | null
  onClose(): void
  onSaved(): void
}

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
const intensities: WorkoutIntensity[] = ['low', 'moderate', 'high']

function isFood(entry: EditableEntry | null | undefined): entry is FoodEntry {
  return Boolean(entry && 'quantity' in entry)
}

function integersOnly(value: string) {
  return value.replace(/\D/g, '')
}

function decimalsOnly(value: string) {
  const cleaned = value.replace(/[^\d,.]/g, '')
  const [whole = '', ...decimalParts] = cleaned.split(/[,.]/)
  return decimalParts.length ? `${whole},${decimalParts.join('')}` : whole
}

function decimalNumber(value: string) {
  return Number(value.replace(',', '.'))
}

export function EntryComposer({ kind, open, date, entry, onClose, onSaved }: Props) {
  const editing = Boolean(entry)
  const initialMode: EntryMode = entry?.source === 'ai' ? 'ai' : 'manual'
  const [mode, setMode] = useState<EntryMode>(initialMode)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [mealType, setMealType] = useState<MealType | ''>('')
  const [workoutType, setWorkoutType] = useState('')
  const [duration, setDuration] = useState('')
  const [intensity, setIntensity] = useState<WorkoutIntensity | ''>('')
  const [notes, setNotes] = useState('')
  const [description, setDescription] = useState('')
  const [rationale, setRationale] = useState('')
  const [estimateReady, setEstimateReady] = useState(false)
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const nextMode: EntryMode = entry?.source === 'ai' ? 'ai' : 'manual'
    setMode(nextMode)
    setError(null)
    setRationale('')
    setEstimateReady(nextMode === 'ai' && Boolean(entry))
    if (!entry) {
      setName('')
      setQuantity('')
      setUnit('')
      setCalories('')
      setProtein('')
      setCarbs('')
      setFat('')
      setMealType('')
      setWorkoutType('')
      setDuration('')
      setIntensity('')
      setNotes('')
      setDescription('')
      return
    }
    setName(entry.name)
    setCalories(String(isFood(entry) ? entry.calories : entry.caloriesBurned))
    setDescription(entry.rawInput ?? '')
    if (isFood(entry)) {
      setQuantity(String(entry.quantity))
      setUnit(entry.unit)
      setProtein(String(entry.proteinG))
      setCarbs(String(entry.carbsG))
      setFat(String(entry.fatG))
      setMealType(entry.mealType)
    } else {
      setWorkoutType(entry.workoutType)
      setDuration(String(entry.durationMinutes))
      setIntensity(entry.intensity)
      setNotes(entry.notes ?? '')
    }
  }, [open, entry, kind])

  useEffect(() => {
    if (!open || mode !== 'ai') return
    void caloraApi.aiUsage().then(setAiUsage).catch(() => undefined)
  }, [open, mode])

  const title = useMemo(() => `${editing ? 'Edit' : 'Add'} ${kind === 'food' ? 'food' : 'workout'}`, [editing, kind])

  if (!open) return null

  function markEstimateStale() {
    if (mode !== 'ai') return
    setEstimateReady(false)
    setRationale('')
  }

  function selectMode(nextMode: EntryMode) {
    setMode(nextMode)
    setError(null)
    setRationale('')
    setEstimateReady(false)
  }

  function estimateDescription() {
    const details = description.trim()
    if (kind === 'food') return [`${quantity} ${unit} ${name}`.trim(), details].filter(Boolean).join('. ')
    return [`${name} for ${duration} minutes`.trim(), details].filter(Boolean).join('. ')
  }

  async function estimate() {
    if (!name.trim()) { setError(`Add a ${kind === 'food' ? 'food' : 'workout'} name first.`); return }
    if (kind === 'food' && (!Number.isFinite(decimalNumber(quantity)) || decimalNumber(quantity) <= 0 || !unit.trim())) { setError('Add a valid quantity and unit.'); return }
    if (kind === 'workout' && (!Number.isFinite(Number(duration)) || Number(duration) <= 0)) { setError('Add a valid workout duration.'); return }
    if (!navigator.onLine) { setError('AI estimates need an internet connection. Switch to Manual to log offline.'); return }
    setError(null)
    setEstimateReady(false)
    setLoading(true)
    try {
      if (kind === 'food') {
        const response = await caloraApi.foodEstimate(estimateDescription())
        const result = response.estimate
        setAiUsage({ limit: response.limit, used: response.used, remaining: response.remaining })
        setCalories(String(result.calories))
        setProtein(String(result.proteinG))
        setCarbs(String(result.carbsG))
        setFat(String(result.fatG))
        setMealType(result.mealType)
        setRationale(result.rationale)
      } else {
        const response = await caloraApi.workoutEstimate(estimateDescription())
        const result = response.estimate
        setAiUsage({ limit: response.limit, used: response.used, remaining: response.remaining })
        setWorkoutType(result.workoutType)
        setDuration(String(result.durationMinutes))
        setIntensity(result.intensity)
        setCalories(String(result.caloriesBurned))
        setRationale(result.rationale)
      }
      setEstimateReady(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create an estimate')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (mode === 'ai' && !estimateReady) { await estimate(); return }
    const kcal = Number(calories)
    const quantityValue = decimalNumber(quantity)
    const durationValue = Number(duration)
    if (!name.trim() || !calories || !Number.isFinite(kcal) || kcal < 0) { setError('Add a name and valid calories before saving.'); return }
    if (kind === 'food' && (!Number.isFinite(quantityValue) || quantityValue <= 0 || !unit.trim())) { setError('Add a valid quantity and unit.'); return }
    if (kind === 'food' && !mealType) { setError('Choose a meal type before saving.'); return }
    if (kind === 'workout' && (!workoutType.trim() || !duration || !Number.isFinite(durationValue) || durationValue <= 0)) { setError('Add a workout type and duration.'); return }
    if (kind === 'workout' && !intensity) { setError('Choose a workout intensity before saving.'); return }
    setError(null)
    setLoading(true)
    const source = mode === 'ai' ? 'ai' : 'manual'
    const body = kind === 'food'
      ? { name, quantity: quantityValue, unit, calories: Math.round(kcal), proteinG: decimalNumber(protein) || 0, carbsG: decimalNumber(carbs) || 0, fatG: decimalNumber(fat) || 0, mealType, date, source, rawInput: source === 'ai' ? description.trim() || null : null }
      : { name, workoutType, durationMinutes: durationValue, intensity, caloriesBurned: Math.round(kcal), notes: notes || null, date, source, rawInput: source === 'ai' ? description.trim() || null : null }
    try {
      if (!navigator.onLine) {
        if (editing && entry) {
          const path = kind === 'food' ? `/food-entries/${entry.id}` : `/exercise-entries/${entry.id}`
          await queueMutation({ method: 'PATCH', path, body: { ...body, expectedVersion: entry.version } })
        } else {
          const path = kind === 'food' ? '/food-entries' : '/exercise-entries'
          await queueMutation({ method: 'POST', path, body, idempotencyKey: crypto.randomUUID() })
        }
      } else if (editing && entry) {
        if (kind === 'food') await caloraApi.updateFood(entry.id, { ...body, expectedVersion: entry.version })
        else await caloraApi.updateWorkout(entry.id, { ...body, expectedVersion: entry.version })
      } else if (kind === 'food') await caloraApi.createFood(body, crypto.randomUUID())
      else await caloraApi.createWorkout(body, crypto.randomUUID())
      onSaved()
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 409 ? 'This entry changed elsewhere. Refresh and try again.' : caught instanceof Error ? caught.message : 'Could not save entry')
    } finally {
      setLoading(false)
    }
  }

  const primaryLabel = loading
    ? mode === 'ai' && !estimateReady ? 'Estimating…' : 'Saving…'
    : mode === 'ai' && !estimateReady ? 'Estimate with AI ✨' : editing ? 'Save changes' : 'Confirm & save'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] bg-[#fffaf4] p-5 shadow-2xl sm:rounded-[2rem] sm:p-7">
        <div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">Daily log</p><h2 className="text-2xl font-semibold text-stone-900">{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close entry form">×</button></div>
        {!editing && <div className="mb-5 grid grid-cols-2 rounded-2xl bg-orange-100 p-1" aria-label="Entry method"><button type="button" aria-pressed={mode === 'manual'} className={`composer-mode ${mode === 'manual' ? 'active' : ''}`} onClick={() => selectMode('manual')}><strong>Manual</strong><small>Enter nutrition yourself</small></button><button type="button" aria-pressed={mode === 'ai'} className={`composer-mode ${mode === 'ai' ? 'active' : ''}`} onClick={() => selectMode('ai')}><strong>AI assisted</strong><small>Let Calora estimate it</small></button></div>}
        <div className="mb-5 rounded-2xl border border-orange-100 bg-white/60 px-4 py-3 text-sm text-stone-600"><span>{mode === 'ai' ? `Tell us the basics. Calora will estimate ${kind === 'food' ? 'calories and macros' : 'calories burned'} before anything is saved.` : `Enter the ${kind === 'food' ? 'nutrition values' : 'calories burned'} from a label, device, or your own estimate.`}</span>{mode === 'ai' && aiUsage && <strong className="ai-quota mt-2">{aiUsage.remaining} of {aiUsage.limit} AI uses left today</strong>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-wrap sm:col-span-2"><span className="field-label">{kind === 'food' ? 'Food name' : 'Workout name'}</span><input type="text" className="wellness-input" value={name} onChange={(event) => { setName(event.target.value); markEstimateStale() }} placeholder={kind === 'food' ? 'Avocado toast' : 'Morning run'} /></label>
          {mode === 'ai' && <label className="field-wrap sm:col-span-2"><span className="field-label">Extra details <small>(optional)</small></span><textarea className="wellness-input min-h-24 resize-y" maxLength={1500} value={description} onChange={(event) => { setDescription(event.target.value); markEstimateStale() }} placeholder={kind === 'food' ? 'Homemade, restaurant portion, ingredients, or preparation…' : 'Distance, pace, terrain, equipment, or anything else useful…'} /></label>}
          {kind === 'food' ? <>
            <label className="field-wrap"><span className="field-label">Quantity</span><input type="text" className="wellness-input" inputMode="decimal" value={quantity} onChange={(event) => { setQuantity(decimalsOnly(event.target.value)); markEstimateStale() }} placeholder="e.g. 1,5" /></label>
            <label className="field-wrap"><span className="field-label">Unit</span><input type="text" className="wellness-input" value={unit} onChange={(event) => { setUnit(event.target.value); markEstimateStale() }} placeholder="serving, grams, bowl…" /></label>
            {mode === 'manual' && <>
              <label className="field-wrap"><span className="field-label">Meal</span><select className="wellness-input" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}><option value="" disabled>Select meal</option>{mealTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="field-wrap"><span className="field-label">Calories</span><input type="text" className="wellness-input" inputMode="numeric" value={calories} onChange={(event) => setCalories(integersOnly(event.target.value))} placeholder="e.g. 420" /></label>
              <label className="field-wrap"><span className="field-label">Protein (g)</span><input type="text" className="wellness-input" inputMode="decimal" value={protein} onChange={(event) => setProtein(decimalsOnly(event.target.value))} placeholder="e.g. 24,5" /></label>
              <label className="field-wrap"><span className="field-label">Carbs (g)</span><input type="text" className="wellness-input" inputMode="decimal" value={carbs} onChange={(event) => setCarbs(decimalsOnly(event.target.value))} placeholder="e.g. 38,5" /></label>
              <label className="field-wrap"><span className="field-label">Fat (g)</span><input type="text" className="wellness-input" inputMode="decimal" value={fat} onChange={(event) => setFat(decimalsOnly(event.target.value))} placeholder="e.g. 16,5" /></label>
            </>}
          </> : <>
            {mode === 'ai' ? <label className="field-wrap sm:col-span-2"><span className="field-label">Duration (minutes)</span><input type="text" className="wellness-input" inputMode="numeric" value={duration} onChange={(event) => { setDuration(integersOnly(event.target.value)); markEstimateStale() }} placeholder="e.g. 30" /></label> : <>
              <label className="field-wrap"><span className="field-label">Workout type</span><input type="text" className="wellness-input" value={workoutType} onChange={(event) => setWorkoutType(event.target.value)} placeholder="Running" /></label>
              <label className="field-wrap"><span className="field-label">Duration (minutes)</span><input type="text" className="wellness-input" inputMode="numeric" value={duration} onChange={(event) => setDuration(integersOnly(event.target.value))} placeholder="e.g. 30" /></label>
              <label className="field-wrap"><span className="field-label">Intensity</span><select className="wellness-input" value={intensity} onChange={(event) => setIntensity(event.target.value as WorkoutIntensity)}><option value="" disabled>Select intensity</option>{intensities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="field-wrap"><span className="field-label">Calories burned</span><input type="text" className="wellness-input" inputMode="numeric" value={calories} onChange={(event) => setCalories(integersOnly(event.target.value))} placeholder="e.g. 280" /></label>
              <label className="field-wrap sm:col-span-2"><span className="field-label">Notes <small>(optional)</small></span><input type="text" className="wellness-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Felt steady throughout" /></label>
            </>}
          </>}
        </div>
        {mode === 'ai' && estimateReady && <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow text-emerald-700">AI estimate ready</p><strong className="text-2xl text-emerald-950">{calories} kcal {kind === 'workout' ? 'burned' : ''}</strong></div><button type="button" className="text-action" onClick={() => void estimate()} disabled={loading}>Re-estimate</button></div>{kind === 'food' ? <p className="mt-2 text-sm text-emerald-900">Protein {protein}g · Carbs {carbs}g · Fat {fat}g</p> : <p className="mt-2 text-sm text-emerald-900">{workoutType} · {duration} min · {intensity} intensity</p>}{rationale && <p className="mb-0 mt-2 text-sm leading-6 text-emerald-800">{rationale}</p>}</section>}
        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        <div className="mt-6 flex gap-3"><button type="button" className="secondary-action flex-1" onClick={onClose}>Cancel</button><button type="button" className="primary-action flex-1" onClick={() => void save()} disabled={loading}>{primaryLabel}</button></div>
      </div>
    </div>
  )
}

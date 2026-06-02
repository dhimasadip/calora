import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import {
  ACTIVITY_LEVEL_LABELS,
  GOAL_LABELS,
  INTENSITY_LABELS,
  calculateBMR,
  calculateTDEE,
  calculateDailyTarget,
  calculateAgeFromDOB,
  ftInToCm,
  lbsToKg,
  type ActivityLevel,
  type Goal,
  type GoalIntensity,
  type Sex,
} from '@calora/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PromoCodeForm } from '@/components/PromoCodeForm'

interface FormData {
  dateOfBirth: string
  sex: Sex
  unitPreference: 'metric' | 'imperial'
  heightCm: number
  heightFt: number
  heightIn: number
  weightKg: number
  weightLbs: number
  activityLevel: ActivityLevel
  goal: Goal
  goalIntensity: GoalIntensity
  targetWeightKg: number | null
}

export default function Onboarding() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState<{ bmr: number; tdee: number; dailyCalorieTarget: number } | null>(null)

  const [data, setData] = useState<FormData>({
    dateOfBirth: '',
    sex: 'male',
    unitPreference: 'metric',
    heightCm: 170,
    heightFt: 5,
    heightIn: 7,
    weightKg: 70,
    weightLbs: 154,
    activityLevel: 'moderately_active',
    goal: 'maintaining',
    goalIntensity: 'moderate',
    targetWeightKg: null,
  })

  const totalSteps = data.goal === 'maintaining' ? 3 : 4
  const progress = (step / totalSteps) * 100

  function next() {
    setError(null)
    if (step === 1) {
      if (!data.dateOfBirth) return setError('Date of birth required')
      const age = calculateAgeFromDOB(data.dateOfBirth)
      if (age < 13 || age > 120) return setError('Invalid age')
    }
    if (data.goal === 'maintaining' && step === 3) {
      handleComplete()
      return
    }
    if (step === totalSteps) handleComplete()
    else setStep(step + 1)
  }

  function back() {
    setError(null)
    if (step > 1) setStep(step - 1)
  }

  async function handleComplete() {
    setSaving(true)
    setError(null)
    try {
      const heightCm = data.unitPreference === 'metric' ? data.heightCm : ftInToCm(data.heightFt, data.heightIn)
      const weightKg = data.unitPreference === 'metric' ? data.weightKg : lbsToKg(data.weightLbs)

      const res = await api<{ profile: { bmr: number; tdee: number; dailyCalorieTarget: number } }>('/profile', {
        method: 'POST',
        body: {
          dateOfBirth: data.dateOfBirth,
          sex: data.sex,
          heightCm,
          weightKg,
          activityLevel: data.activityLevel,
          goal: data.goal,
          goalIntensity: data.goalIntensity,
          targetWeightKg: data.targetWeightKg,
          unitPreference: data.unitPreference,
        },
      })
      setCompleted(res.profile)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle>You're all set!</CardTitle>
            <CardDescription>Here are your personalized targets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs text-muted-foreground">BMR</p>
                <p className="text-2xl font-medium">{completed.bmr}</p>
                <p className="text-xs text-muted-foreground">kcal</p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs text-muted-foreground">TDEE</p>
                <p className="text-2xl font-medium">{completed.tdee}</p>
                <p className="text-xs text-muted-foreground">kcal/day</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-4 border-[0.5px] border-primary">
                <p className="text-xs text-muted-foreground">Daily target</p>
                <p className="text-2xl font-medium text-primary">{completed.dailyCalorieTarget}</p>
                <p className="text-xs text-muted-foreground">kcal/day</p>
              </div>
            </div>
            <div className="rounded-lg border-[0.5px] border-input bg-muted/40 p-4 space-y-2 text-left">
              <p className="text-sm font-medium">Have a promo code?</p>
              <p className="text-xs text-muted-foreground">Redeem it to unlock Pro and get higher chat limits. You can also do this later from your profile.</p>
              <PromoCodeForm onSuccess={refresh} />
            </div>
            <Button className="w-full" onClick={() => navigate('/')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Live preview of calculated values
  let preview: { bmr: number; tdee: number; target: number } | null = null
  if (step === totalSteps && data.dateOfBirth) {
    const age = calculateAgeFromDOB(data.dateOfBirth)
    const heightCm = data.unitPreference === 'metric' ? data.heightCm : ftInToCm(data.heightFt, data.heightIn)
    const weightKg = data.unitPreference === 'metric' ? data.weightKg : lbsToKg(data.weightLbs)
    const bmr = Math.round(calculateBMR(weightKg, heightCm, age, data.sex))
    const tdee = calculateTDEE(bmr, data.activityLevel)
    preview = { bmr, tdee, target: calculateDailyTarget(tdee, data.goal, data.goalIntensity) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Set up your profile</CardTitle>
          <CardDescription>Step {step} of {totalSteps}</CardDescription>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium">About you</h3>
              <div className="space-y-2">
                <Label>Units</Label>
                <Select value={data.unitPreference} onValueChange={(v) => setData({ ...data, unitPreference: v as 'metric' | 'imperial' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">Metric (cm, kg)</SelectItem>
                    <SelectItem value="imperial">Imperial (ft/in, lbs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" type="date" value={data.dateOfBirth} onChange={(e) => setData({ ...data, dateOfBirth: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Biological sex (for BMR formula)</Label>
                <Select value={data.sex} onValueChange={(v) => setData({ ...data, sex: v as Sex })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {data.unitPreference === 'metric' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input id="height" type="number" value={data.heightCm} onChange={(e) => setData({ ...data, heightCm: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input id="weight" type="number" step="0.1" value={data.weightKg} onChange={(e) => setData({ ...data, weightKg: Number(e.target.value) })} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Height (ft)</Label>
                    <Input type="number" value={data.heightFt} onChange={(e) => setData({ ...data, heightFt: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Height (in)</Label>
                    <Input type="number" value={data.heightIn} onChange={(e) => setData({ ...data, heightIn: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (lbs)</Label>
                    <Input type="number" step="0.1" value={data.weightLbs} onChange={(e) => setData({ ...data, weightLbs: Number(e.target.value) })} />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-medium">Activity level</h3>
              <div className="space-y-2">
                {(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]).map((level) => (
                  <label key={level} className={`flex items-start gap-3 p-3 rounded-lg border-[0.5px] cursor-pointer transition ${data.activityLevel === level ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                    <input
                      type="radio"
                      name="activity"
                      value={level}
                      checked={data.activityLevel === level}
                      onChange={() => setData({ ...data, activityLevel: level })}
                      className="mt-1"
                    />
                    <span className="text-sm">{ACTIVITY_LEVEL_LABELS[level]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium">Your goal</h3>
              <div className="space-y-2">
                {(Object.keys(GOAL_LABELS) as Goal[]).map((goal) => (
                  <label key={goal} className={`flex items-start gap-3 p-3 rounded-lg border-[0.5px] cursor-pointer transition ${data.goal === goal ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                    <input
                      type="radio"
                      name="goal"
                      value={goal}
                      checked={data.goal === goal}
                      onChange={() => setData({ ...data, goal })}
                      className="mt-1"
                    />
                    <span className="text-sm">{GOAL_LABELS[goal]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-medium">Goal intensity</h3>
              <div className="space-y-2">
                {(Object.keys(INTENSITY_LABELS) as GoalIntensity[]).map((intensity) => (
                  <label key={intensity} className={`flex items-start gap-3 p-3 rounded-lg border-[0.5px] cursor-pointer transition ${data.goalIntensity === intensity ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                    <input
                      type="radio"
                      name="intensity"
                      value={intensity}
                      checked={data.goalIntensity === intensity}
                      onChange={() => setData({ ...data, goalIntensity: intensity })}
                      className="mt-1"
                    />
                    <span className="text-sm">{INTENSITY_LABELS[intensity]}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="target">Target weight (kg, optional)</Label>
                <Input
                  id="target"
                  type="number"
                  step="0.1"
                  value={data.targetWeightKg ?? ''}
                  onChange={(e) => setData({ ...data, targetWeightKg: e.target.value ? Number(e.target.value) : null })}
                />
              </div>

              {preview && (
                <div className="rounded-lg bg-muted p-4 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">Your daily calorie target will be</p>
                  <p className="text-3xl font-medium text-primary">{preview.target} kcal</p>
                  <p className="text-xs text-muted-foreground">BMR {preview.bmr} · TDEE {preview.tdee}</p>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-between">
            <Button variant="outline" onClick={back} disabled={step === 1 || saving}>Back</Button>
            <Button onClick={next} disabled={saving}>
              {saving ? 'Saving…' : step === totalSteps ? 'Finish' : 'Next'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Watch, CheckCircle2, ChevronRight, ChevronLeft, Zap, Dumbbell,
  Heart, Target, Loader2, SkipForward, User, Scale, Ruler,
  Pill, Dna, Thermometer, Sparkles
} from 'lucide-react'

type Step = 'device' | 'bio' | 'questionnaire' | 'goals'
const STEPS: Step[] = ['device', 'bio', 'questionnaire', 'goals']

const GOALS = [
  { id: 'increase_muscle', label: 'Increase Muscle', icon: Dumbbell, desc: 'Build strength & lean mass', color: 'from-violet-500 to-violet-400' },
  { id: 'decrease_fat', label: 'Decrease Fat', icon: Zap, desc: 'Lose body fat, improve composition', color: 'from-amber-500 to-orange-400' },
  { id: 'stay_healthy', label: 'Stay Healthy', icon: Heart, desc: 'Maintain overall wellness & longevity', color: 'from-emerald-500 to-emerald-400' },
  { id: 'custom', label: 'Custom Goal', icon: Target, desc: 'E.g. Train for cricket, marathon…', color: 'from-indigo-500 to-indigo-400' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('device')
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [syncProgress, setSyncProgress] = useState(0)
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [geneticConditions, setGeneticConditions] = useState('')
  const [sickLikelihood, setSickLikelihood] = useState('')
  const [medications, setMedications] = useState('')
  const [selectedGoal, setSelectedGoal] = useState('')
  const [customGoal, setCustomGoal] = useState('')

  const stepIndex = STEPS.indexOf(step)

  const simulateSync = () => {
    setSyncState('syncing')
    setSyncProgress(0)
    const interval = setInterval(() => {
      setSyncProgress(p => {
        if (p >= 100) { clearInterval(interval); setSyncState('done'); return 100 }
        return Math.min(p + Math.random() * 15 + 5, 100)
      })
    }, 120)
  }

  const canNext = () => {
    if (step === 'device') return syncState === 'done'
    if (step === 'bio') return weight.trim() !== '' && height.trim() !== ''
    if (step === 'questionnaire') return true
    if (step === 'goals') return selectedGoal !== ''
    return false
  }

  const next = () => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
    else finish()
  }

  const back = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  const finish = () => {
    const persona = selectedGoal === 'custom' ? (customGoal || 'custom') : selectedGoal
    localStorage.setItem('careNagePersona', persona)
    localStorage.setItem('careNageBio', JSON.stringify({ weight, height, bodyFat }))
    localStorage.setItem('careNageQuestionnaire', JSON.stringify({ geneticConditions, sickLikelihood, medications }))
    localStorage.setItem('careNageOnboarded', 'true')
    router.push('/')
  }

  const skipToDemo = () => {
    localStorage.setItem('careNagePersona', 'stay_healthy')
    localStorage.setItem('careNageOnboarded', 'true')
    router.push('/')
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 z-[200]">
      <button onClick={skipToDemo} className="fixed top-4 right-4 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all z-10">
        <SkipForward className="w-3.5 h-3.5" /> Skip for Demo
      </button>

      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="bg-indigo-500 rounded-xl p-2"><Heart className="w-6 h-6 text-white" /></div>
          <span className="text-white font-bold text-xl">CareNage<span className="text-indigo-400">AI</span></span>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i < stepIndex ? 'bg-emerald-400' : i === stepIndex ? 'bg-indigo-400 scale-125' : 'bg-slate-600'
              }`} />
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 transition-all duration-500 ${i < stepIndex ? 'bg-emerald-400' : 'bg-slate-600'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">

          {/* STEP 1: Device */}
          {step === 'device' && (
            <div className="p-8 text-center">
              <div className={`w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center transition-all duration-500 ${syncState === 'done' ? 'bg-emerald-500/20' : 'bg-indigo-500/20'}`}>
                {syncState === 'done'
                  ? <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  : <Watch className={`w-10 h-10 text-indigo-400 ${syncState === 'syncing' ? 'animate-pulse' : ''}`} />}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Link Your Wearable</h2>
              <p className="text-slate-400 text-sm mb-8 max-w-xs mx-auto">Connect your Apple Watch or wearable to sync real health data instantly.</p>

              {syncState === 'idle' && (
                <button onClick={simulateSync} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                  Simulate Connection
                </button>
              )}
              {syncState === 'syncing' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-indigo-300 text-sm justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Syncing health data…
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300" style={{ width: `${Math.min(syncProgress, 100)}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                    {['Heart Rate', 'Sleep', 'Workouts'].map((d, i) => (
                      <div key={d} className={`bg-white/5 rounded-lg p-2 transition-all ${syncProgress > i * 33 ? 'text-emerald-400' : ''}`}>
                        {syncProgress > i * 33 ? '✓ ' : ''}{d}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {syncState === 'done' && (
                <div className="space-y-3">
                  <p className="text-emerald-400 font-semibold">✓ Sync Complete!</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[['335K', 'Heart Rate'], ['603', 'Nights Sleep'], ['795', 'Workouts']].map(([val, label]) => (
                      <div key={label} className="bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                        <p className="text-white font-bold">{val}</p>
                        <p className="text-emerald-400/70">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Bio Data */}
          {step === 'bio' && (
            <div className="p-8">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/20 mx-auto flex items-center justify-center mb-6">
                <User className="w-8 h-8 text-violet-400" />
              </div>
              <h2 className="text-2xl font-bold text-white text-center mb-2">Your Body Stats</h2>
              <p className="text-slate-400 text-sm text-center mb-8">Personalises your scores and recommendations.</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> Weight (kg) *</label>
                    <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="72"
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> Height (cm) *</label>
                    <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="178"
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">Body Fat % <span className="text-slate-500 font-normal">(optional)</span></label>
                  <input type="number" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="18.5"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-400 transition-all" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Questionnaire */}
          {step === 'questionnaire' && (
            <div className="p-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 mx-auto flex items-center justify-center mb-6">
                <Dna className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white text-center mb-2">Health History</h2>
              <p className="text-slate-400 text-sm text-center mb-6">All questions are optional — skip anything you prefer.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5"><Dna className="w-3.5 h-3.5 text-amber-400" /> Genetic / Family Conditions</label>
                  <input type="text" value={geneticConditions} onChange={e => setGeneticConditions(e.target.value)} placeholder="E.g. Diabetes, heart disease…"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-amber-400 transition-all text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5 text-amber-400" /> Likelihood to Fall Sick</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Low', 'Medium', 'High'].map(opt => (
                      <button key={opt} onClick={() => setSickLikelihood(sickLikelihood === opt ? '' : opt)}
                        className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${sickLikelihood === opt ? 'bg-amber-500/30 border-amber-400 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5"><Pill className="w-3.5 h-3.5 text-amber-400" /> Current Medications</label>
                  <input type="text" value={medications} onChange={e => setMedications(e.target.value)} placeholder="E.g. None, Metformin…"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-amber-400 transition-all text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Goals */}
          {step === 'goals' && (
            <div className="p-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 mx-auto flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white text-center mb-2">Your Primary Goal</h2>
              <p className="text-slate-400 text-sm text-center mb-6">Personalises your dashboard and CarePal's advice.</p>
              <div className="space-y-2.5">
                {GOALS.map(({ id, label, icon: Icon, desc, color }) => (
                  <button key={id} onClick={() => setSelectedGoal(id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${selectedGoal === id ? 'border-indigo-400 bg-indigo-500/20' : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'}`}>
                    <div className={`bg-gradient-to-br ${color} rounded-xl p-2.5 flex-shrink-0`}><Icon className="w-5 h-5 text-white" /></div>
                    <div>
                      <p className="text-white font-semibold text-sm">{label}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
                    </div>
                    {selectedGoal === id && <CheckCircle2 className="w-5 h-5 text-indigo-400 ml-auto flex-shrink-0" />}
                  </button>
                ))}
              </div>
              {selectedGoal === 'custom' && (
                <div className="mt-4">
                  <input type="text" value={customGoal} onChange={e => setCustomGoal(e.target.value)} placeholder="Describe your goal, e.g. Train for cricket season…" autoFocus
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-400 text-sm transition-all" />
                </div>
              )}
            </div>
          )}

          {/* Navigation bar */}
          <div className="px-8 pb-8 flex items-center justify-between gap-3">
            {stepIndex > 0
              ? <button onClick={back} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors px-4 py-2.5 rounded-xl hover:bg-white/10">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              : <div />}

            {step === 'questionnaire' ? (
              <div className="flex gap-2">
                <button onClick={next} className="text-sm text-slate-400 hover:text-white px-4 py-2.5 rounded-xl hover:bg-white/10 transition-colors">Skip</button>
                <button onClick={next} className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-6 py-2.5 rounded-xl transition-all">
                  Save & Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={stepIndex === STEPS.length - 1 ? finish : next} disabled={!canNext()}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-all">
                {stepIndex === STEPS.length - 1 ? <><Sparkles className="w-4 h-4" /> Launch Dashboard</> : <>Continue <ChevronRight className="w-4 h-4" /></>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

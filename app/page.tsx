'use client'

import { useEffect, useState } from 'react'
import { Moon, Heart, Zap, Activity, TrendingUp, TrendingDown, Minus, ChevronRight, Bell, RefreshCw, Loader2 } from 'lucide-react'

interface ScoreData {
  today: {
    sleep_score: number | null
    recovery_score: number | null
    strain_score: number | null
    care_score: number | null
    sleep_hrs: number | null
    deep_sleep_min: number | null
    rem_sleep_min: number | null
    steps: number | null
    hrv_ms: number | null
  }
  weekly: {
    avg_sleep_hrs: number | null
    avg_resting_hr: number | null
    avg_hrv_ms: number | null
    avg_daily_steps: number | null
    workout_count: number | null
  }
  history: {
    date: string
    sleep_score: number | null
    recovery_score: number | null
    strain_score: number | null
    care_score: number | null
  }[]
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 80, h = 28
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={(i / (values.length - 1)) * w} cy={h - ((v - min) / range) * h} r="2" fill={color} />
      ))}
    </svg>
  )
}

function scoreColor(score: number | null) {
  if (score === null) return { bg: 'from-slate-400 to-slate-300', text: 'text-slate-400', badge: 'bg-slate-100 text-slate-500', spark: '#94a3b8', ring: 'ring-slate-200' }
  if (score >= 75) return { bg: 'from-emerald-500 to-emerald-400', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', spark: '#10b981', ring: 'ring-emerald-200' }
  if (score >= 50) return { bg: 'from-amber-500 to-amber-400', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700', spark: '#f59e0b', ring: 'ring-amber-200' }
  return { bg: 'from-red-500 to-red-400', text: 'text-red-600', badge: 'bg-red-100 text-red-700', spark: '#ef4444', ring: 'ring-red-200' }
}

function TrendIcon({ values }: { values: (number | null)[] }) {
  const clean = values.filter(v => v !== null) as number[]
  if (clean.length < 2) return <Minus className="w-3.5 h-3.5 text-slate-400" />
  const delta = clean[clean.length - 1] - clean[clean.length - 2]
  if (delta > 2) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
  if (delta < -2) return <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  return <Minus className="w-3.5 h-3.5 text-slate-400" />
}

export default function CareBoardPage() {
  const [data, setData] = useState<ScoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchScores = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/scores')
      if (!res.ok) throw new Error('Failed to fetch')
      setData(await res.json())
    } catch {
      setError('Could not load scores — check Supabase connection')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchScores() }, [])

  const t = data?.today
  const w = data?.weekly
  const hist = data?.history ?? []

  const sparkFor = (key: 'sleep_score' | 'recovery_score' | 'strain_score' | 'care_score') =>
    hist.map(r => r[key]).filter(v => v !== null) as number[]

  const scores = [
    {
      key: 'sleep_score' as const,
      label: 'Sleep Score',
      icon: Moon,
      score: t?.sleep_score ?? null,
      details: [
        t?.sleep_hrs ? `${t.sleep_hrs}h total` : null,
        t?.deep_sleep_min ? `${Math.round(t.deep_sleep_min)}min deep` : null,
        t?.rem_sleep_min  ? `${Math.round(t.rem_sleep_min)}min REM`  : null,
      ].filter(Boolean) as string[],
    },
    {
      key: 'recovery_score' as const,
      label: 'Recovery Score',
      icon: Heart,
      score: t?.recovery_score ?? null,
      details: [
        t?.hrv_ms         ? `HRV ${Math.round(t.hrv_ms)}ms`          : null,
        w?.avg_resting_hr ? `RHR ${Math.round(w.avg_resting_hr)}bpm` : null,
      ].filter(Boolean) as string[],
    },
    {
      key: 'strain_score' as const,
      label: 'Strain Score',
      icon: Zap,
      score: t?.strain_score ?? null,
      details: [
        t?.steps             ? `${t.steps.toLocaleString()} steps`    : null,
        w?.workout_count     ? `${w.workout_count} workouts this week` : null,
      ].filter(Boolean) as string[],
    },
    {
      key: 'care_score' as const,
      label: 'Care Score',
      icon: Activity,
      score: t?.care_score ?? null,
      details: ['Composite health index'],
    },
  ]

  const days = hist.map(r => new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' }))

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm">Good morning,</p>
          <h1 className="text-2xl font-bold text-slate-900">Varane</h1>
          <p className="text-slate-400 text-xs mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={fetchScores}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 px-3 py-2 rounded-xl transition-all hover:border-indigo-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-24 mb-4" />
              <div className="h-10 bg-slate-100 rounded w-16 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-32" />
            </div>
          ))}
        </div>
      )}

      {/* Score Cards */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4">
          {scores.map(({ key, label, icon: Icon, score, details }) => {
            const c = scoreColor(score)
            const spark = sparkFor(key)
            return (
              <div key={key} className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-5 ring-2 ${c.ring} hover:shadow-md transition-all`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`bg-gradient-to-br ${c.bg} rounded-lg p-1.5`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-slate-500">{label}</span>
                  </div>
                  <TrendIcon values={spark} />
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    {score !== null
                      ? <p className={`text-4xl font-black ${c.text}`}>{Math.round(score)}</p>
                      : <p className="text-2xl font-bold text-slate-300">—</p>
                    }
                    <p className="text-xs text-slate-400 mt-0.5">/ 100</p>
                  </div>
                  {spark.length >= 2 && <Sparkline values={spark} color={c.spark} />}
                </div>

                {details.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1">
                    {details.map(d => <span key={d} className="text-xs text-slate-500">{d}</span>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 7-day trend table */}
      {hist.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-slate-900 text-sm">7-Day Trend</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Score</th>
                  {days.map((d, i) => <th key={i} className="text-center px-2 py-3 text-xs font-medium text-slate-400">{d}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(['sleep_score', 'recovery_score', 'strain_score', 'care_score'] as const).map(key => (
                  <tr key={key} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-700 capitalize">{key.replace('_score', '')}</td>
                    {hist.map((r, i) => {
                      const v = r[key]
                      const c = scoreColor(v)
                      return (
                        <td key={i} className="px-2 py-3 text-center">
                          {v !== null
                            ? <span className={`inline-block w-9 text-center text-xs font-semibold px-1 py-0.5 rounded-md ${c.badge}`}>{Math.round(v)}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weekly summary */}
      {w && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" /> Weekly Averages
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Avg Sleep', value: w.avg_sleep_hrs ? `${w.avg_sleep_hrs}h` : '—' },
              { label: 'Avg HRV', value: w.avg_hrv_ms ? `${w.avg_hrv_ms}ms` : '—' },
              { label: 'Avg Steps', value: w.avg_daily_steps ? Number(w.avg_daily_steps).toLocaleString() : '—' },
              { label: 'Workouts', value: w.workout_count ? `${w.workout_count} sessions` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">{label}</p>
                <p className="font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl p-5 text-white flex items-center justify-between">
        <div>
          <p className="text-indigo-200 text-xs font-medium uppercase tracking-wide mb-1">Active Goals</p>
          <p className="font-semibold">Fat loss · Muscle gain · Tennis · Cardio</p>
        </div>
        <ChevronRight className="w-5 h-5 text-indigo-300 flex-shrink-0" />
      </div>
    </div>
  )
}

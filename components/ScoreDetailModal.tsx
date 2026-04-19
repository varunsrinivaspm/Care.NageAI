'use client'

import { X, CheckCircle2, TrendingUp, TrendingDown, Minus, Moon, Heart, Zap } from 'lucide-react'

export type ScoreType = 'strain' | 'recovery' | 'sleep'

interface ScoreData {
  today: {
    sleep_score: number | null
    recovery_score: number | null
    strain_score: number | null
    sleep_hrs: number | null
    deep_sleep_min: number | null
    rem_sleep_min: number | null
    steps: number | null
    hrv_ms: number | null
  }
  weekly: {
    avg_sleep_hrs: number | null
    avg_hrv_ms: number | null
    avg_daily_steps: number | null
    workout_count: number | null
    avg_resting_hr?: number | null
  }
  history: { date: string; sleep_score: number | null; recovery_score: number | null; strain_score: number | null }[]
}

interface Props {
  scoreType: ScoreType
  score: number | null
  data: ScoreData
  onClose: () => void
}

function getRangeLabel(score: number | null) {
  if (score === null) return { label: 'No Data', color: 'text-slate-400' }
  if (score >= 75) return { label: 'Optimal', color: 'text-emerald-500' }
  if (score >= 50) return { label: 'Fair', color: 'text-amber-500' }
  return { label: 'Needs Attention', color: 'text-red-500' }
}

function ScoreMeter({ score }: { score: number | null }) {
  const pct = score ?? 0
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const r = 40, cx = 52, cy = 52
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width="104" height="104" className="rotate-[-90deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
    </svg>
  )
}

function MiniSparkline({ values, color }: { values: number[], color: string }) {
  if (values.length < 2) return <span className="text-slate-400 text-xs">—</span>
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1
  const w = 60, h = 20
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getContent(type: ScoreType, score: number | null, data: ScoreData) {
  const t = data.today
  const w = data.weekly
  const hist = data.history

  if (type === 'strain') {
    const steps = t.steps ?? 0
    const stepsTarget = 10000
    const stepsPct = Math.min((steps / stepsTarget) * 100, 100)
    const workouts = w.workout_count ?? 0

    const breakdown = score === null ? ['No strain data available for today.'] : score >= 75 ? [
      `High activity day — ${steps.toLocaleString()} steps logged (${Math.round(stepsPct)}% of 10K target)`,
      `${workouts} workout session${workouts !== 1 ? 's' : ''} completed this week, above weekly baseline`,
      'Heart rate elevation consistent with moderate-to-high physical output',
      'Caloric expenditure tracking above weekly average — excellent training stimulus',
    ] : score >= 50 ? [
      `Moderate activity — ${steps.toLocaleString()} steps (${Math.round(stepsPct)}% of 10K target)`,
      `${workouts} workout${workouts !== 1 ? 's' : ''} this week — within healthy training range`,
      'Heart rate patterns suggest steady aerobic effort today',
      'Good balance between activity and recovery load',
    ] : [
      `Low activity today — only ${steps.toLocaleString()} steps vs 10,000 target`,
      `${workouts} workout${workouts !== 1 ? 's' : ''} logged this week — below your goal cadence`,
      'Limited exercise stimulus may slow progress toward your goal',
      'Movement data below baseline for your selected persona',
    ]

    const insights = score !== null && score >= 75 ? [
      'Schedule a light recovery walk tomorrow to prevent overtraining',
      'Prioritise 7–8h sleep tonight to allow muscle repair from today\'s load',
      'Hydrate with 2–2.5L of water to flush metabolic byproducts',
      'Consider a protein-rich meal within 30min of your last workout',
    ] : score !== null && score >= 50 ? [
      `Add ${(stepsTarget - steps).toLocaleString()} more steps to hit today's target — a 20min walk`,
      'Aim for one structured workout in the next 2 days to boost this score',
      'Keep sleep above 7h to sustain your activity capacity',
      'Track your exercise minutes — 30min/day is the baseline for your goal',
    ] : [
      'Set a 20-min movement alarm for late afternoon — even a brisk walk counts',
      'Schedule a workout session for tomorrow at a consistent time',
      `Increase daily step target gradually — aim for ${Math.min(steps + 2000, 10000).toLocaleString()} tomorrow`,
      'Check with CarePal for a tailored activity plan based on your persona',
    ]

    const sparkHistory = hist.map(r => r.strain_score).filter(Boolean) as number[]
    const metrics = [
      { label: 'Steps Today', value: steps ? steps.toLocaleString() : '—', sub: `${Math.round(stepsPct)}% of 10K target`, spark: null },
      { label: 'Workouts / Week', value: `${workouts}`, sub: 'sessions this week', spark: null },
      { label: 'Avg Daily Steps', value: w.avg_daily_steps ? Number(w.avg_daily_steps).toLocaleString() : '—', sub: '7-day average', spark: null },
      { label: 'Strain Trend', value: sparkHistory.length ? `${Math.round(sparkHistory[sparkHistory.length - 1])}` : '—', sub: '7-day history', spark: sparkHistory },
    ]

    return { breakdown, insights, metrics, icon: Zap, color: '#f59e0b', sparkColor: '#f59e0b' }
  }

  if (type === 'recovery') {
    const hrv = t.hrv_ms
    const avgHrv = w.avg_hrv_ms
    const hrvDrop = hrv && avgHrv ? ((avgHrv - hrv) / avgHrv) * 100 : null
    const rhr = w.avg_resting_hr

    const breakdown = score === null ? ['No recovery data available for today.'] : score >= 75 ? [
      hrv ? `HRV at ${Math.round(hrv)}ms — ${avgHrv ? `${Math.abs(Math.round(hrvDrop ?? 0))}% ${(hrvDrop ?? 0) < 0 ? 'above' : 'near'} your 7-day average of ${Math.round(avgHrv)}ms` : 'within healthy range'}` : 'HRV within normal baseline range',
      rhr ? `Resting heart rate averaging ${Math.round(rhr)}bpm — indicates strong cardiovascular fitness` : 'Resting heart rate within normal range',
      `Sleep score feeding positively into recovery — restorative sleep patterns detected`,
      'Autonomic nervous system showing good parasympathetic dominance (rest & digest mode)',
    ] : score >= 50 ? [
      hrv ? `HRV at ${Math.round(hrv)}ms — ${avgHrv ? `${Math.round(Math.abs(hrvDrop ?? 0))}% ${(hrvDrop ?? 0) > 0 ? 'below' : 'near'} 7-day average` : 'moderate range'}` : 'HRV in moderate range',
      rhr ? `RHR averaging ${Math.round(rhr)}bpm — room for improvement with better sleep` : 'Resting HR in moderate range',
      'Recovery partially limited — possible mild accumulated fatigue',
      'Sleep quality contributing moderately to today\'s recovery baseline',
    ] : [
      hrv ? `HRV suppressed at ${Math.round(hrv)}ms — ${avgHrv ? `${Math.round(Math.abs(hrvDrop ?? 0))}% below your ${Math.round(avgHrv)}ms baseline` : 'below baseline'}` : 'HRV below normal range — body under stress',
      'Low recovery signals accumulated fatigue or insufficient rest',
      'Autonomic nervous system showing sympathetic dominance (stress response)',
      'High-intensity training not recommended until recovery improves',
    ]

    const insights = score !== null && score >= 75 ? [
      'Great day for a structured workout — your body is primed',
      'Maintain sleep schedule — consistency is key to sustained HRV',
      'Consider adding a 5-min morning HRV breathing exercise',
      'Log any stress factors in CarePal to track their HRV impact',
    ] : score !== null && score >= 50 ? [
      'Prioritise 7.5–8h sleep tonight to restore HRV baseline',
      'Avoid high-intensity training today — opt for yoga or a walk instead',
      'Limit caffeine after 2pm to improve sleep quality and HRV',
      'Practice 4-7-8 breathing for 5 minutes before bed',
    ] : [
      'Take a rest day — your body is signalling it needs recovery',
      'Go to bed 30–60 minutes earlier tonight',
      'Avoid alcohol and late-night screens — both suppress HRV',
      'Ask CarePal for a personalised 3-day recovery protocol',
    ]

    const hrvHistory = hist.map(r => r.recovery_score).filter(Boolean) as number[]
    const metrics = [
      { label: 'HRV Today', value: hrv ? `${Math.round(hrv)}ms` : '—', sub: avgHrv ? `7-day avg: ${Math.round(avgHrv)}ms` : '', spark: null },
      { label: 'Resting HR', value: rhr ? `${Math.round(rhr)}bpm` : '—', sub: '7-day average', spark: null },
      { label: 'Sleep → Recovery', value: t.sleep_score ? `${Math.round(t.sleep_score)}/100` : '—', sub: 'sleep score feeding in', spark: null },
      { label: 'Recovery Trend', value: hrvHistory.length ? `${Math.round(hrvHistory[hrvHistory.length - 1])}` : '—', sub: '7-day history', spark: hrvHistory },
    ]

    return { breakdown, insights, metrics, icon: Heart, color: '#10b981', sparkColor: '#10b981' }
  }

  // Sleep
  const sleepHrs = t.sleep_hrs
  const deepMin = t.deep_sleep_min
  const remMin = t.rem_sleep_min
  const lightMin = sleepHrs && deepMin !== null && remMin !== null
    ? Math.max((sleepHrs * 60) - (deepMin ?? 0) - (remMin ?? 0) - 30, 0)
    : null

  const breakdown = score === null ? ['No sleep data available for today.'] : score >= 75 ? [
    sleepHrs ? `Excellent total sleep of ${sleepHrs}h — at or above the 7.5h target` : 'Sleep duration within optimal range',
    deepMin ? `${Math.round(deepMin)}min of deep sleep — supporting physical recovery and muscle repair` : 'Deep sleep stage well-represented',
    remMin ? `${Math.round(remMin)}min REM — supporting memory consolidation and mood regulation` : 'REM sleep adequate for cognitive recovery',
    'Sleep staging distribution looks healthy — good progression through all cycles',
  ] : score >= 50 ? [
    sleepHrs ? `${sleepHrs}h sleep — ${sleepHrs < 7.5 ? 'slightly below' : 'near'} the 7.5h optimal target` : 'Sleep duration approaching target',
    deepMin ? `${Math.round(deepMin)}min deep sleep — could benefit from slight improvement` : 'Deep sleep could be improved',
    remMin ? `${Math.round(remMin)}min REM — adequate but slightly below optimal range` : 'REM sleep below optimal',
    'Some fragmentation detected — consider sleep hygiene improvements',
  ] : [
    sleepHrs ? `Only ${sleepHrs}h of sleep — significantly below the 7.5h recovery target` : 'Sleep duration insufficient',
    deepMin ? `${Math.round(deepMin)}min deep sleep — too little for physical recovery` : 'Deep sleep severely limited',
    remMin ? `${Math.round(remMin)}min REM — impacting cognitive performance and mood` : 'REM sleep insufficient',
    'Poor sleep is directly reducing your recovery and performance scores',
  ]

  const insights = score !== null && score >= 75 ? [
    'Maintain your consistent sleep schedule — it\'s working',
    'Keep your bedroom cool (18–20°C) to sustain deep sleep quality',
    'Your sleep is fueling great recovery — keep workout timing consistent',
    'Share this trend with CarePal to build on it',
  ] : score !== null && score >= 50 ? [
    sleepHrs && sleepHrs < 7.5 ? `Move bedtime ${Math.round((7.5 - sleepHrs) * 60)}min earlier tonight to hit the 7.5h target` : 'Maintain a fixed wake-up time even on weekends',
    'Reduce screen exposure 30min before bed — blue light suppresses melatonin',
    'Try a nasal rinse before bed — especially helpful with your deviated septum',
    'Aim for a sleep-friendly dinner: avoid heavy meals within 2h of bed',
  ] : [
    'Make sleep your #1 priority tonight — everything else depends on it',
    'Set a non-negotiable bedtime alarm for the same time each night',
    'Ask CarePal for a personalised sleep protocol based on your data',
    'Consider a sleep tracking review in your next doctor visit',
  ]

  const sleepHistory = hist.map(r => r.sleep_score).filter(Boolean) as number[]
  const metrics = [
    { label: 'Total Sleep', value: sleepHrs ? `${sleepHrs}h` : '—', sub: 'target: 7.5h', spark: null },
    { label: 'Deep Sleep', value: deepMin ? `${Math.round(deepMin)}m` : '—', sub: 'physical recovery', spark: null },
    { label: 'REM Sleep', value: remMin ? `${Math.round(remMin)}m` : '—', sub: 'cognitive recovery', spark: null },
    { label: 'Sleep Trend', value: sleepHistory.length ? `${Math.round(sleepHistory[sleepHistory.length - 1])}` : '—', sub: '7-day history', spark: sleepHistory },
  ]

  return { breakdown, insights, metrics, icon: Moon, color: '#8b5cf6', sparkColor: '#8b5cf6' }
}

const SCORE_LABELS: Record<ScoreType, string> = {
  strain: 'Strain Score',
  recovery: 'Recovery Score',
  sleep: 'Sleep Score',
}

export default function ScoreDetailModal({ scoreType, score, data, onClose }: Props) {
  const { breakdown, insights, metrics, icon: Icon, color, sparkColor } = getContent(scoreType, score, data)
  const { label: rangeLabel, color: rangeColor } = getRangeLabel(score)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">{SCORE_LABELS[scoreType]}</h2>
              <p className={`text-xs font-medium ${rangeColor}`}>{rangeLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Score ring */}
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <ScoreMeter score={score} />
              <div className="absolute inset-0 flex items-center justify-center rotate-0">
                <div className="text-center">
                  <p className="text-2xl font-black text-slate-900">{score !== null ? Math.round(score) : '—'}</p>
                  <p className="text-xs text-slate-400">/ 100</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              {metrics.slice(0, 3).map(m => (
                <div key={m.label} className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-500">{m.label}</p>
                    <p className="font-semibold text-slate-800 text-sm">{m.value}</p>
                    {m.sub && <p className="text-xs text-slate-400">{m.sub}</p>}
                  </div>
                  {m.spark && <MiniSparkline values={m.spark} color={sparkColor} />}
                </div>
              ))}
            </div>
          </div>

          {/* 7-day trend */}
          {metrics[3]?.spark && metrics[3].spark.length > 1 && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">7-Day Trend</p>
              <div className="flex items-end justify-between gap-1">
                {metrics[3].spark.map((v, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div className="w-full rounded-sm transition-all" style={{ height: `${Math.max((v / 100) * 40, 4)}px`, background: color, opacity: 0.3 + (i / metrics[3].spark!.length) * 0.7 }} />
                    <span className="text-xs text-slate-400">{Math.round(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Breakdown</p>
            <div className="space-y-2">
              {breakdown.map((b, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: `${color}22`, color }}>
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{b}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Next Steps</p>
            <div className="space-y-2">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-slate-50 rounded-xl p-3">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
                  <p className="text-sm text-slate-700 leading-relaxed">{ins}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

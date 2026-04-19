import { NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUserId } from '@/lib/supabase-admin'

function sevenDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

// Care+ dummy data — mirrors what Care+ page shows
function getDummyData() {
  const scores = [
    { sleep: 82, recovery: 74, strain: 68, care: 75 },
    { sleep: 75, recovery: 80, strain: 72, care: 76 },
    { sleep: 88, recovery: 65, strain: 78, care: 77 },
    { sleep: 70, recovery: 77, strain: 85, care: 77 },
    { sleep: 79, recovery: 83, strain: 60, care: 74 },
    { sleep: 85, recovery: 71, strain: 76, care: 77 },
    { sleep: 77, recovery: 78, strain: 80, care: 78 },
  ]
  const history = scores.map((s, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      date: d.toISOString().split('T')[0],
      sleep_score: s.sleep,
      recovery_score: s.recovery,
      strain_score: s.strain,
      care_score: s.care,
    }
  })
  const latest = history[history.length - 1]
  return {
    today: {
      sleep_score:    latest.sleep_score,
      recovery_score: latest.recovery_score,
      strain_score:   latest.strain_score,
      care_score:     latest.care_score,
      sleep_hrs:      7.2,
      deep_sleep_min: 84,
      rem_sleep_min:  96,
      steps:          8740,
      hrv_ms:         58,
    },
    weekly: {
      avg_sleep_hrs:   7.1,
      avg_deep_min:    80,
      avg_rem_min:     92,
      avg_hrv_ms:      56,
      avg_daily_steps: 8340,
      workout_count:   4,
    },
    history,
  }
}

export async function GET() {
  const userId = await getAuthUserId()
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = sevenDaysAgo()

  const [historyRes, sleepRes, stepRes, hrvRes, weekSleepRes, weekStepsRes, weekHrvRes, weekWorkoutsRes] = await Promise.all([
    supabaseAdmin.from('scores').select('date, sleep_score, recovery_score, strain_score, care_score').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabaseAdmin.from('sleep_records').select('duration_min, deep_sleep_min, rem_sleep_min').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabaseAdmin.from('steps').select('count').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabaseAdmin.from('hrv').select('sdnn_ms').eq('user_id', userId).gte('timestamp', `${today}T00:00:00`).order('timestamp', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('sleep_records').select('duration_min, deep_sleep_min, rem_sleep_min').eq('user_id', userId).gte('date', weekAgo),
    supabaseAdmin.from('steps').select('count').eq('user_id', userId).gte('date', weekAgo),
    supabaseAdmin.from('hrv').select('sdnn_ms').eq('user_id', userId).gte('timestamp', `${weekAgo}T00:00:00`),
    supabaseAdmin.from('workouts').select('id').eq('user_id', userId).gte('date', weekAgo),
  ])

  const history = (historyRes.data ?? []).reverse()
  const hasRealScores = history.some(r => (r.sleep_score ?? 0) > 0 || (r.recovery_score ?? 0) > 0)

  // Use Care+ dummy data if DB has no real scores
  if (!hasRealScores) return NextResponse.json(getDummyData())

  const latest = history[history.length - 1]
  const sleep = sleepRes.data
  const steps = stepRes.data
  const hrv = hrvRes.data
  const sleepWeek = weekSleepRes.data ?? []
  const stepsWeek = weekStepsRes.data ?? []
  const hrvWeek = weekHrvRes.data ?? []
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null

  return NextResponse.json({
    today: {
      sleep_score:    latest?.sleep_score    ?? null,
      recovery_score: latest?.recovery_score ?? null,
      strain_score:   latest?.strain_score   ?? null,
      care_score:     latest?.care_score     ?? null,
      sleep_hrs:      sleep ? Math.round(sleep.duration_min / 60 * 10) / 10 : null,
      deep_sleep_min: sleep?.deep_sleep_min ?? null,
      rem_sleep_min:  sleep?.rem_sleep_min  ?? null,
      steps:          steps?.count ?? null,
      hrv_ms:         hrv?.sdnn_ms ?? null,
    },
    weekly: {
      avg_sleep_hrs:   avg(sleepWeek.map(r => r.duration_min / 60)),
      avg_deep_min:    avg(sleepWeek.map(r => r.deep_sleep_min ?? 0)),
      avg_rem_min:     avg(sleepWeek.map(r => r.rem_sleep_min ?? 0)),
      avg_hrv_ms:      avg(hrvWeek.map(r => r.sdnn_ms)),
      avg_daily_steps: stepsWeek.length ? Math.round(stepsWeek.reduce((a, r) => a + r.count, 0) / stepsWeek.length) : null,
      workout_count:   weekWorkoutsRes.data?.length ?? 0,
    },
    history: history.map(r => ({
      date:           r.date,
      sleep_score:    r.sleep_score,
      recovery_score: r.recovery_score,
      strain_score:   r.strain_score,
      care_score:     r.care_score,
    })),
  })
}

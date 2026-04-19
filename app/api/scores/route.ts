import { NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUserId } from '@/lib/supabase-admin'

function sevenDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

export async function GET() {
  const userId = await getAuthUserId()
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = sevenDaysAgo()

  const [historyRes, sleepRes, stepRes, hrvRes, weekSleepRes, weekStepsRes, weekHrvRes, weekWorkoutsRes] = await Promise.all([
    // 7-day score history
    supabaseAdmin
      .from('scores')
      .select('date, sleep_score, recovery_score, strain_score, care_score')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(7),

    // Today's sleep
    supabaseAdmin
      .from('sleep_records')
      .select('duration_min, deep_sleep_min, rem_sleep_min')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),

    // Today's steps
    supabaseAdmin
      .from('steps')
      .select('count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),

    // Latest HRV reading today
    supabaseAdmin
      .from('hrv')
      .select('sdnn_ms')
      .eq('user_id', userId)
      .gte('timestamp', `${today}T00:00:00`)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Weekly avg sleep
    supabaseAdmin
      .from('sleep_records')
      .select('duration_min, deep_sleep_min, rem_sleep_min')
      .eq('user_id', userId)
      .gte('date', weekAgo),

    // Weekly avg steps
    supabaseAdmin
      .from('steps')
      .select('count')
      .eq('user_id', userId)
      .gte('date', weekAgo),

    // Weekly avg HRV
    supabaseAdmin
      .from('hrv')
      .select('sdnn_ms')
      .eq('user_id', userId)
      .gte('timestamp', `${weekAgo}T00:00:00`),

    // Weekly workout count
    supabaseAdmin
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .gte('date', weekAgo),
  ])

  const history = (historyRes.data ?? []).reverse()
  const latest = history[history.length - 1]
  const sleep = sleepRes.data
  const steps = stepRes.data
  const hrv = hrvRes.data

  // Compute weekly averages manually
  const sleepWeek = weekSleepRes.data ?? []
  const stepsWeek = weekStepsRes.data ?? []
  const hrvWeek = weekHrvRes.data ?? []

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null

  const weekly = {
    avg_sleep_hrs:   avg(sleepWeek.map(r => r.duration_min / 60)),
    avg_deep_min:    avg(sleepWeek.map(r => r.deep_sleep_min ?? 0)),
    avg_rem_min:     avg(sleepWeek.map(r => r.rem_sleep_min ?? 0)),
    avg_hrv_ms:      avg(hrvWeek.map(r => r.sdnn_ms)),
    avg_daily_steps: stepsWeek.length ? Math.round(stepsWeek.reduce((a, r) => a + r.count, 0) / stepsWeek.length) : null,
    workout_count:   weekWorkoutsRes.data?.length ?? 0,
  }

  const noData = history.length === 0

  // Fallback demo data when DB is empty
  const fallbackHistory = noData ? Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return {
      date:           d.toISOString().split('T')[0],
      sleep_score:    68 + Math.round(Math.sin(i) * 12),
      recovery_score: 72 + Math.round(Math.cos(i) * 10),
      strain_score:   60 + Math.round(Math.sin(i + 1) * 15),
      care_score:     67 + Math.round(Math.cos(i + 1) * 8),
    }
  }) : history

  const fallbackLatest = noData ? fallbackHistory[fallbackHistory.length - 1] : latest

  return NextResponse.json({
    today: {
      sleep_score:    fallbackLatest?.sleep_score    ?? null,
      recovery_score: fallbackLatest?.recovery_score ?? null,
      strain_score:   fallbackLatest?.strain_score   ?? null,
      care_score:     fallbackLatest?.care_score     ?? null,
      sleep_hrs:      sleep ? Math.round(sleep.duration_min / 60 * 10) / 10 : (noData ? 7.2 : null),
      deep_sleep_min: sleep?.deep_sleep_min ?? (noData ? 82 : null),
      rem_sleep_min:  sleep?.rem_sleep_min  ?? (noData ? 94 : null),
      steps:          steps?.count          ?? (noData ? 8340 : null),
      hrv_ms:         hrv?.sdnn_ms          ?? (noData ? 58 : null),
    },
    weekly: noData ? {
      avg_sleep_hrs:   7.1,
      avg_deep_min:    78,
      avg_rem_min:     91,
      avg_hrv_ms:      55,
      avg_daily_steps: 8200,
      workout_count:   4,
    } : weekly,
    history: fallbackHistory.map(r => ({
      date:           r.date,
      sleep_score:    r.sleep_score,
      recovery_score: r.recovery_score,
      strain_score:   r.strain_score,
      care_score:     r.care_score,
    })),
  })
}

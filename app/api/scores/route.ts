import { NextResponse } from 'next/server'
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase-admin'

function sevenDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

export async function GET() {
  const userId = DEMO_USER_ID
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
    weekly,
    history: history.map(r => ({
      date:           r.date,
      sleep_score:    r.sleep_score,
      recovery_score: r.recovery_score,
      strain_score:   r.strain_score,
      care_score:     r.care_score,
    })),
  })
}

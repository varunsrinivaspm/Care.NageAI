import { NextResponse } from 'next/server'
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase-admin'

export interface Alert {
  type: 'hrv_drop' | 'short_sleep' | 'no_workout'
  message: string
  detail: string
  severity: 'amber' | 'info'
}

export async function GET() {
  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // 7-day window for HRV average
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    // 3-day window for workout gap
    const threeDaysAgo = new Date(today)
    threeDaysAgo.setDate(today.getDate() - 3)
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0]

    const [hrvTodayRes, hrv7dRes, sleepRes, workoutRes] = await Promise.all([
      // Today's HRV (most recent reading)
      supabaseAdmin
        .from('hrv')
        .select('sdnn_ms, timestamp')
        .eq('user_id', DEMO_USER_ID)
        .gte('timestamp', `${todayStr}T00:00:00`)
        .order('timestamp', { ascending: false })
        .limit(1),

      // 7-day HRV average (excluding today)
      supabaseAdmin
        .from('hrv')
        .select('sdnn_ms')
        .eq('user_id', DEMO_USER_ID)
        .gte('timestamp', `${sevenDaysAgoStr}T00:00:00`)
        .lt('timestamp', `${todayStr}T00:00:00`),

      // Most recent sleep record
      supabaseAdmin
        .from('sleep_records')
        .select('date, duration_min')
        .eq('user_id', DEMO_USER_ID)
        .order('date', { ascending: false })
        .limit(1),

      // Most recent workout
      supabaseAdmin
        .from('workouts')
        .select('start_time, type')
        .eq('user_id', DEMO_USER_ID)
        .order('start_time', { ascending: false })
        .limit(1),
    ])

    const alerts: Alert[] = []

    // --- Alert 1: HRV drop 20%+ below 7-day average ---
    const todayHrv = hrvTodayRes.data?.[0]?.sdnn_ms ?? null
    const hrv7dValues = hrv7dRes.data ?? []
    if (todayHrv !== null && hrv7dValues.length > 0) {
      const avg7d =
        hrv7dValues.reduce((sum, r) => sum + (r.sdnn_ms ?? 0), 0) /
        hrv7dValues.length
      const dropPct = ((avg7d - todayHrv) / avg7d) * 100
      if (dropPct >= 20) {
        alerts.push({
          type: 'hrv_drop',
          severity: 'amber',
          message: `HRV is ${Math.round(dropPct)}% below your 7-day average`,
          detail: `Today: ${Math.round(todayHrv)}ms vs avg ${Math.round(avg7d)}ms — consider a rest or light recovery day.`,
        })
      }
    }

    // --- Alert 2: Sleep < 6h ---
    const latestSleep = sleepRes.data?.[0]
    if (latestSleep) {
      const sleepHrs = latestSleep.duration_min / 60
      if (sleepHrs < 6) {
        alerts.push({
          type: 'short_sleep',
          severity: 'amber',
          message: `Short sleep detected — only ${sleepHrs.toFixed(1)}h last night`,
          detail: `You slept ${sleepHrs.toFixed(1)}h on ${latestSleep.date}. Aim for 7–9h to optimise recovery.`,
        })
      }
    }

    // --- Alert 3: No workout in 3+ days ---
    const latestWorkout = workoutRes.data?.[0]
    if (latestWorkout) {
      const lastWorkoutDate = new Date(latestWorkout.start_time)
      const daysSince = Math.floor(
        (today.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSince >= 3) {
        alerts.push({
          type: 'no_workout',
          severity: 'info',
          message: `No workout logged in ${daysSince} days`,
          detail: `Last session: ${latestWorkout.type ?? 'workout'} on ${lastWorkoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Time to move!`,
        })
      }
    } else {
      // No workout data at all
      alerts.push({
        type: 'no_workout',
        severity: 'info',
        message: 'No recent workouts found',
        detail: 'Log a workout to keep your strain score active.',
      })
    }

    return NextResponse.json({ alerts })
  } catch (err) {
    console.error('/api/alerts error:', err)
    return NextResponse.json({ alerts: [] }, { status: 500 })
  }
}

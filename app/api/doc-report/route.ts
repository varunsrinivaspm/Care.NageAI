import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUserId } from '@/lib/supabase-admin'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  const { symptoms, dateRange } = await req.json()
  const userId = await getAuthUserId()

  const days = dateRange === 'Last 30 days' ? 30 : dateRange === 'Last 14 days' ? 14 : 7
  const fromDate = daysAgo(days)
  const toDate = new Date().toISOString().split('T')[0]

  // Fetch all data in parallel
  const [userRes, sleepRes, stepsRes, workoutsRes, scoresRes, anomalyRes] = await Promise.all([
    supabaseAdmin.from('users').select('*').eq('id', userId).single(),

    supabaseAdmin.from('sleep_records')
      .select('date, duration_min, deep_sleep_min, rem_sleep_min')
      .eq('user_id', userId)
      .gte('date', fromDate)
      .order('date', { ascending: true }),

    supabaseAdmin.from('steps')
      .select('date, count')
      .eq('user_id', userId)
      .gte('date', fromDate)
      .order('date', { ascending: true }),

    supabaseAdmin.from('workouts')
      .select('date, workout_type, duration_min, calories, avg_hr')
      .eq('user_id', userId)
      .gte('date', fromDate)
      .order('date', { ascending: true }),

    supabaseAdmin.from('scores')
      .select('date, sleep_score, recovery_score, strain_score, care_score')
      .eq('user_id', userId)
      .gte('date', fromDate)
      .order('date', { ascending: true }),

    // HRV averages for anomaly detection
    supabaseAdmin.from('hrv')
      .select('sdnn_ms, timestamp')
      .eq('user_id', userId)
      .gte('timestamp', `${fromDate}T00:00:00`)
      .order('timestamp', { ascending: true }),
  ])

  const user = userRes.data
  const sleepData = sleepRes.data ?? []
  const stepsData = stepsRes.data ?? []
  const workouts = workoutsRes.data ?? []
  const scores = scoresRes.data ?? []
  const hrvData = anomalyRes.data ?? []

  // Build vitals summary string
  const avgSleep = sleepData.length ? (sleepData.reduce((a, r) => a + r.duration_min, 0) / sleepData.length / 60).toFixed(1) : 'N/A'
  const avgDeep  = sleepData.length ? Math.round(sleepData.reduce((a, r) => a + (r.deep_sleep_min ?? 0), 0) / sleepData.length) : 'N/A'
  const avgRem   = sleepData.length ? Math.round(sleepData.reduce((a, r) => a + (r.rem_sleep_min ?? 0), 0) / sleepData.length) : 'N/A'
  const avgSteps = stepsData.length ? Math.round(stepsData.reduce((a, r) => a + r.count, 0) / stepsData.length) : 'N/A'
  const avgHrv   = hrvData.length   ? Math.round(hrvData.reduce((a, r) => a + r.sdnn_ms, 0) / hrvData.length) : 'N/A'

  const workoutSummary = workouts.reduce((acc: Record<string, number>, w) => {
    acc[w.workout_type] = (acc[w.workout_type] ?? 0) + 1
    return acc
  }, {})
  const workoutStr = Object.entries(workoutSummary).map(([t, c]) => `${t}: ${c}x`).join(', ') || 'None'

  const prompt = `Generate a doctor visit summary for this patient.

Patient: ${user?.name ?? 'Varane'}, Age ${user?.age ?? 28}
Height: ${user?.height_cm}cm | Weight: ${user?.weight_kg}kg
Goals: ${(user?.fitness_goals ?? []).join(', ')}
Conditions: ${(user?.conditions ?? []).join(', ') || 'None'}
Medications: ${(user?.medications ?? []).join(', ') || 'None'}
Allergies: ${(user?.allergies ?? []).join(', ') || 'None'}

Data period: ${fromDate} to ${toDate} (${days} days)

Averages:
- Sleep: ${avgSleep}h/night (${avgDeep}min deep, ${avgRem}min REM)
- HRV: ${avgHrv}ms | Steps: ${avgSteps}/day
- Workouts: ${workoutStr}

Daily scores summary (last ${Math.min(scores.length, 7)} days):
${scores.slice(-7).map(s => `${s.date}: Sleep ${Math.round(s.sleep_score ?? 0)}, Recovery ${Math.round(s.recovery_score ?? 0)}, Strain ${Math.round(s.strain_score ?? 0)}, Care ${Math.round(s.care_score ?? 0)}`).join('\n')}

User-reported symptoms: ${symptoms || 'None reported'}`

  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    max_tokens: 1024,
    messages: [
      {
        role: 'system',
        content: `You are a medical documentation assistant. Generate a concise doctor visit summary. Return ONLY valid JSON:
{
  "summary": "2-3 sentence patient overview for the doctor",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "recommendations": ["rec 1", "rec 2", "rec 3"],
  "questionsForDoctor": ["question 1", "question 2"]
}
Never diagnose — describe patterns and flag for professional evaluation.`,
      },
      { role: 'user', content: prompt },
    ],
  })

  const text = completion.choices[0]?.message?.content ?? ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text, keyFindings: [], recommendations: [], questionsForDoctor: [] }

    // Save report to Supabase
    await supabaseAdmin.from('doc_reports').insert({
      user_id: userId,
      date_from: fromDate,
      date_to: toDate,
      report_json: parsed,
    })

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ summary: text, keyFindings: [], recommendations: [], questionsForDoctor: [] })
  }
}

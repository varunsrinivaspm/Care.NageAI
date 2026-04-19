import Groq from 'groq-sdk'
import { NextRequest } from 'next/server'
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase-admin'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

interface Message {
  role: 'user' | 'assistant'
  content: string
}

async function buildSystemPrompt(): Promise<string> {
  const userId = DEMO_USER_ID

  const [userRes, weeklyRes, latestScoreRes] = await Promise.all([
    supabaseAdmin.from('users').select('*').eq('id', userId).single(),
    supabaseAdmin.from('v_weekly_summary').select('*').eq('user_id', userId).single(),
    supabaseAdmin.from('v_latest_scores').select('*').eq('user_id', userId).single(),
  ])

  const u = userRes.data
  const w = weeklyRes.data
  const s = latestScoreRes.data

  const profile = u ? `
Name: ${u.name}, Age ${u.age}
Height: ${u.height_cm}cm | Weight: ${u.weight_kg}kg
Goals: ${(u.fitness_goals ?? []).join(', ')}
Conditions: ${(u.conditions ?? []).join(', ') || 'None'}
Medications: ${(u.medications ?? []).join(', ') || 'None'}
Targets: ${u.sleep_target_hrs}h sleep, ${u.steps_target} steps/day, ${u.protein_target_g}g protein` : 'Profile unavailable'

  const weekly = w ? `
7-day averages:
- Sleep: ${w.avg_sleep_hrs}h (deep: ${w.avg_deep_min}min, REM: ${w.avg_rem_min}min)
- Resting HR: ${w.avg_resting_hr}bpm | HRV: ${w.avg_hrv_ms}ms
- Steps: ${Number(w.avg_daily_steps).toLocaleString()}/day
- Workouts: ${w.workout_count} sessions this week` : ''

  const scores = s ? `
Today's scores:
- Sleep: ${Math.round(s.sleep_score ?? 0)}/100
- Recovery: ${Math.round(s.recovery_score ?? 0)}/100
- Strain: ${Math.round(s.strain_score ?? 0)}/100
- Care Score: ${Math.round(s.care_score ?? 0)}/100` : ''

  return `You are CarePal, an AI personal health advisor integrated into CareNageAI.

Persona: warm, empathetic, evidence-based, and medically cautious. Like a knowledgeable friend who happens to be a doctor — approachable, not clinical.

User EMR:
${profile}
${weekly}
${scores}

Guidelines:
- Anchor advice to the user's real goals and biometric data above
- Flag anything outside normal ranges and recommend professional consultation
- Never diagnose — frame as possibilities
- Tailor workout intensity to current strain + recovery scores
- Be concise and actionable`
}

export async function POST(req: NextRequest) {
  const { messages }: { messages: Message[] } = await req.json()

  const systemPrompt = await buildSystemPrompt()

  const stream = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: true,
    max_tokens: 1024,
  })

  // Save user message to chat history (fire-and-forget)
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  if (lastUserMsg) {
    supabaseAdmin.from('chat_history').insert({
      user_id: DEMO_USER_ID,
      role: 'user',
      content: lastUserMsg.content,
    }).then(() => {})
  }

  const encoder = new TextEncoder()
  let fullResponse = ''

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) {
          fullResponse += text
          controller.enqueue(encoder.encode(text))
        }
      }
      // Save assistant response to chat history
      if (fullResponse) {
        supabaseAdmin.from('chat_history').insert({
          user_id: DEMO_USER_ID,
          role: 'assistant',
          content: fullResponse,
        }).then(() => {})
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

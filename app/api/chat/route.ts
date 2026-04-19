import Groq from 'groq-sdk'
import { NextRequest } from 'next/server'
import { supabaseAdmin, getAuthUserId } from '@/lib/supabase-admin'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

interface Message {
  role: 'user' | 'assistant'
  content: string
}

async function buildSystemPrompt(req: NextRequest): Promise<string> {
  // Fetch the same data the Care Board shows (includes dummy fallback)
  const scoresRes = await fetch(`${req.nextUrl.origin}/api/scores`, {
    headers: { cookie: req.headers.get('cookie') ?? '' },
  })
  const scores = scoresRes.ok ? await scoresRes.json() : null

  const t = scores?.today
  const w = scores?.weekly

  const profile = `
Name: Varun, Age 28
Goals: ${scores ? 'Improve health & fitness' : 'N/A'}
Targets: 7.5h sleep, 10,000 steps/day`

  const weekly = w ? `
7-day averages:
- Sleep: ${w.avg_sleep_hrs}h (deep: ${w.avg_deep_min ?? '—'}min, REM: ${w.avg_rem_min ?? '—'}min)
- HRV: ${w.avg_hrv_ms ?? '—'}ms
- Steps: ${w.avg_daily_steps ? Number(w.avg_daily_steps).toLocaleString() : '—'}/day
- Workouts: ${w.workout_count} sessions this week` : ''

  const todayScores = t ? `
Today's scores (same as Care Board):
- Sleep Score: ${Math.round(t.sleep_score ?? 0)}/100
- Recovery Score: ${Math.round(t.recovery_score ?? 0)}/100
- Strain Score: ${Math.round(t.strain_score ?? 0)}/100
- Sleep: ${t.sleep_hrs ?? '—'}h (${t.deep_sleep_min ?? '—'}min deep, ${t.rem_sleep_min ?? '—'}min REM)
- Steps today: ${t.steps ? t.steps.toLocaleString() : '—'}
- HRV: ${t.hrv_ms ?? '—'}ms` : ''

  return `You are CarePal, an AI personal health advisor integrated into CareNageAI.

Persona: warm, empathetic, evidence-based, and medically cautious. Like a knowledgeable friend who happens to be a doctor — approachable, not clinical.

User profile:
${profile}
${weekly}
${todayScores}

Guidelines:
- Anchor advice to the user's real biometric data shown above — this is the same data on their Care Board
- Flag anything outside normal ranges and recommend professional consultation
- Never diagnose — frame as possibilities
- Tailor workout intensity to current strain + recovery scores
- Be concise and actionable`
}

export async function POST(req: NextRequest) {
  const { messages }: { messages: Message[] } = await req.json()
  const userId = await getAuthUserId()
  const systemPrompt = await buildSystemPrompt(req)

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
      user_id: userId,
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
          user_id: userId,
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

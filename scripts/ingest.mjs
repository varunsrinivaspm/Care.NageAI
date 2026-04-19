/**
 * Apple Health XML → Supabase ingestion script
 * Usage: node scripts/ingest.mjs
 */

import fs from 'fs'
import sax from 'sax'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const XML_PATH = '/Users/varane007/Buildathon/apple_health_export 2/export.xml'
const BATCH_SIZE = 500

// ── Accumulators ──────────────────────────────────────────────
const heartRates  = []
const hrvRows     = []
const stepsByDay  = {}   // date → total steps
const sleepSegs   = []   // raw segments, aggregated after parse
const workouts    = []

let currentWorkout = null
let workoutHrSum = 0, workoutHrCount = 0

let parsed = 0
const t0 = Date.now()

// ── Helpers ───────────────────────────────────────────────────
function toISO(appleDate) {
  // "2024-08-16 00:24:57 +0530" → ISO
  return new Date(appleDate).toISOString()
}

function dateOf(appleDate) {
  // Returns "YYYY-MM-DD" in local time of the timestamp
  const d = new Date(appleDate)
  return d.toISOString().split('T')[0]
}

function durationMin(start, end) {
  return (new Date(end) - new Date(start)) / 60000
}

function hrContext(sourceName, value) {
  const bpm = parseFloat(value)
  if (bpm < 80) return 'resting'
  if (bpm > 120) return 'active'
  return 'active'
}

// ── Batch insert helper ───────────────────────────────────────
async function batchInsert(table, rows, conflict) {
  if (!rows.length) return
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = conflict
      ? await supabase.from(table).upsert(batch, { onConflict: conflict })
      : await supabase.from(table).insert(batch)
    if (error) console.error(`  ⚠ ${table} batch error:`, error.message)
    else inserted += batch.length
  }
  console.log(`  ✓ ${table}: ${inserted} rows`)
}

// ── SAX streaming parse ───────────────────────────────────────
function parse() {
  return new Promise((resolve, reject) => {
    const parser = sax.createStream(false, { lowercase: true, trim: true })

    parser.on('opentag', ({ name, attributes: a }) => {
      parsed++
      if (parsed % 100000 === 0) process.stdout.write(`  parsed ${(parsed/1000).toFixed(0)}k tags...\r`)

      // ── Heart Rate ──
      if (name === 'record' && a.type === 'HKQuantityTypeIdentifierHeartRate') {
        heartRates.push({
          user_id:   USER_ID,
          timestamp: toISO(a.startdate),
          bpm:       parseFloat(a.value),
          context:   hrContext(a.sourcename, a.value),
          source:    'apple_watch',
        })
      }

      // ── HRV ──
      else if (name === 'record' && a.type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') {
        hrvRows.push({
          user_id:   USER_ID,
          timestamp: toISO(a.startdate),
          sdnn_ms:   parseFloat(a.value),
          source:    'apple_watch',
        })
      }

      // ── Steps ──
      else if (name === 'record' && a.type === 'HKQuantityTypeIdentifierStepCount') {
        const date = dateOf(a.startdate)
        stepsByDay[date] = (stepsByDay[date] || 0) + Math.round(parseFloat(a.value))
      }

      // ── Sleep ──
      else if (name === 'record' && a.type === 'HKCategoryTypeIdentifierSleepAnalysis') {
        const val = (a.value || '').toLowerCase()
        if (val.includes('inbed')) return // skip InBed segments
        const min = durationMin(a.startdate, a.enddate)
        let stage = 'light'
        if (val.includes('deep'))  stage = 'deep'
        else if (val.includes('rem'))  stage = 'rem'
        else if (val.includes('awake')) stage = 'awake'
        sleepSegs.push({
          start: new Date(a.startdate),
          end:   new Date(a.enddate),
          stage,
          min,
          source: a.sourcename || 'apple_watch',
        })
      }

      // ── Workout start ──
      else if (name === 'workout') {
        const type = (a.workoutactivitytype || '')
          .replace('HKWorkoutActivityType', '')
          .replace(/([A-Z])/g, ' $1').trim()
        currentWorkout = {
          user_id:      USER_ID,
          date:         dateOf(a.startdate),
          workout_type: type,
          duration_min: parseFloat(a.duration || 0),
          calories:     parseFloat(a.totalenergyburned || 0),
          start_time:   toISO(a.startdate),
          end_time:     toISO(a.enddate),
          avg_hr:       null,
          max_hr:       null,
          source:       'apple_watch',
        }
        workoutHrSum = 0
        workoutHrCount = 0
      }

      // ── Workout HR stats ──
      else if (name === 'workoutstatistics' && currentWorkout) {
        const type = (a.type || '').toLowerCase()
        if (type.includes('heartrate')) {
          if (a.average) currentWorkout.avg_hr = parseFloat(a.average)
          if (a.maximum) currentWorkout.max_hr = parseFloat(a.maximum)
        }
      }
    })

    parser.on('closetag', name => {
      if (name === 'workout' && currentWorkout) {
        workouts.push(currentWorkout)
        currentWorkout = null
      }
    })

    parser.on('error', e => {
      parser.resume() // skip malformed nodes
    })

    parser.on('end', resolve)

    fs.createReadStream(XML_PATH).pipe(parser)
  })
}

// ── Aggregate sleep segments into nightly records ─────────────
function aggregateSleep(segments) {
  // Group segments by "sleep date" = date of wake-up
  // Sleep starting before 3pm is attributed to previous day
  const nights = {}

  for (const seg of segments) {
    const hour = seg.start.getHours()
    const baseDate = new Date(seg.start)
    if (hour < 15) baseDate.setDate(baseDate.getDate() - 1)
    const date = baseDate.toISOString().split('T')[0]

    if (!nights[date]) {
      nights[date] = { deep: 0, rem: 0, light: 0, awake: 0, total: 0, starts: [], ends: [], source: seg.source }
    }
    const n = nights[date]
    n[seg.stage] += seg.min
    n.total += seg.min
    n.starts.push(seg.start)
    n.ends.push(seg.end)
  }

  return Object.entries(nights)
    .filter(([, n]) => n.total > 60) // skip fragments < 1h
    .map(([date, n]) => ({
      user_id:         USER_ID,
      date,
      bedtime:         new Date(Math.min(...n.starts)).toISOString(),
      wake_time:       new Date(Math.max(...n.ends)).toISOString(),
      duration_min:    Math.round(n.total),
      deep_sleep_min:  Math.round(n.deep),
      rem_sleep_min:   Math.round(n.rem),
      light_sleep_min: Math.round(n.light),
      awake_min:       Math.round(n.awake),
      source:          n.source,
    }))
}

// ── Score calculation ─────────────────────────────────────────
async function computeScores() {
  console.log('\n📊 Computing scores...')

  // Pull what we need
  const { data: sleepRows } = await supabase.from('sleep_records').select('date, duration_min').eq('user_id', USER_ID)
  const { data: stepsRows }  = await supabase.from('steps').select('date, count').eq('user_id', USER_ID)
  const { data: hrvRows2 }   = await supabase.from('hrv').select('timestamp, sdnn_ms').eq('user_id', USER_ID).order('timestamp')

  const sleepMap = new Map((sleepRows || []).map(r => [r.date, r.duration_min]))
  const stepsMap = new Map((stepsRows || []).map(r => [r.date, r.count]))

  // 7-day rolling HRV average for each date
  const hrvByDay = {}
  for (const r of (hrvRows2 || [])) {
    const d = r.timestamp.split('T')[0]
    if (!hrvByDay[d]) hrvByDay[d] = []
    hrvByDay[d].push(r.sdnn_ms)
  }
  const allHrvDates = Object.keys(hrvByDay).sort()

  const scoreRows = []
  const SLEEP_TARGET = 7.5 * 60  // 7.5h in minutes
  const STEPS_TARGET = 10000

  const allDates = [...new Set([...sleepMap.keys(), ...stepsMap.keys()])]

  for (const date of allDates) {
    const sleepMin = sleepMap.get(date)
    const steps    = stepsMap.get(date)

    const sleep_score = sleepMin
      ? Math.min(100, Math.round((sleepMin / SLEEP_TARGET) * 100))
      : null

    const strain_score = steps
      ? Math.min(100, Math.round((steps / STEPS_TARGET) * 100))
      : null

    // HRV recovery: compare today vs 7-day avg
    const dateIdx = allHrvDates.indexOf(date)
    let recovery_score = null
    if (hrvByDay[date]) {
      const todayHrv = hrvByDay[date].reduce((a, b) => a + b, 0) / hrvByDay[date].length
      const window = allHrvDates.slice(Math.max(0, dateIdx - 7), dateIdx)
      if (window.length >= 1) {
        const allVals = window.flatMap(d => hrvByDay[d])
        const avg = allVals.reduce((a, b) => a + b, 0) / allVals.length
        recovery_score = Math.min(100, Math.round((todayHrv / avg) * 100))
      }
    }

    const validScores = [sleep_score, recovery_score, strain_score].filter(v => v !== null)
    const care_score = validScores.length
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null

    scoreRows.push({ user_id: USER_ID, date, sleep_score, recovery_score, strain_score, care_score })
  }

  await batchInsert('scores', scoreRows, 'user_id,date')
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--scores-only')) {
    await computeScores()
    return
  }
  console.log('🍎 Parsing Apple Health export (815MB — this takes ~2 min)...\n')
  await parse()
  console.log(`\n✅ Parse complete. Processing...\n`)

  // Insert heart rate
  console.log('💓 Inserting heart rate...')
  await batchInsert('heart_rate', heartRates, null)

  // Insert HRV
  console.log('📈 Inserting HRV...')
  await batchInsert('hrv', hrvRows, null)

  // Insert steps
  console.log('👟 Inserting steps...')
  const stepsRows = Object.entries(stepsByDay).map(([date, count]) => ({
    user_id: USER_ID, date, count, source: 'apple_watch'
  }))
  await batchInsert('steps', stepsRows, 'user_id,date')

  // Aggregate + insert sleep
  console.log('😴 Aggregating sleep records...')
  const sleepNights = aggregateSleep(sleepSegs)
  console.log(`  Found ${sleepNights.length} nights`)
  await batchInsert('sleep_records', sleepNights, 'user_id,date')

  // Insert workouts
  console.log('🏋️  Inserting workouts...')
  await batchInsert('workouts', workouts, null)

  // Compute scores
  await computeScores()

  // Log sync
  await supabase.from('sync_log').insert({
    user_id:          USER_ID,
    source:           'apple_xml',
    records_received: heartRates.length + hrvRows.length + stepsRows.length + sleepSegs.length + workouts.length,
    records_inserted: heartRates.length + hrvRows.length + stepsRows.length + sleepSegs.length + workouts.length,
    metrics_detail:   `hr:${heartRates.length} hrv:${hrvRows.length} steps:${stepsRows.length} sleep:${sleepSegs.length} workouts:${workouts.length}`,
    status:           'ok',
  })

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n🎉 Done in ${elapsed}s`)
  console.log(`   Heart rate:  ${heartRates.length.toLocaleString()} records`)
  console.log(`   HRV:         ${hrvRows.length.toLocaleString()} records`)
  console.log(`   Steps:       ${stepsRows.length.toLocaleString()} days`)
  console.log(`   Sleep:       ${sleepNights.length} nights`)
  console.log(`   Workouts:    ${workouts.length} sessions`)
}

main().catch(console.error)

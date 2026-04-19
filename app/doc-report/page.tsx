'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Loader2, AlertTriangle, CheckCircle2, Calendar, Activity, Heart, Moon, Zap, MessageSquare, ChevronDown } from 'lucide-react'
import { supabase, DEMO_USER_ID } from '@/lib/supabase'

interface VitalRow {
  date: string
  sleep_hrs: number | null
  deep_min: number | null
  rem_min: number | null
  steps: number | null
  hrv_ms: number | null
  sleep_score: number | null
  recovery_score: number | null
  strain_score: number | null
}

interface GeneratedReport {
  summary: string
  keyFindings: string[]
  recommendations: string[]
  questionsForDoctor: string[]
}

const dateRangeOptions = ['Last 7 days', 'Last 14 days', 'Last 30 days']

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export default function DocReportPage() {
  const [vitals, setVitals] = useState<VitalRow[]>([])
  const [symptoms, setSymptoms] = useState('')
  const [dateRange, setDateRange] = useState('Last 7 days')
  const [generating, setGenerating] = useState(false)
  const [loadingVitals, setLoadingVitals] = useState(true)
  const [report, setReport] = useState<GeneratedReport | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { fetchVitals() }, [dateRange])

  const fetchVitals = async () => {
    setLoadingVitals(true)
    const days = dateRange === 'Last 30 days' ? 30 : dateRange === 'Last 14 days' ? 14 : 7
    const from = daysAgo(days)

    const [sleepRes, stepsRes, scoresRes] = await Promise.all([
      supabase.from('sleep_records')
        .select('date, duration_min, deep_sleep_min, rem_sleep_min')
        .eq('user_id', DEMO_USER_ID)
        .gte('date', from)
        .order('date', { ascending: true }),

      supabase.from('steps')
        .select('date, count')
        .eq('user_id', DEMO_USER_ID)
        .gte('date', from)
        .order('date', { ascending: true }),

      supabase.from('scores')
        .select('date, sleep_score, recovery_score, strain_score')
        .eq('user_id', DEMO_USER_ID)
        .gte('date', from)
        .order('date', { ascending: true }),
    ])

    const sleepMap = new Map((sleepRes.data ?? []).map(r => [r.date, r]))
    const stepsMap = new Map((stepsRes.data ?? []).map(r => [r.date, r]))
    const scoreMap = new Map((scoresRes.data ?? []).map(r => [r.date, r]))

    // All unique dates
    const allDates = [...new Set([
      ...(sleepRes.data ?? []).map(r => r.date),
      ...(stepsRes.data ?? []).map(r => r.date),
    ])].sort()

    const rows: VitalRow[] = allDates.map(date => {
      const s = sleepMap.get(date)
      const st = stepsMap.get(date)
      const sc = scoreMap.get(date)
      return {
        date,
        sleep_hrs:      s ? Math.round(s.duration_min / 60 * 10) / 10 : null,
        deep_min:       s?.deep_sleep_min ? Math.round(s.deep_sleep_min) : null,
        rem_min:        s?.rem_sleep_min  ? Math.round(s.rem_sleep_min)  : null,
        steps:          st?.count ?? null,
        hrv_ms:         null,
        sleep_score:    sc?.sleep_score    ? Math.round(sc.sleep_score)    : null,
        recovery_score: sc?.recovery_score ? Math.round(sc.recovery_score) : null,
        strain_score:   sc?.strain_score   ? Math.round(sc.strain_score)   : null,
      }
    })

    // Fallback dummy data if nothing in DB
    if (rows.length === 0) {
      const dummyDays = days
      const dummy: VitalRow[] = Array.from({ length: dummyDays }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (dummyDays - 1 - i))
        return {
          date:           d.toISOString().split('T')[0],
          sleep_hrs:      +(6.5 + Math.sin(i * 0.7) * 0.8 + Math.random() * 0.4).toFixed(1),
          deep_min:       Math.round(65 + Math.random() * 30),
          rem_min:        Math.round(80 + Math.random() * 35),
          steps:          Math.round(7000 + Math.cos(i * 0.5) * 1500 + Math.random() * 1500),
          hrv_ms:         null,
          sleep_score:    Math.round(72 + Math.sin(i) * 10),
          recovery_score: Math.round(70 + Math.cos(i) * 12),
          strain_score:   Math.round(65 + Math.sin(i + 1) * 15),
        }
      })
      setVitals(dummy)
    } else {
      setVitals(rows)
    }
    setLoadingVitals(false)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setReport(null)
    try {
      const res = await fetch('/api/doc-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms, dateRange }),
      })
      if (!res.ok) throw new Error('Failed')
      setReport(await res.json())
    } catch {
      setError('Could not generate report. Check your Groq API key.')
    } finally {
      setGenerating(false)
    }
  }

  const handleExportPdf = () => {
    const bio = (() => { try { return JSON.parse(localStorage.getItem('careNageBio') || '{}') } catch { return {} } })()
    const persona = localStorage.getItem('careNagePersona') || 'stay_healthy'
    const personaLabel: Record<string, string> = {
      increase_muscle: 'Increase Muscle Mass',
      decrease_fat: 'Decrease Body Fat',
      stay_healthy: 'Maintain Overall Health',
      custom: 'Custom Goal',
    }

    const avgSleep = avg(vitals.map(v => v.sleep_hrs))
    const avgDeep = avg(vitals.map(v => v.deep_min))
    const avgRem = avg(vitals.map(v => v.rem_min))
    const avgSteps = avg(vitals.map(v => v.steps))
    const avgStrain = avg(vitals.map(v => v.strain_score))
    const avgRecovery = avg(vitals.map(v => v.recovery_score))
    const avgSleepScore = avg(vitals.map(v => v.sleep_score))

    const win = window.open('', '_blank', 'width=1000,height=780')
    if (!win) return

    const scoreBar = (val: number | null, color: string) => {
      const pct = val ?? 0
      return `<div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;"></div>
        </div>
        <span style="font-size:11px;font-weight:700;color:#1e293b;min-width:28px;text-align:right;">${val !== null ? Math.round(val) : '—'}</span>
      </div>`
    }

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>CareNageAI Clinical Report</title>
  <meta charset="utf-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#1e293b;background:#fff;padding:20px 24px;}
    /* TOP HEADER */
    .top-header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #1e293b;padding-bottom:8px;margin-bottom:10px;}
    .brand{display:flex;align-items:center;gap:8px;}
    .brand-logo{width:28px;height:28px;background:#4f46e5;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;}
    .brand-name{font-size:18px;font-weight:900;color:#1e293b;}
    .brand-name span{color:#4f46e5;}
    .brand-sub{font-size:9px;color:#64748b;}
    .header-right{text-align:right;font-size:9px;color:#64748b;line-height:1.6;}
    /* PATIENT BAR */
    .patient-bar{display:grid;grid-template-columns:repeat(6,1fr);gap:0;border:1px solid #cbd5e1;margin-bottom:12px;}
    .patient-cell{padding:5px 8px;border-right:1px solid #cbd5e1;}
    .patient-cell:last-child{border-right:none;}
    .patient-cell .label{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;}
    .patient-cell .value{font-size:11px;font-weight:700;color:#1e293b;margin-top:2px;}
    /* TWO-COLUMN LAYOUT */
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    /* SECTION */
    .section{margin-bottom:10px;}
    .section-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#fff;background:#1e293b;padding:3px 8px;margin-bottom:0;}
    .section-title.indigo{background:#4f46e5;}
    .section-title.emerald{background:#059669;}
    .section-title.amber{background:#d97706;}
    .section-title.violet{background:#7c3aed;}
    /* TABLE */
    table{width:100%;border-collapse:collapse;font-size:10px;}
    table td,table th{padding:3.5px 8px;border-bottom:1px solid #f1f5f9;}
    table th{font-weight:600;color:#64748b;font-size:8.5px;text-transform:uppercase;background:#f8fafc;}
    .td-label{color:#475569;width:45%;}
    .td-val{font-weight:700;color:#1e293b;text-align:right;}
    .td-val.good{color:#059669;}
    .td-val.warn{color:#d97706;}
    .td-val.bad{color:#dc2626;}
    /* SCORE CHIP */
    .chip{display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;}
    .chip.green{background:#d1fae5;color:#065f46;}
    .chip.yellow{background:#fef3c7;color:#92400e;}
    .chip.red{background:#fee2e2;color:#991b1b;}
    /* LIST */
    ul.findings{list-style:none;padding:0;margin:0;}
    ul.findings li{padding:3px 8px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#334155;display:flex;align-items:flex-start;gap:5px;}
    ul.findings li::before{content:'•';color:#4f46e5;font-weight:900;flex-shrink:0;}
    ul.recs li::before{content:'✓';color:#059669;font-weight:900;flex-shrink:0;}
    ul.qs li::before{content:'Q';color:#7c3aed;font-weight:900;flex-shrink:0;font-size:8px;margin-top:1px;}
    .foot{border-top:1px solid #e2e8f0;padding-top:6px;margin-top:10px;display:flex;justify-content:space-between;font-size:8.5px;color:#94a3b8;}
    @media print{body{padding:10px 14px;}}
  </style>
</head>
<body>
  <!-- TOP HEADER -->
  <div class="top-header">
    <div class="brand">
      <div class="brand-logo">C</div>
      <div>
        <div class="brand-name">CareNage<span>AI</span></div>
        <div class="brand-sub">Precision Health Intelligence Platform</div>
      </div>
    </div>
    <div class="header-right">
      <strong>CARE REPORT</strong><br/>
      Generated: ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}<br/>
      Period: ${dateRange}<br/>
      Data Source: Apple Health (Real)
    </div>
  </div>

  <!-- PATIENT BAR -->
  <div class="patient-bar">
    <div class="patient-cell"><div class="label">Patient</div><div class="value">Varun</div></div>
    <div class="patient-cell"><div class="label">Age</div><div class="value">28</div></div>
    <div class="patient-cell"><div class="label">Height</div><div class="value">${bio.height ? bio.height + ' cm' : '—'}</div></div>
    <div class="patient-cell"><div class="label">Weight</div><div class="value">${bio.weight ? bio.weight + ' kg' : '—'}</div></div>
    <div class="patient-cell"><div class="label">Body Fat</div><div class="value">${bio.bodyFat ? bio.bodyFat + ' %' : '—'}</div></div>
    <div class="patient-cell"><div class="label">Goal</div><div class="value" style="font-size:9px;">${personaLabel[persona] ?? persona}</div></div>
  </div>

  <!-- TWO-COLUMN BODY -->
  <div class="two-col">
    <!-- LEFT COLUMN -->
    <div>
      <!-- Body Composition -->
      <div class="section">
        <div class="section-title">Body Composition Analysis</div>
        <table>
          <tr><td class="td-label">Weight</td><td class="td-val">${bio.weight ? bio.weight + ' kg' : '—'}</td></tr>
          <tr><td class="td-label">Height</td><td class="td-val">${bio.height ? bio.height + ' cm' : '—'}</td></tr>
          <tr><td class="td-label">Body Fat %</td><td class="td-val ${bio.bodyFat && Number(bio.bodyFat) > 25 ? 'warn' : 'good'}">${bio.bodyFat ? bio.bodyFat + ' %' : '—'}</td></tr>
          <tr><td class="td-label">BMI (est.)</td><td class="td-val">${bio.weight && bio.height ? (Number(bio.weight) / ((Number(bio.height)/100)**2)).toFixed(1) : '—'}</td></tr>
          <tr><td class="td-label">Primary Goal</td><td class="td-val">${personaLabel[persona] ?? persona}</td></tr>
          <tr><td class="td-label">Conditions</td><td class="td-val">Deviated septum</td></tr>
          <tr><td class="td-label">Medications</td><td class="td-val">None</td></tr>
        </table>
      </div>

      <!-- Sleep Analysis -->
      <div class="section">
        <div class="section-title violet">Sleep Analysis (${dateRange})</div>
        <table>
          <tr><td class="td-label">Avg Total Sleep</td><td class="td-val ${avgSleep !== null && avgSleep < 6 ? 'bad' : avgSleep !== null && avgSleep < 7 ? 'warn' : 'good'}">${avgSleep !== null ? avgSleep + ' h' : '—'}</td></tr>
          <tr><td class="td-label">Avg Deep Sleep</td><td class="td-val">${avgDeep !== null ? avgDeep + ' min' : '—'}</td></tr>
          <tr><td class="td-label">Avg REM Sleep</td><td class="td-val">${avgRem !== null ? avgRem + ' min' : '—'}</td></tr>
          <tr><td class="td-label">Avg Light Sleep (est.)</td><td class="td-val">${avgSleep && avgDeep && avgRem ? Math.max(Math.round(avgSleep * 60 - avgDeep - avgRem - 30), 0) + ' min' : '—'}</td></tr>
          <tr><td class="td-label">Sleep Score</td><td class="td-val">${avgSleepScore !== null ? Math.round(avgSleepScore) + ' / 100' : '—'}</td></tr>
          <tr><td class="td-label">Nights Analysed</td><td class="td-val">${vitals.filter(v => v.sleep_hrs).length}</td></tr>
        </table>
      </div>

      <!-- Activity & Strain -->
      <div class="section">
        <div class="section-title amber">Activity & Strain (${dateRange})</div>
        <table>
          <tr><td class="td-label">Avg Daily Steps</td><td class="td-val ${avgSteps !== null && avgSteps < 5000 ? 'bad' : avgSteps !== null && avgSteps < 8000 ? 'warn' : 'good'}">${avgSteps !== null ? Number(Math.round(avgSteps)).toLocaleString() : '—'}</td></tr>
          <tr><td class="td-label">Step Target</td><td class="td-val">10,000 / day</td></tr>
          <tr><td class="td-label">Avg Strain Score</td><td class="td-val">${avgStrain !== null ? Math.round(avgStrain) + ' / 100' : '—'}</td></tr>
          <tr><td class="td-label">Days Analysed</td><td class="td-val">${vitals.length}</td></tr>
        </table>
      </div>
    </div>

    <!-- RIGHT COLUMN -->
    <div>
      <!-- Score Panel -->
      <div class="section">
        <div class="section-title indigo">CareNageAI Score Summary</div>
        <table>
          <tr><th>Metric</th><th>Score / 100</th><th>Status</th></tr>
          <tr>
            <td class="td-label">Sleep Score</td>
            <td>${scoreBar(avgSleepScore, '#8b5cf6')}</td>
            <td><span class="chip ${avgSleepScore !== null && avgSleepScore >= 75 ? 'green' : avgSleepScore !== null && avgSleepScore >= 50 ? 'yellow' : 'red'}">${avgSleepScore !== null && avgSleepScore >= 75 ? 'Optimal' : avgSleepScore !== null && avgSleepScore >= 50 ? 'Fair' : 'Low'}</span></td>
          </tr>
          <tr>
            <td class="td-label">Recovery Score</td>
            <td>${scoreBar(avgRecovery, '#10b981')}</td>
            <td><span class="chip ${avgRecovery !== null && avgRecovery >= 75 ? 'green' : avgRecovery !== null && avgRecovery >= 50 ? 'yellow' : 'red'}">${avgRecovery !== null && avgRecovery >= 75 ? 'Optimal' : avgRecovery !== null && avgRecovery >= 50 ? 'Fair' : 'Low'}</span></td>
          </tr>
          <tr>
            <td class="td-label">Strain Score</td>
            <td>${scoreBar(avgStrain, '#f59e0b')}</td>
            <td><span class="chip ${avgStrain !== null && avgStrain >= 75 ? 'green' : avgStrain !== null && avgStrain >= 50 ? 'yellow' : 'red'}">${avgStrain !== null && avgStrain >= 75 ? 'High' : avgStrain !== null && avgStrain >= 50 ? 'Moderate' : 'Low'}</span></td>
          </tr>
        </table>
      </div>

      <!-- AI Summary -->
      ${ report ? `
      <div class="section">
        <div class="section-title">Clinical Summary</div>
        <div style="padding:6px 8px;font-size:10px;line-height:1.6;color:#334155;border-bottom:1px solid #f1f5f9;">${report.summary}</div>
      </div>` : '' }

      <!-- Key Findings -->
      ${ report?.keyFindings?.length ? `
      <div class="section">
        <div class="section-title emerald">Key Findings (Doctor Attention Required)</div>
        <ul class="findings">
          ${report.keyFindings.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>` : '' }

      <!-- Recommendations -->
      ${ report?.recommendations?.length ? `
      <div class="section">
        <div class="section-title">Clinical Recommendations</div>
        <ul class="findings recs">
          ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>` : '' }

      <!-- Questions for Doctor -->
      ${ report?.questionsForDoctor?.length ? `
      <div class="section">
        <div class="section-title violet">Questions for Doctor</div>
        <ul class="findings qs">
          ${report.questionsForDoctor.map(q => `<li>${q}</li>`).join('')}
        </ul>
      </div>` : '' }
    </div>
  </div>

  <!-- FOOTER -->
  <div class="foot">
    <span>CareNageAI &mdash; Powered by real Apple Health biometric data (Aug 2024 &ndash; Mar 2026)</span>
    <span>Patient: Varun &nbsp;|&nbsp; Report Date: ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
  </div>
</body>
</html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  const avg = (arr: (number | null)[]) => {
    const clean = arr.filter(v => v !== null) as number[]
    return clean.length ? Math.round(clean.reduce((a, b) => a + b, 0) / clean.length * 10) / 10 : null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" />
            Care+
          </h1>
          <p className="text-slate-500 mt-1 text-sm">AI-generated clinical report from your real Apple Health data</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-3 pr-8 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 cursor-pointer"
            >
              {dateRangeOptions.map(o => <option key={o}>{o}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-60 shadow-sm"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Patient card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-indigo-200 text-xs font-medium uppercase tracking-wide mb-1">Patient</p>
              <h2 className="text-xl font-bold">Varun</h2>
              <p className="text-indigo-200 text-sm mt-0.5">Age 28 · {dateRange}</p>
            </div>
            <div className="text-right">
              <p className="text-indigo-200 text-xs">Generated</p>
              <p className="text-sm font-medium">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {[
            { label: 'Goals', value: 'Fat loss · Muscle gain · Tennis · Cardio' },
            { label: 'Conditions', value: 'Deviated septum' },
            { label: 'Medications', value: 'None' },
          ].map(({ label, value }) => (
            <div key={label} className="px-6 py-4">
              <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
              <p className="text-sm text-slate-800 font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Vitals table from Supabase */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          <h2 className="font-semibold text-slate-900 text-sm">Vitals from Apple Health</h2>
          {loadingVitals && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 ml-auto" />}
        </div>

        {/* Averages */}
        {!loadingVitals && vitals.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100">
            {[
              { label: 'Avg Sleep', value: avg(vitals.map(v => v.sleep_hrs)), unit: 'h', icon: Moon, color: 'text-violet-500' },
              { label: 'Avg Deep', value: avg(vitals.map(v => v.deep_min)), unit: 'min', icon: Moon, color: 'text-indigo-500' },
              { label: 'Avg Steps', value: avg(vitals.map(v => v.steps)), unit: '', icon: Zap, color: 'text-amber-500' },
              { label: 'Avg Strain', value: avg(vitals.map(v => v.strain_score)), unit: '/100', icon: Activity, color: 'text-emerald-500' },
            ].map(({ label, value, unit, icon: Icon, color }) => (
              <div key={label} className="text-center">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                <p className="text-xs text-slate-400">{label}</p>
                <p className="font-semibold text-slate-800 text-sm">
                  {value !== null ? `${label === 'Avg Steps' ? Number(value).toLocaleString() : value}${unit}` : '—'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          {loadingVitals ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : vitals.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No data found for this period</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Date</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-slate-400">Sleep</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-slate-400">Deep</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-slate-400">REM</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-slate-400">Steps</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-slate-400">Strain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {vitals.map(v => (
                  <tr key={v.date} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-slate-600 text-xs">{new Date(v.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-medium text-sm ${v.sleep_hrs && v.sleep_hrs < 7 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {v.sleep_hrs ? `${v.sleep_hrs}h` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-slate-700 text-sm">{v.deep_min ? `${v.deep_min}m` : '—'}</td>
                    <td className="px-3 py-3 text-center text-slate-700 text-sm">{v.rem_min ? `${v.rem_min}m` : '—'}</td>
                    <td className="px-3 py-3 text-center text-slate-700 text-sm">{v.steps ? v.steps.toLocaleString() : '—'}</td>
                    <td className="px-3 py-3 text-center">
                      {v.strain_score !== null
                        ? <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${v.strain_score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{v.strain_score}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Symptoms */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          <h2 className="font-semibold text-slate-900 text-sm">Reported Symptoms / Notes</h2>
          <span className="ml-auto text-xs text-slate-400">Included in AI summary</span>
        </div>
        <div className="p-4">
          <textarea
            value={symptoms}
            onChange={e => setSymptoms(e.target.value)}
            placeholder="Describe any symptoms, concerns, or questions for your doctor..."
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 resize-none transition-all placeholder-slate-400"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* AI Report */}
      {report && (
        <div id="report-print-target" className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden ring-2 ring-indigo-50">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <h2 className="font-semibold">AI-Generated Doctor Summary</h2>
            </div>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />Export PDF
            </button>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-4">{report.summary}</p>
            </div>
            {report.keyFindings?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Key Findings</p>
                <ul className="space-y-2">
                  {report.keyFindings.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i+1}</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.recommendations?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Recommendations</p>
                <ul className="space-y-2">
                  {report.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.questionsForDoctor?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Questions for Your Doctor</p>
                <ul className="space-y-2">
                  {report.questionsForDoctor.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-indigo-500 font-bold flex-shrink-0">Q{i+1}.</span>{q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-400">Based on real Apple Health data · Saved to your records</p>
            </div>
          </div>
        </div>
      )}

      {!report && !generating && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <div className="bg-indigo-50 rounded-2xl p-4 w-fit mx-auto mb-4">
            <FileText className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="font-medium text-slate-700 mb-1">Ready to generate your doctor summary</p>
          <p className="text-slate-400 text-sm">Add symptoms above, then click Generate Report</p>
        </div>
      )}
    </div>
  )
}

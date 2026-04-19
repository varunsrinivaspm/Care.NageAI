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

    setVitals(rows)
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
    const el = document.getElementById('report-print-target')
    if (!el) return

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CareNageAI — Doctor Report</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1a202c; padding: 32px; }
            .header { background: linear-gradient(to right, #4f46e5, #6366f1); color: white; padding: 20px 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; justify-content: space-between; }
            .header h2 { font-size: 16px; font-weight: 600; }
            .header .icon-row { display: flex; align-items: center; gap: 8px; }
            .body { border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px; }
            .section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 8px; }
            .summary-box { background: #f8fafc; border-radius: 10px; padding: 16px; font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
            ul { list-style: none; margin-bottom: 20px; }
            ul li { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #334155; margin-bottom: 8px; line-height: 1.5; }
            .num { width: 20px; height: 20px; background: #e0e7ff; color: #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
            .check { color: #10b981; flex-shrink: 0; margin-top: 2px; }
            .q-label { color: #6366f1; font-weight: 700; flex-shrink: 0; }
            .footer { border-top: 1px solid #f1f5f9; padding-top: 12px; font-size: 11px; color: #94a3b8; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="icon-row"><h2>&#x1F4CB; AI-Generated Doctor Summary</h2></div>
            <span style="font-size:11px;opacity:0.8">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div class="body">
            <div class="section-label">Summary</div>
            <div class="summary-box">${report?.summary ?? ''}</div>

            ${ report?.keyFindings?.length ? `
              <div class="section-label">Key Findings</div>
              <ul>${report.keyFindings.map((f, i) => `<li><span class="num">${i+1}</span>${f}</li>`).join('')}</ul>
            ` : '' }

            ${ report?.recommendations?.length ? `
              <div class="section-label">Recommendations</div>
              <ul>${report.recommendations.map(r => `<li><span class="check">&#10003;</span>${r}</li>`).join('')}</ul>
            ` : '' }

            ${ report?.questionsForDoctor?.length ? `
              <div class="section-label">Questions for Your Doctor</div>
              <ul>${report.questionsForDoctor.map((q, i) => `<li><span class="q-label">Q${i+1}.</span>${q}</li>`).join('')}</ul>
            ` : '' }

            <div class="footer">Based on real Apple Health data &middot; Generated by CareNageAI</div>
          </div>
        </body>
      </html>
    `)
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
            Doc 1-Pager
          </h1>
          <p className="text-slate-500 mt-1 text-sm">AI-generated summary from your real Apple Health data</p>
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
              <h2 className="text-xl font-bold">Varane</h2>
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

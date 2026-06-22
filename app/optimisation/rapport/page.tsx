"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Download, TableProperties, FileText, Loader2, Printer } from "lucide-react"
import { TECHNOLOGIES, DEFAULT_PERIODS, DEFAULT_PERIOD_SPANS, INITIAL_CAPACITY, type LShapedResult } from "@/lib/lshaped/types"
import {
  LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts"

function exportToCSV(result: NonNullable<ReturnType<typeof useLShaped>['result']>) {
  const rows: string[][] = [
    ["Section", "Technologie / Variable", "Periode / Iteration", "Valeur", "Unite"],
  ]

  // Investments
  TECHNOLOGIES.forEach((t, i) => {
    DEFAULT_PERIODS.forEach((year, pIdx) => {
      const dx = result.finalSolution.deltaX[i][pIdx]
      const cx = result.finalSolution.cumX[i][pIdx]
      rows.push(["Investissement", t, year.toString(), dx.toFixed(2), "ktep/an"])
      rows.push(["Capacite cumulee", t, year.toString(), cx.toFixed(2), "ktep/an"])
    })
  })

  // Convergence
  result.iterations.forEach(it => {
    rows.push(["Convergence", "LB", it.k.toString(), it.LB.toFixed(2), "M€"])
    rows.push(["Convergence", "UB", it.k.toString(), it.UB.toFixed(2), "M€"])
    rows.push(["Convergence", "Gap", it.k.toString(), (it.gap * 100).toFixed(4), "%"])
  })

  const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "lshaped_resultats.csv"
  a.click()
  URL.revokeObjectURL(url)
}

function exportToJSON(result: NonNullable<ReturnType<typeof useLShaped>['result']>) {
  const data = {
    status: result.status,
    config: result.config,
    totalCost: result.totalCost,
    totalGhg: result.totalGhg,
    finalGap: result.finalGap,
    iterations: result.iterations.length,
    finalSolution: {
      deltaX: result.finalSolution.deltaX,
      cumX: result.finalSolution.cumX,
      investCost: result.finalSolution.investCost,
    },
    convergence: result.iterations.map(it => ({
      k: it.k, LB: it.LB, UB: it.UB, gap: it.gap,
    })),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "lshaped_resultats.json"
  a.click()
  URL.revokeObjectURL(url)
}

// ─── PDF render component (white background, inline styles, no CSS vars) ─────

const TECH_COLORS_PDF: Record<string, string> = {
  PV: '#fbbf24', Wind: '#06b6d4', Gaz: '#3b82f6',
  Pétrole: '#dc2626', GPL: '#16a34a', Condensat: '#f59e0b', Batterie: '#8b5cf6',
}

function Cell({ v, right, bold, color }: { v: string | number; right?: boolean; bold?: boolean; color?: string }) {
  return (
    <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: right ? 'right' : 'left', fontWeight: bold ? 700 : 400, color: color ?? '#111', fontFamily: 'monospace', fontSize: 11 }}>
      {v}
    </td>
  )
}

function Th({ v, right }: { v: string; right?: boolean }) {
  return <th style={{ border: '1px solid #d1d5db', padding: '5px 8px', background: '#f3f4f6', fontWeight: 700, fontSize: 11, textAlign: right ? 'right' : 'left' }}>{v}</th>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 15, fontWeight: 700, borderBottom: '2px solid #3b82f6', paddingBottom: 6, marginTop: 28, marginBottom: 12 }}>{children}</h2>
}

function LShapedPdfContent({ result, paretoPoints }: {
  result: LShapedResult
  paretoPoints: { Z1: number; Z2: number; epsilon: number; solution: { investCost: number } }[]
}) {
  const lastIter = result.iterations[result.iterations.length - 1]
  const nScenarios = result.scenarios.length

  const convData = result.iterations.map(it => ({
    k: it.k,
    LB: parseFloat(it.LB.toFixed(0)),
    UB: parseFloat(it.UB.toFixed(0)),
    Gap: parseFloat((it.gap * 100).toFixed(3)),
  }))

  // Résultats page charts data
  const deltaXChartData = DEFAULT_PERIODS.map((year, pIdx) => {
    const entry: Record<string, number | string> = { year: year.toString() }
    TECHNOLOGIES.forEach((t, i) => { entry[t] = parseFloat(result.finalSolution.deltaX[i][pIdx].toFixed(1)) })
    return entry
  })
  const cumXChartData = DEFAULT_PERIODS.map((year, pIdx) => {
    const entry: Record<string, number | string> = { year: year.toString() }
    TECHNOLOGIES.forEach((t, i) => { entry[t] = parseFloat(result.finalSolution.cumX[i][pIdx].toFixed(1)) })
    return entry
  })
  const avgProdChartData = DEFAULT_PERIODS.map((year, pIdx) => {
    const entry: Record<string, number | string> = { year: year.toString() }
    TECHNOLOGIES.forEach((t, i) => {
      const avg = lastIter.subproblems.reduce(
        (s, sp, w) => s + result.scenarios[w].prob * sp.periods[pIdx].production[i], 0
      )
      entry[t] = parseFloat(avg.toFixed(1))
    })
    const avgDef = lastIter.subproblems.reduce(
      (s, sp, w) => s + result.scenarios[w].prob * sp.periods[pIdx].deficit, 0
    )
    entry['Déficit'] = parseFloat(avgDef.toFixed(1))
    return entry
  })

  // Coupes page: α evolution per scenario
  const alphaEvolData = result.iterations.map(it => {
    const row: Record<string, number> = { k: it.k }
    for (let w = 0; w < nScenarios; w++) {
      const c = it.cuts.find(c2 => c2.scenarioIdx === w)
      if (c) row[`ω${w + 1}`] = parseFloat(c.alpha.toFixed(0))
    }
    return row
  })
  const alphaColors = ['#6366f1', '#f97316', '#22c55e', '#ec4899', '#06b6d4', '#a855f7', '#fbbf24', '#ef4444']

  // Pareto scatter data
  const scatterData = paretoPoints.map((pt, i) => ({
    x: parseFloat(pt.Z2.toFixed(2)),
    y: parseFloat(pt.Z1.toFixed(0)),
    epsilon: pt.epsilon,
    idx: i,
  }))

  return (
    <div style={{ background: '#fff', color: '#111', fontFamily: 'Arial, sans-serif', padding: 32, minWidth: 900, maxWidth: 960 }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: '3px solid #3b82f6', paddingBottom: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Rapport L-Shaped — Planification Énergétique Algérie 2024–2050</h1>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          Généré le {new Date().toLocaleDateString('fr-FR')} · Méthode : Décomposition de Benders (L-Shaped stochastique multiscénario)
        </p>
      </div>

      {/* ── Executive KPIs ── */}
      <SectionTitle>Résultats exécutifs</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Coût total Z₁', v: `${result.totalCost.toFixed(0)} M€`, c: '#3b82f6' },
          { l: 'Émissions Z₂', v: `${result.totalGhg.toFixed(2)} MtCO₂`, c: '#16a34a' },
          { l: 'CAPEX total', v: `${result.finalSolution.investCost.toFixed(0)} M€`, c: '#f59e0b' },
          { l: 'Coût opérationnel', v: `${(result.totalCost - result.finalSolution.investCost).toFixed(0)} M€`, c: '#6366f1' },
          { l: 'Iterations', v: result.iterations.length.toString(), c: '#111' },
          { l: 'Gap final', v: `${(result.finalGap * 100).toFixed(3)}%`, c: result.status === 'converged' ? '#22c55e' : '#f97316' },
          { l: 'Status', v: result.status === 'converged' ? 'Convergé ✓' : 'Max iterations', c: result.status === 'converged' ? '#22c55e' : '#f97316' },
          { l: 'Scénarios |Ω|', v: nScenarios.toString(), c: '#111' },
        ].map(d => (
          <div key={d.l} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', background: '#f9fafb' }}>
            <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>{d.l}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: d.c, margin: '2px 0 0' }}>{d.v}</p>
          </div>
        ))}
      </div>

      {/* ── Configuration ── */}
      <SectionTitle>Configuration du solveur</SectionTitle>
      <table style={{ width: '50%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 16 }}>
        <tbody>
          {[
            ['Scénarios |Ω|', nScenarios],
            ['Pénalité déficit λ_D', `${result.config.lambdaD} M€/ktep`],
            ['Tolérance gap', `${(result.config.tolerance * 100).toFixed(2)}%`],
            ['Itérations max', result.config.maxIter],
            ['Horizon', '2024–2050'],
            ['Périodes T', DEFAULT_PERIODS.join(', ')],
          ].map(([k, v]) => (
            <tr key={String(k)}>
              <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 600, fontSize: 11, background: '#f9fafb' }}>{k}</td>
              <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontSize: 11 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Convergence chart ── */}
      <SectionTitle>Convergence — Bornes LB(k) et UB(k)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={convData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="k" tick={{ fontSize: 10 }} label={{ value: 'Itération k', position: 'insideBottom', offset: -2, fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} M€`]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="LB" name="LB (borne inf)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="UB" name="UB (borne sup)" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={convData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="k" tick={{ fontSize: 10 }} label={{ value: 'Itération k', position: 'insideBottom', offset: -2, fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(2)}%`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(3)}%`]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="Gap" name="Gap (%)" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Convergence table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
        <thead>
          <tr><Th v="k" /><Th v="LB (M€)" right /><Th v="UB (M€)" right /><Th v="Gap (%)" right /><Th v="Coupes" right /><Th v="Temps (ms)" right /></tr>
        </thead>
        <tbody>
          {result.iterations.map(it => (
            <tr key={it.k}>
              <Cell v={it.k} bold />
              <Cell v={it.LB.toFixed(1)} right color="#22c55e" />
              <Cell v={it.UB.toFixed(1)} right color="#f97316" />
              <Cell v={`${(it.gap * 100).toFixed(4)}%`} right color={it.gap <= result.config.tolerance ? '#22c55e' : '#f97316'} />
              <Cell v={it.cuts.length} right />
              <Cell v={it.timeMs} right />
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Capacités : Δx et cumX ── */}
      <SectionTitle>Nouvelles capacités installées Δx (ktep/an) — par période</SectionTitle>
      <div style={{ width: '100%', height: 230, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={deltaXChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(0)} ktep/an`]} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {TECHNOLOGIES.map((t, i) => (
              <Line key={t} type="monotone" dataKey={t} stroke={TECH_COLORS_PDF[t]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <SectionTitle>Capacité cumulée x (ktep/an) — évolution du parc 2024–2050</SectionTitle>
      <div style={{ width: '100%', height: 230, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={cumXChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(0)} ktep/an`]} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {TECHNOLOGIES.map((t, i) => (
              <Line key={t} type="monotone" dataKey={t} stroke={TECH_COLORS_PDF[t]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Investment plan ── */}
      <SectionTitle>Plan d'investissement optimal — Δx (ktep/an)</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr>
            <Th v="Technologie" />
            <Th v="x₀" right />
            {DEFAULT_PERIODS.map(y => <Th key={y} v={`Δx ${y}`} right />)}
            {DEFAULT_PERIODS.map(y => <Th key={`c${y}`} v={`x ${y}`} right />)}
            <Th v="+%" right />
          </tr>
        </thead>
        <tbody>
          {TECHNOLOGIES.map((t, i) => {
            const x0 = INITIAL_CAPACITY[t]
            const xFinal = result.finalSolution.cumX[i][DEFAULT_PERIODS.length - 1]
            const growth = x0 > 0 ? ((xFinal - x0) / x0 * 100) : 0
            return (
              <tr key={t}>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 700, fontSize: 11, color: TECH_COLORS_PDF[t] }}>{t}</td>
                <Cell v={x0.toLocaleString()} right />
                {result.finalSolution.deltaX[i].map((dx, p) => (
                  <Cell key={p} v={dx > 0.5 ? dx.toFixed(0) : '—'} right color={dx > 100 ? '#22c55e' : '#111'} bold={dx > 100} />
                ))}
                {result.finalSolution.cumX[i].map((cx, p) => (
                  <Cell key={p} v={cx.toFixed(0)} right />
                ))}
                <Cell v={growth > 0 ? `+${growth.toFixed(0)}%` : '—'} right color={growth > 0 ? '#22c55e' : '#6b7280'} />
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Average production chart ── */}
      <SectionTitle>Production moyenne espérée E[y] — dernière itération (ktep)</SectionTitle>
      <div style={{ width: '100%', height: 230, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={avgProdChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(0)} ktep`]} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {TECHNOLOGIES.map((t) => (
              <Line key={t} type="monotone" dataKey={t} stroke={TECH_COLORS_PDF[t]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
            <Line type="monotone" dataKey="Déficit" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr>
            <Th v="Technologie" />
            {DEFAULT_PERIODS.map(y => <Th key={y} v={String(y)} right />)}
          </tr>
        </thead>
        <tbody>
          {TECHNOLOGIES.map((t, i) => (
            <tr key={t}>
              <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 700, fontSize: 11, color: TECH_COLORS_PDF[t] }}>{t}</td>
              {DEFAULT_PERIODS.map((_, pIdx) => {
                const avg = lastIter.subproblems.reduce(
                  (s, sp, w) => s + result.scenarios[w].prob * sp.periods[pIdx].production[i], 0
                )
                return <Cell key={pIdx} v={avg > 0.5 ? avg.toFixed(0) : '—'} right />
              })}
            </tr>
          ))}
          <tr>
            <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 700, fontSize: 11, color: '#ef4444' }}>Déficit</td>
            {DEFAULT_PERIODS.map((_, pIdx) => {
              const avg = lastIter.subproblems.reduce(
                (s, sp, w) => s + result.scenarios[w].prob * sp.periods[pIdx].deficit, 0
              )
              return <Cell key={pIdx} v={avg > 0.5 ? avg.toFixed(0) : '—'} right color={avg > 0 ? '#ef4444' : '#111'} />
            })}
          </tr>
        </tbody>
      </table>

      {/* ── Per-scenario production charts (last iteration) ── */}
      <SectionTitle>Production par scénario — Dernière itération</SectionTitle>
      {lastIter.subproblems.map((sp, w) => {
        const chartData = sp.periods.map((pd, pIdx) => {
          const entry: Record<string, number | string> = { period: DEFAULT_PERIODS[pIdx].toString() }
          TECHNOLOGIES.forEach((t, i) => { entry[t] = parseFloat(pd.production[i].toFixed(1)) })
          entry['Déficit'] = parseFloat(pd.deficit.toFixed(1))
          return entry
        })
        const totalDef = sp.periods.reduce((s, p) => s + p.deficit, 0)
        return (
          <div key={w} style={{ marginBottom: 20 }}>
            <p style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 6 }}>
              Scénario ω{w + 1} — prob={result.scenarios[w].prob.toFixed(3)} · Coût op.={sp.totalOpCost.toFixed(0)} M€ · GES={sp.totalGhg.toFixed(2)} MtCO₂ · Déficit={totalDef.toFixed(0)} ktep
            </p>
            <div style={{ width: '100%', height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(0)} ktep`]} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  {TECHNOLOGIES.map((t) => (
                    <Line key={t} type="monotone" dataKey={t} stroke={TECH_COLORS_PDF[t]} strokeWidth={1.5} dot={{ r: 2 }} />
                  ))}
                  <Line type="monotone" dataKey="Déficit" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* compact table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 9 }}>
              <thead>
                <tr>
                  <Th v="Période" />
                  {TECHNOLOGIES.map(t => <Th key={t} v={t} right />)}
                  <Th v="Déficit" right />
                  <Th v="GES" right />
                </tr>
              </thead>
              <tbody>
                {sp.periods.map((pd, pIdx) => (
                  <tr key={pIdx}>
                    <Cell v={DEFAULT_PERIODS[pIdx]} bold />
                    {pd.production.map((y, i) => <Cell key={i} v={y > 0.5 ? y.toFixed(0) : '—'} right />)}
                    <Cell v={pd.deficit > 0.5 ? pd.deficit.toFixed(0) : '—'} right color={pd.deficit > 0 ? '#ef4444' : '#111'} />
                    <Cell v={pd.ghg.toFixed(3)} right color="#16a34a" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {/* ── Per-scenario summary ── */}
      <SectionTitle>Résumé par scénario (dernière itération)</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
        <thead>
          <tr>
            <Th v="Scénario ω" />
            <Th v="Probabilité" right />
            <Th v="Coût op. (M€)" right />
            <Th v="GES (MtCO₂)" right />
            <Th v="Déficit total (ktep)" right />
            <Th v="α coupe (M€)" right />
          </tr>
        </thead>
        <tbody>
          {lastIter.subproblems.map((sp, w) => (
            <tr key={w}>
              <Cell v={`ω${w + 1}`} bold />
              <Cell v={result.scenarios[w].prob.toFixed(4)} right />
              <Cell v={sp.totalOpCost.toFixed(1)} right />
              <Cell v={sp.totalGhg.toFixed(3)} right color="#16a34a" />
              <Cell v={sp.periods.reduce((s, p) => s + p.deficit, 0).toFixed(0)} right color={sp.periods.some(p => p.deficit > 0) ? '#ef4444' : '#111'} />
              <Cell v={sp.cut.alpha.toFixed(1)} right />
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Cuts: α evolution chart ── */}
      <SectionTitle>Coupes d'optimalité — Évolution de α_ω(k)</SectionTitle>
      <div style={{ width: '100%', height: 230, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={alphaEvolData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="k" tick={{ fontSize: 10 }} label={{ value: 'Itération k', position: 'insideBottom', offset: -2, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(0)} M€`]} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {Array.from({ length: nScenarios }, (_, w) => (
              <Line key={w} type="monotone" dataKey={`ω${w + 1}`} stroke={alphaColors[w % alphaColors.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Cuts: α table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
        <thead>
          <tr>
            <Th v="k" />
            {result.scenarios.map((_, w) => <Th key={w} v={`ω${w + 1} α`} right />)}
            <Th v="LB (M€)" right />
          </tr>
        </thead>
        <tbody>
          {result.iterations.map(it => (
            <tr key={it.k}>
              <Cell v={it.k} bold />
              {it.cuts.map((c, w) => <Cell key={w} v={c.alpha.toFixed(0)} right />)}
              <Cell v={it.LB.toFixed(1)} right color="#22c55e" />
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Cuts: β coefficients per scenario ── */}
      <SectionTitle>Coefficients β — Gradients de coupes par scénario</SectionTitle>
      {Array.from({ length: nScenarios }, (_, w) => {
        const scenarioCuts = result.iterations.flatMap(it => it.cuts).filter(c => c.scenarioIdx === w)
        if (scenarioCuts.length === 0) return null
        return (
          <div key={w} style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 11, color: '#374151', marginBottom: 4 }}>Scénario ω{w + 1}</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 9, minWidth: 600 }}>
                <thead>
                  <tr>
                    <Th v="k" />
                    <Th v="α" right />
                    {TECHNOLOGIES.flatMap((t, i) =>
                      DEFAULT_PERIODS.map((y, p) => <Th key={`${i}-${p}`} v={`β_${t.slice(0, 3)},${y}`} right />)
                    )}
                  </tr>
                </thead>
                <tbody>
                  {scenarioCuts.map(cut => (
                    <tr key={cut.iteration}>
                      <Cell v={cut.iteration} bold />
                      <Cell v={cut.alpha.toFixed(0)} right />
                      {TECHNOLOGIES.flatMap((_t, i) =>
                        DEFAULT_PERIODS.map((_y, p) => (
                          <Cell key={`${i}-${p}`} v={cut.beta[i][p] !== 0 ? cut.beta[i][p].toExponential(1) : '0'} right color={cut.beta[i][p] < 0 ? '#22c55e' : cut.beta[i][p] > 0 ? '#f97316' : '#9ca3af'} />
                        ))
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* ── Master problem LB progression ── */}
      <SectionTitle>Problème maître — Progression des bornes inférieures</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 11 }}>
        <thead>
          <tr>
            <Th v="k" />
            <Th v="LB (M€)" right />
            <Th v="Σ θ_ω" right />
            <Th v="CAPEX (M€)" right />
            <Th v="Coupes actives" right />
          </tr>
        </thead>
        <tbody>
          {result.iterations.map(it => {
            const thetaSum = it.master.theta.reduce((s: number, v: number) => s + v, 0)
            const nCutsActive = result.iterations.slice(0, it.k).reduce((s, i2) => s + i2.cuts.length, 0)
            return (
              <tr key={it.k}>
                <Cell v={it.k} bold />
                <Cell v={it.LB.toFixed(1)} right color="#22c55e" />
                <Cell v={thetaSum.toFixed(1)} right />
                <Cell v={it.master.investCost.toFixed(1)} right />
                <Cell v={nCutsActive} right />
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Pareto front ── */}
      {paretoPoints.length > 0 && (
        <>
          <SectionTitle>Front de Pareto — Coût Z₁ vs Émissions Z₂ (ε-contrainte)</SectionTitle>
          <div style={{ width: '100%', height: 260, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" dataKey="x" name="GES" domain={['auto', 'auto']} tick={{ fontSize: 10 }}
                  label={{ value: 'Émissions Z₂ (MtCO₂)', position: 'insideBottom', offset: -16, fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="Coût" tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  label={{ value: 'Coût Z₁ (M€)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
                      <p style={{ fontWeight: 700 }}>ε = {d.epsilon.toFixed(1)} MtCO₂</p>
                      <p style={{ color: '#f97316' }}>Z₁ = {d.y.toLocaleString()} M€</p>
                      <p style={{ color: '#16a34a' }}>Z₂ = {d.x.toFixed(2)} MtCO₂</p>
                    </div>
                  )
                }} />
                <Scatter data={scatterData} fill="#6366f1" line={{ stroke: '#6366f1', strokeWidth: 1.5 }} lineType="fitting" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
            <thead>
              <tr>
                <Th v="ε (MtCO₂)" />
                <Th v="Z₁ Coût (M€)" right />
                <Th v="Z₂ GES (MtCO₂)" right />
                <Th v="CAPEX (M€)" right />
                <Th v="Coût op. (M€)" right />
              </tr>
            </thead>
            <tbody>
              {paretoPoints.map((pt, idx) => (
                <tr key={idx}>
                  <Cell v={pt.epsilon.toFixed(1)} bold />
                  <Cell v={pt.Z1.toFixed(0)} right color="#f97316" />
                  <Cell v={pt.Z2.toFixed(2)} right color="#16a34a" />
                  <Cell v={pt.solution.investCost.toFixed(0)} right />
                  <Cell v={(pt.Z1 - pt.solution.investCost).toFixed(0)} right />
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 24, paddingTop: 10, fontSize: 10, color: '#9ca3af' }}>
        Rapport généré automatiquement · PFE BELKACEM Djamila Racha 2026 · Solveur L-Shaped — Décomposition de Benders stochastique
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RapportPage() {
  const { result, paretoPoints } = useLShaped()
  const pdfRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const downloadLShapedPDF = async () => {
    if (!pdfRef.current || !result) return
    setPdfLoading(true)
    try {
      const { toPng } = await import("html-to-image")
      const { default: jsPDF } = await import("jspdf")

      await new Promise(resolve => setTimeout(resolve, 800))

      const dataUrl = await toPng(pdfRef.current, { pixelRatio: 1.6, backgroundColor: '#ffffff' })

      const img = new Image()
      img.src = dataUrl
      await new Promise<void>(resolve => { img.onload = () => resolve() })

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 8
      const usableW = pageW - margin * 2
      const ratio = usableW / img.width
      const scaledH = img.height * ratio
      const pagesNeeded = Math.ceil(scaledH / (pageH - margin * 2))

      for (let p = 0; p < pagesNeeded; p++) {
        if (p > 0) pdf.addPage()
        const srcY = p * (pageH - margin * 2) / ratio
        const sliceH = Math.min((pageH - margin * 2) / ratio, img.height - srcY)
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = sliceH
        canvas.getContext('2d')!.drawImage(img, 0, srcY, img.width, sliceH, 0, 0, img.width, sliceH)
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, usableW, sliceH * ratio)
      }

      pdf.save(`rapport_lshaped_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('PDF error:', err)
      window.alert('Erreur PDF. Essayez Ctrl+P pour imprimer depuis le navigateur.')
    } finally {
      setPdfLoading(false)
    }
  }

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Rapport final</h1>
          <p className="text-muted-foreground">Synthese complete et export des resultats L-Shaped.</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Play className="h-8 w-8 mx-auto mb-4 opacity-40" />
            <p>Aucune resolution. Lancez le solveur d'abord.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/optimisation/resolution">Resolution</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { finalSolution, scenarios, totalCost, totalGhg, iterations } = result
  const nScenarios = scenarios.length
  const lastIter = iterations[iterations.length - 1]

  // Renewable share at each period
  const renewableShare = DEFAULT_PERIODS.map((_, pIdx) => {
    const totalCap = finalSolution.cumX.reduce((s, row) => s + row[pIdx], 0)
    const renewCap = finalSolution.cumX[0][pIdx] + finalSolution.cumX[1][pIdx]  // PV + Wind
    return totalCap > 0 ? (renewCap / totalCap * 100).toFixed(1) : "0.0"
  })

  // GHG reduction compared to baseline (no investment)
  const baselineGhg = scenarios.reduce((s, sc, w) => {
    const baseGhg = sc.periods.reduce((ss, pd, pIdx) => {
      const gasUse = Math.min(INITIAL_CAPACITY['Gaz'], pd.demand)
      return ss + gasUse * 0.00235 * DEFAULT_PERIOD_SPANS[pIdx]
    }, 0)
    return s + sc.prob * baseGhg
  }, 0)
  const ghgReduction = ((baselineGhg - totalGhg) / baselineGhg * 100)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TableProperties className="h-6 w-6 text-chart-2" />
          <h1 className="text-3xl font-bold">Rapport final — Solveur L-Shaped</h1>
        </div>
        <p className="text-muted-foreground">
          Planification energetique Algerie 2024–2050 · Methode L-Shaped stochastique bi-objectif
        </p>
      </div>

      {/* Export buttons */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <Button onClick={downloadLShapedPDF} disabled={pdfLoading} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          {pdfLoading
            ? <><Loader2 className="h-4 w-4 animate-spin" />Génération PDF…</>
            : <><Printer className="h-4 w-4" />Exporter PDF complet</>}
        </Button>
        <Button onClick={() => exportToCSV(result)} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />Export CSV
        </Button>
        <Button onClick={() => exportToJSON(result)} variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />Export JSON
        </Button>
      </div>

      {/* Executive summary */}
      <Card className="mb-6 border-chart-2/30">
        <CardHeader>
          <CardTitle>Synthese executive</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              { l: "Coût total actualisé (Z₁)", v: `${totalCost.toFixed(0)} M€` },
              { l: "Émissions GES (Z₂)", v: `${totalGhg.toFixed(1)} MtCO₂` },
              { l: "Réduction GES vs référence", v: `${ghgReduction.toFixed(1)}%` },
              { l: "Investissement CAPEX", v: `${finalSolution.investCost.toFixed(0)} M€` },
            ].map(d => (
              <div key={d.l} className="p-4 bg-secondary/30 rounded-xl">
                <p className="text-xs text-muted-foreground">{d.l}</p>
                <p className="text-xl font-bold">{d.v}</p>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { l: "Iterations convergence", v: `${iterations.length}` },
              { l: "Gap final", v: `${(result.finalGap * 100).toFixed(3)}%` },
              { l: "Scenarios analysés", v: `${nScenarios}` },
              { l: "Status", v: result.status === 'converged' ? 'Convergé ✓' : 'Max iter' },
            ].map(d => (
              <div key={d.l} className="p-4 bg-secondary/20 rounded-xl">
                <p className="text-xs text-muted-foreground">{d.l}</p>
                <p className="text-xl font-bold">{d.v}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Technologies summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Tableau 1 — Plan d'investissement optimal</CardTitle>
          <CardDescription>{"Nouvelle capacite Δx_{i,t} par technologie et periode (ktep/an)"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border font-medium text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Technologie</th>
                  <th className="text-right py-2 px-3">Capacite initiale</th>
                  {DEFAULT_PERIODS.map(y => <th key={y} className="text-right py-2 px-3">Δx {y}</th>)}
                  <th className="text-right py-2 pl-3">Capacite finale</th>
                  <th className="text-right py-2 pl-3">+%</th>
                </tr>
              </thead>
              <tbody>
                {TECHNOLOGIES.map((t, i) => {
                  const x0 = INITIAL_CAPACITY[t]
                  const xFinal = finalSolution.cumX[i][DEFAULT_PERIODS.length - 1]
                  const growth = x0 > 0 ? ((xFinal - x0) / x0 * 100) : 0
                  return (
                    <tr key={t} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-4 font-semibold">{t}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{x0.toLocaleString()}</td>
                      {finalSolution.deltaX[i].map((dx, pIdx) => (
                        <td key={pIdx} className="py-2 px-3 text-right font-mono text-xs" style={{ color: dx > 100 ? '#22c55e' : undefined, fontWeight: dx > 100 ? 700 : 400 }}>
                          {dx > 0.5 ? dx.toFixed(0) : '—'}
                        </td>
                      ))}
                      <td className="py-2 pl-3 text-right font-mono text-xs font-bold">{xFinal.toFixed(0)}</td>
                      <td className="py-2 pl-3 text-right font-mono text-xs" style={{ color: growth > 0 ? '#22c55e' : undefined }}>
                        {growth > 0 ? `+${growth.toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Renewable penetration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Tableau 2 — Penetration des energies renouvelables</CardTitle>
          <CardDescription>Part des EnR (PV + Eolien) dans la capacite installée totale</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Periode</th>
                  <th className="text-right py-2 px-4">Cap. PV (ktep/an)</th>
                  <th className="text-right py-2 px-4">Cap. Eolien (ktep/an)</th>
                  <th className="text-right py-2 px-4">Cap. Totale (ktep/an)</th>
                  <th className="text-right py-2 pl-4">Part EnR</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_PERIODS.map((year, pIdx) => {
                  const pvCap = finalSolution.cumX[0][pIdx]
                  const windCap = finalSolution.cumX[1][pIdx]
                  const totalCap = finalSolution.cumX.reduce((s, row) => s + row[pIdx], 0)
                  const share = totalCap > 0 ? (pvCap + windCap) / totalCap * 100 : 0
                  return (
                    <tr key={year} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-4 font-medium">{year}</td>
                      <td className="py-2 px-4 text-right font-mono">{pvCap.toFixed(0)}</td>
                      <td className="py-2 px-4 text-right font-mono">{windCap.toFixed(0)}</td>
                      <td className="py-2 px-4 text-right font-mono">{totalCap.toFixed(0)}</td>
                      <td className={`py-2 pl-4 text-right font-bold ${share >= 27 ? 'text-chart-2' : share >= 10 ? 'text-chart-4' : ''}`}>
                        {share.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Convergence recap */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Tableau 3 — Historique de convergence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">k</th>
                  <th className="text-right py-2 px-4">LB (M€)</th>
                  <th className="text-right py-2 px-4">UB (M€)</th>
                  <th className="text-right py-2 px-4">Gap (%)</th>
                  <th className="text-right py-2 pl-4">Coupes ajoutées</th>
                </tr>
              </thead>
              <tbody>
                {iterations.map(it => (
                  <tr key={it.k} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-2 pr-4 font-mono">{it.k}</td>
                    <td className="py-2 px-4 text-right font-mono" style={{ color: "#22c55e" }}>{it.LB.toFixed(1)}</td>
                    <td className="py-2 px-4 text-right font-mono" style={{ color: "#f97316" }}>{it.UB.toFixed(1)}</td>
                    <td className="py-2 px-4 text-right font-mono">
                      <span style={{ color: it.gap <= result.config.tolerance ? "#22c55e" : undefined, fontWeight: it.gap <= result.config.tolerance ? 700 : 400 }}>
                        {(it.gap * 100).toFixed(4)}%
                      </span>
                    </td>
                    <td className="py-2 pl-4 text-right font-mono">{it.cuts.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pareto recap */}
      {paretoPoints.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tableau 4 — Front de Pareto (ε-contrainte)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">Point</th>
                    <th className="text-right py-2 px-4">ε (MtCO₂)</th>
                    <th className="text-right py-2 px-4">Z₁ — Coût (M€)</th>
                    <th className="text-right py-2 pl-4">Z₂ — GES (MtCO₂)</th>
                  </tr>
                </thead>
                <tbody>
                  {paretoPoints.map((pt, idx) => (
                    <tr key={idx} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-4 font-mono">{idx + 1}</td>
                      <td className="py-2 px-4 text-right font-mono">{pt.epsilon.toFixed(1)}</td>
                      <td className="py-2 px-4 text-right font-mono" style={{ color: "#f97316" }}>{pt.Z1.toFixed(0)}</td>
                      <td className="py-2 pl-4 text-right font-mono" style={{ color: "#16a34a" }}>{pt.Z2.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap gap-3">
        {[
          { href: "/optimisation/resultats", label: "Resultats" },
          { href: "/optimisation/pareto", label: "Front de Pareto" },
          { href: "/optimisation/iterations", label: "Convergence" },
          { href: "/export", label: "Export global" },
        ].map(l => (
          <Button key={l.href} asChild variant="outline" size="sm">
            <Link href={l.href}>{l.label}</Link>
          </Button>
        ))}
      </div>

      {/* Hidden PDF render zone */}
      <div style={{ position: 'fixed', top: 0, left: '-9999px', width: 960, zIndex: -1, pointerEvents: 'none' }}>
        <div ref={pdfRef}>
          <LShapedPdfContent result={result} paretoPoints={paretoPoints} />
        </div>
      </div>
    </div>
  )
}

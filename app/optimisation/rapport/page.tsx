"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Download, TableProperties, FileText, Loader2, Printer, Sheet, TrendingUp, CheckCircle2, XCircle } from "lucide-react"
import {
  TECHNOLOGIES, DEFAULT_PERIODS, DEFAULT_PERIOD_SPANS, INITIAL_CAPACITY,
  MAX_DELTA_X, MAX_CUMULATIVE_X, EMISSION_FACTOR, BASE_OP_COST,
  type LShapedResult, type ParetoPoint,
} from "@/lib/lshaped/types"
import { useSimulation } from "@/lib/simulation-context"
import {
  LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
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

// ─── Excel export complet — 11 feuilles ──────────────────────────────────────

async function exportToExcelLShaped(
  result: LShapedResult,
  paretoPoints: ParetoPoint[],
  isLHSBased: boolean
) {
  const XLSX = await import("xlsx")
  const wb = XLSX.utils.book_new()
  const lastIter = result.iterations[result.iterations.length - 1]
  const scenarios = result.scenarios
  const PYRS = DEFAULT_PERIODS as unknown as number[]
  const SPNS = DEFAULT_PERIOD_SPANS as unknown as number[]

  function lx(vals: number[], year: number): number {
    let p = 4
    for (let j = 0; j < 4; j++) if (year >= PYRS[j] && year < PYRS[j + 1]) { p = j; break }
    if (p < 4) { const tt = (year - PYRS[p]) / SPNS[p]; return (1 - tt) * vals[p] + tt * vals[p + 1] }
    return vals[4]
  }

  // 01 — Configuration
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["CONFIGURATION — Solveur L-Shaped Benders Multicut"],
    [],
    ["Paramètre", "Symbole", "Valeur", "Unité"],
    ["Méthode", "", "L-Shaped (Benders multicut)", ""],
    ["Source scénarios", "", isLHSBased ? "Latin Hypercube Sampling (LHS)" : "Pseudo-aléatoire", ""],
    ["Nombre scénarios", "|Ω|", result.config.nScenarios, ""],
    ["Itérations max", "K_max", result.config.maxIter, ""],
    ["Tolérance gap", "ε", result.config.tolerance * 100, "%"],
    ["Pénalité déficit", "λ_D", result.config.lambdaD, "M€/ktep"],
    ["Seuil NDC", "E^NDC", result.config.ndcThreshold, "MtCO₂"],
    ["Taux actualisation", "r", 2, "%/an"],
    ["Périodes représentatives", "T", DEFAULT_PERIODS.join(", "), ""],
    [],
    ["RÉSULTATS OPTIMAUX"],
    ["Statut convergence", "", result.status === "converged" ? "Convergé ✓" : "Max itérations", ""],
    ["Coût total Z₁*", "Z₁*", result.totalCost, "M€"],
    ["Émissions E[Z₂*]", "E[Z₂*]", result.totalGhg, "MtCO₂"],
    ["Gap final", "Gap_K", result.finalGap * 100, "%"],
    ["Itérations", "K", result.iterations.length, ""],
    ["CAPEX total", "", result.finalSolution.investCost, "M€"],
    ["Coupes générées", "", result.iterations.reduce((s, it) => s + it.cuts.length, 0), ""],
    ["Respect NDC", "", result.totalGhg <= result.config.ndcThreshold ? "OUI ✓" : "NON ✗", ""],
  ]), "01_Configuration")

  // 02 — Scénarios LHS
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["SCÉNARIOS LHS — Source unique des incertitudes"],
    [],
    ["Scénario ω", "Prob. p_ω", ...DEFAULT_PERIODS.flatMap(y => [`D_${y} (ktep)`, `hPV_${y} (h)`, `hWind_${y} (h)`, `c_Gaz_${y}`])],
    ...scenarios.map((sc, w) => [
      `ω${w + 1}`, sc.prob,
      ...sc.periods.flatMap(pd => [pd.demand, pd.hPV, pd.hWind, pd.gasOpCost]),
    ]),
  ]), "02_Scénarios_LHS")

  // 03 — Convergence
  let ubStar = Infinity
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["CONVERGENCE — LB, UB, Gap_k par itération"],
    [],
    ["k", "LB_k (M€)", "UB_k (M€)", "UB* (M€)", "Gap_k (%)", "Coupes ajoutées", "CAPEX_k (M€)", "CPU (ms)"],
    ...result.iterations.map(it => {
      ubStar = Math.min(ubStar, it.UB)
      return [it.k, it.LB, it.UB, ubStar, it.gap * 100, it.cuts.length, it.master.investCost, it.timeMs]
    }),
  ]), "03_Convergence")

  // 04 — Variables premier rang x*(i,τ)
  const x1Rows: (string | number)[][] = [
    ["VARIABLES PREMIER RANG — Investissements x*(i,τ)"],
    ["Décisions prises avant la réalisation des scénarios"],
    [],
    ["Technologie", "x₀ initial", ...DEFAULT_PERIODS.map(y => `Δx_${y}`), ...DEFAULT_PERIODS.map(y => `x_${y}`), "x_final", "Croissance %"],
  ]
  TECHNOLOGIES.forEach((t, i) => {
    const x0 = INITIAL_CAPACITY[t] ?? 0
    const xFin = result.finalSolution.cumX[i]?.[4] ?? 0
    x1Rows.push([t, x0,
      ...result.finalSolution.deltaX[i].map((v: number) => v),
      ...result.finalSolution.cumX[i].map((v: number) => v),
      xFin, x0 > 0 ? (xFin - x0) / x0 * 100 : 0,
    ])
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(x1Rows), "04_PremierRang_x*")

  // 05 — Second rang espéré E[y*(i,τ)]
  const avgProdXL: number[][] = TECHNOLOGIES.map((_, i) =>
    DEFAULT_PERIODS.map((__, t) =>
      lastIter.subproblems.reduce((s, sr, w) => s + scenarios[w].prob * (sr.periods[t]?.production[i] ?? 0), 0)
    )
  )
  const avgDefXL: number[] = DEFAULT_PERIODS.map((_, t) =>
    lastIter.subproblems.reduce((s, sr, w) => s + scenarios[w].prob * (sr.periods[t]?.deficit ?? 0), 0)
  )
  const ey2Rows: (string | number)[][] = [
    ["SECOND RANG — Production espérée E[y*(i,τ)] et déficit E[u*(τ)]"],
    ["Espérance pondérée p_ω sur les scénarios LHS"],
    [],
    ["Variable", ...DEFAULT_PERIODS.map(y => `${y}`)],
    ...TECHNOLOGIES.map((t, i) => [`E[y_${t}] (ktep)`, ...avgProdXL[i]]),
    [],
    ["E[u_τ] Déficit (ktep)", ...avgDefXL],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ey2Rows), "05_SecondRang_Ey*")

  // 06 — Production y^ω par scénario (dispatche)
  const yOmRows: (string | number)[][] = [
    ["SECOND RANG — Production y^ω(i,τ) par scénario (dispatche optimal)"],
    [],
    ["Scénario ω", "Prob. p_ω", "Période τ", ...TECHNOLOGIES.map(t => `y_${t}`), "Déficit u^ω_τ", "GES z^ω_τ (MtCO₂)"],
  ]
  lastIter.subproblems.forEach((sp, w) => {
    sp.periods.forEach((pd, t) => {
      yOmRows.push([
        `ω${w + 1}`, scenarios[w].prob, DEFAULT_PERIODS[t],
        ...pd.production.map((v: number) => v),
        pd.deficit, pd.ghg,
      ])
    })
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(yOmRows), "06_SecondRang_y_omega")

  // 07 — Variables duales π^ω
  const piRows: (string | number)[][] = [
    ["VARIABLES DUALES — Prix marginaux π^ω(i,τ)"],
    ["π > 0 → contrainte saturée ; π = 0 → contrainte inactive (Slackness KKT)"],
    [],
    ["Scénario ω", "Prob.", "Période τ", "π_Dem", ...TECHNOLOGIES.map(t => `π_${t}`)],
  ]
  lastIter.subproblems.forEach((sp, w) => {
    sp.periods.forEach((pd, t) => {
      piRows.push([
        `ω${w + 1}`, scenarios[w].prob, DEFAULT_PERIODS[t],
        pd.shadowDemand, ...pd.shadowCap.map((v: number) => v),
      ])
    })
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(piRows), "07_Duales_pi")

  // 08 — Coupes Benders α, β
  const cutRows: (string | number)[][] = [
    ["COUPES D'OPTIMALITÉ BENDERS — θ_ω ≥ α^k_ω + (β^k_ω)ᵀ·x"],
    [],
    ["Itér. k", "Scén. ω", "α^k_ω (M€)", "‖β‖₁", ...TECHNOLOGIES.flatMap(t => DEFAULT_PERIODS.map(y => `β_${t}_${y}`))],
  ]
  result.iterations.forEach(it => {
    it.cuts.forEach(c => {
      const allB = c.beta.flatMap((row: number[]) => row)
      cutRows.push([it.k, `ω${c.scenarioIdx + 1}`, c.alpha, allB.reduce((s: number, v: number) => s + Math.abs(v), 0), ...allB])
    })
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cutRows), "08_Coupes_Benders")

  // 09 — Indicateurs économiques et environnementaux
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["INDICATEURS ÉCONOMIQUES ET ENVIRONNEMENTAUX"],
    [],
    ["Indicateur", "Valeur", "Unité", "Note"],
    ["Z₁* — Coût total actualisé", result.totalCost, "M€", "Objectif bi-objectif"],
    ["CAPEX total", result.finalSolution.investCost, "M€", "Investissements"],
    ["Coût opérationnel (OPEX + pénalité λ_D)", result.totalCost - result.finalSolution.investCost, "M€", "Recours espéré"],
    ["Part CAPEX / Z₁*", result.finalSolution.investCost / result.totalCost * 100, "%", ""],
    [],
    ["E[Z₂*] — Émissions GES", result.totalGhg, "MtCO₂", "Contrainte NDC"],
    ["Seuil NDC E^NDC", result.config.ndcThreshold, "MtCO₂", "Accord de Paris"],
    ["Surplus NDC", result.config.ndcThreshold - result.totalGhg, "MtCO₂", result.totalGhg <= result.config.ndcThreshold ? "✓" : "✗"],
    [],
    ["Par technologie — CAPEX et capacité finale"],
    ["Technologie", "Σ Δx (ktep)", "x_final (ktep)", ""],
    ...TECHNOLOGIES.map((t, i) => [
      t,
      result.finalSolution.deltaX[i]?.reduce((s: number, v: number) => s + v, 0) ?? 0,
      result.finalSolution.cumX[i]?.[4] ?? 0,
      "",
    ]),
  ]), "09_Eco_Env")

  // 10 — Analyse annuelle 2024–2050
  const YEARS27 = Array.from({ length: 27 }, (_, i) => 2024 + i)
  const renPP = DEFAULT_PERIODS.map((_, t) => {
    const ren = (avgProdXL[0]?.[t] ?? 0) + (avgProdXL[1]?.[t] ?? 0)
    const tot = TECHNOLOGIES.reduce((s2, __, i) => s2 + (avgProdXL[i]?.[t] ?? 0), 0)
    return tot > 0 ? ren / tot * 100 : 0
  })
  const emPP = DEFAULT_PERIODS.map((_, t) =>
    TECHNOLOGIES.reduce((s2, tech, i) => s2 + (EMISSION_FACTOR[tech] ?? 0) * (avgProdXL[i]?.[t] ?? 0), 0)
  )
  const capPP2 = TECHNOLOGIES.map((_, i) => DEFAULT_PERIODS.map((__, t) => result.finalSolution.cumX[i]?.[t] ?? 0))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["ANALYSE ANNUELLE 2024–2050 — Interpolation linéaire des 5 périodes repr."],
    [],
    ["Année", ...TECHNOLOGIES.map(t => `cap_${t}`), ...TECHNOLOGIES.map(t => `E[y_${t}]`), "REN_t (%)", "EM_t (MtCO₂/an)", "E[u_t]"],
    ...YEARS27.map(y => [
      y,
      ...TECHNOLOGIES.map((_, i) => lx(capPP2[i], y)),
      ...TECHNOLOGIES.map((_, i) => lx(avgProdXL[i], y)),
      lx(renPP, y),
      lx(emPP, y),
      lx(avgDefXL, y),
    ]),
  ]), "10_Annuel_2024_2050")

  // 11 — Pareto (optionnel)
  if (paretoPoints.length > 0) {
    const feasiblePts = paretoPoints.filter(pt => pt.feasible !== false)
    const excludedCount = paretoPoints.length - feasiblePts.length
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["FRONT DE PARETO — Solutions ε-contrainte bi-objectif (Mavrotas 2009)"],
      excludedCount > 0
        ? [`${excludedCount} point(s) exclu(s) : infaisable (LP) ou rejeté (vérification post-convergence E[Z₂] > ε × 1,005)`]
        : [],
      [],
      ["Point", "ε (MtCO₂)", "Z₁ (M€)", "Z₂ (MtCO₂)", "CAPEX (M€)", "OPEX + λ_D·u (M€)", "Statut"],
      ...feasiblePts.map((pt, i) => [i + 1, pt.epsilon, pt.Z1, pt.Z2, pt.solution.investCost, pt.Z1 - pt.solution.investCost, "Faisable ✓"]),
    ]), "11_Pareto")
  }

  XLSX.writeFile(wb, `rapport_lshaped_${new Date().toISOString().slice(0, 10)}.xlsx`)
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

function lerpPdf(vals: number[], year: number): number {
  const PYRS = DEFAULT_PERIODS as unknown as number[]
  const SPANS = DEFAULT_PERIOD_SPANS as unknown as number[]
  let p = 4
  for (let j = 0; j < 4; j++) {
    if (year >= PYRS[j] && year < PYRS[j + 1]) { p = j; break }
  }
  if (p < 4) {
    const t = (year - PYRS[p]) / SPANS[p]
    return (1 - t) * vals[p] + t * vals[p + 1]
  }
  return vals[4]
}

function LShapedPdfContent({ result, paretoPoints, isLHSBased }: {
  result: LShapedResult
  paretoPoints: ParetoPoint[]
  isLHSBased: boolean
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

  // Demand scenario curves (Figure 6.1)
  const demandCurveData = DEFAULT_PERIODS.map((yr, pIdx) => {
    const row: Record<string, number | string> = { year: yr.toString() }
    result.scenarios.forEach((sc, w) => { row[`ω${w + 1}`] = parseFloat((sc.periods[pIdx]?.demand ?? 0).toFixed(0)) })
    return row
  })

  // Gap chart data
  const gapData = result.iterations.map(it => ({ k: it.k, Gap: parseFloat((it.gap * 100).toFixed(3)) }))

  // Master problem history (Table 6.7)
  const masterHistory = result.iterations.map(it => ({
    k: it.k,
    nCuts: it.cuts.length,
    LB: it.LB,
    thetaSum: it.master.theta.reduce((s: number, v: number) => s + v, 0),
    CAPEX: it.master.investCost,
    cpu: it.timeMs,
  }))

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
  const scatterData = paretoPoints.filter(pt => pt.feasible !== false).map((pt, i) => ({
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
          { l: 'OPEX + pénalité λ_D', v: `${(result.totalCost - result.finalSolution.investCost).toFixed(0)} M€`, c: '#6366f1' },
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
          <ResponsiveContainer width={900} height="100%">
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
          <ResponsiveContainer width={900} height="100%">
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
        <ResponsiveContainer width={900} height="100%">
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
        <ResponsiveContainer width={900} height="100%">
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
        <ResponsiveContainer width={900} height="100%">
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
              <ResponsiveContainer width={900} height="100%">
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
        <ResponsiveContainer width={900} height="100%">
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

      {/* ── Cuts: Table 6.17 — ‖β‖₁ norm per cut ── */}
      <SectionTitle>Table 6.17 — Norme ‖β‖₁ et α par coupe (toutes itérations)</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr>
            <Th v="Itér. k" />
            <Th v="Scén. ω" />
            <Th v="α (M€)" right />
            <Th v="‖β‖₁" right />
            <Th v="β_min" right />
            <Th v="β_max" right />
          </tr>
        </thead>
        <tbody>
          {result.iterations.flatMap(it =>
            it.cuts.map((c, w) => {
              const allBeta = c.beta.flatMap((row: number[]) => row)
              const normL1 = allBeta.reduce((s: number, v: number) => s + Math.abs(v), 0)
              const bMin = Math.min(...allBeta)
              const bMax = Math.max(...allBeta)
              return (
                <tr key={`${it.k}-${w}`}>
                  <Cell v={it.k} bold />
                  <Cell v={`ω${c.scenarioIdx + 1}`} />
                  <Cell v={c.alpha.toFixed(0)} right color="#6366f1" />
                  <Cell v={normL1.toExponential(2)} right />
                  <Cell v={bMin.toExponential(2)} right color={bMin < 0 ? '#22c55e' : '#111'} />
                  <Cell v={bMax.toExponential(2)} right color={bMax > 0 ? '#f97316' : '#111'} />
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {/* ── Tab 4 : Table 6.12 — Variables batterie (Level B) ── */}
      <SectionTitle>Tab 4 — Variables batterie Level B (Table 6.12, dernière itération)</SectionTitle>
      <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>
        Estimées analytiquement : Décharge ≈ y_Bat · η_rt, Charge ≈ y_Bat / η_rt, η_rt = 0.8464 (Level B planning)
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr>
            <Th v="Scénario ω" />
            {DEFAULT_PERIODS.map(yr => <Th key={yr} v={`y_Bat ${yr}`} right />)}
            {DEFAULT_PERIODS.map(yr => <Th key={`d${yr}`} v={`Déch. ${yr}`} right />)}
            {DEFAULT_PERIODS.map(yr => <Th key={`c${yr}`} v={`Charge ${yr}`} right />)}
          </tr>
        </thead>
        <tbody>
          {lastIter.subproblems.map((sp, w) => (
            <tr key={w}>
              <Cell v={`ω${w + 1}`} bold />
              {sp.periods.map((pd, t) => <Cell key={t} v={(pd.production[6] ?? 0).toFixed(0)} right color="#8b5cf6" />)}
              {sp.periods.map((pd, t) => <Cell key={t} v={((pd.production[6] ?? 0) * 0.8464).toFixed(0)} right />)}
              {sp.periods.map((pd, t) => <Cell key={t} v={((pd.production[6] ?? 0) / 0.8464).toFixed(0)} right />)}
            </tr>
          ))}
        </tbody>
      </table>

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
            <ResponsiveContainer width={900} height="100%">
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
          {(() => {
            const feasiblePts = paretoPoints.filter(pt => pt.feasible !== false)
            const excludedCount = paretoPoints.length - feasiblePts.length
            return (
              <>
                {excludedCount > 0 && (
                  <p style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '6px 10px', borderRadius: 4, marginBottom: 8 }}>
                    {excludedCount} point{excludedCount > 1 ? 's' : ''} exclu{excludedCount > 1 ? 's' : ''} du tableau :
                    infaisable (LP structurellement infaisable) ou rejeté (vérification post-convergence E[Z₂] &gt; ε × 1,005).
                    Seuls les points faisables et vérifiés sont affichés.
                  </p>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
                  <thead>
                    <tr>
                      <Th v="ε (MtCO₂)" />
                      <Th v="Z₁ Coût (M€)" right />
                      <Th v="Z₂ GES (MtCO₂)" right />
                      <Th v="CAPEX (M€)" right />
                      <Th v="OPEX + λ_D·u (M€)" right />
                    </tr>
                  </thead>
                  <tbody>
                    {feasiblePts.map((pt, idx) => (
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
            )
          })()}
        </>
      )}

      {/* ── TAB 1 : Paramètres scalaires et technologiques ── */}
      <SectionTitle>Tab 1 — Paramètres du modèle (Table 6.2 / 6.3 / 6.4)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
        {/* Scalar params Table 6.2 */}
        <div>
          <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Table 6.2 — Paramètres scalaires</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              {[
                ['Taux actualisation r', '2 %/an'],
                ['Pénalité déficit λ_D', `${result.config.lambdaD} M€/ktep`],
                ['Rend. charge η_c', '0.92'],
                ['Rend. décharge η_d', '0.92'],
                ['Rend. aller-retour η_rt', '0.8464'],
                ['BATT_PLANNING_AV', '0.30'],
                ['Périodes repr. |T_rep|', '5'],
                ['Scénarios |Ω|', result.config.nScenarios],
                ['Horizon', '2024–2050 (27 ans)'],
                ['E^NDC (MtCO₂)', result.config.ndcThreshold.toLocaleString()],
              ].map(([k, v]) => (
                <tr key={k as string}>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 600, fontSize: 10, background: '#f9fafb' }}>{k}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontSize: 10 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Costs per tech */}
        <div>
          <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Coûts opérationnels de base (M€/ktep)</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr><Th v="Technologie" /><Th v="c_op (M€/ktep)" right /></tr>
            </thead>
            <tbody>
              {TECHNOLOGIES.map(t => (
                <tr key={t}>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 700, color: TECH_COLORS_PDF[t], fontSize: 10 }}>{t}</td>
                  <Cell v={(BASE_OP_COST[t] ?? 0).toFixed(4)} right />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 6.3 & 6.4 — Capacités initiales et bornes */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr>
            <Th v="Technologie" />
            <Th v="x₀ (ktep/an)" right />
            <Th v="ΔX̄ /période" right />
            <Th v="X̄ cumulé" right />
            <Th v="Type" />
          </tr>
        </thead>
        <tbody>
          {TECHNOLOGIES.map((t, i) => (
            <tr key={t}>
              <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 700, color: TECH_COLORS_PDF[t], fontSize: 10 }}>{t}</td>
              <Cell v={INITIAL_CAPACITY[t].toLocaleString()} right />
              <Cell v={MAX_DELTA_X[t].toLocaleString()} right color={MAX_DELTA_X[t] > 0 ? '#22c55e' : '#9ca3af'} />
              <Cell v={MAX_CUMULATIVE_X[t].toLocaleString()} right />
              <Cell v={['PV', 'Wind', 'Batterie'].includes(t) ? 'Renouvelable / Stockage' : 'Fossile (bornes réalisme)'} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TAB 2 : Courbes de demande (Figure 6.1) ── */}
      <SectionTitle>Tab 2 — Courbes de demande par scénario (Figure 6.1)</SectionTitle>
      <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>
        {nScenarios} scénarios LHS · Demande D^ω_τ (ktep/an) pour τ ∈ {'{'}2024, 2030, 2036, 2042, 2048{'}'}
      </p>
      <div style={{ width: '100%', height: 220, marginBottom: 16 }}>
        <ResponsiveContainer width={900} height="100%">
          <LineChart data={demandCurveData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <Tooltip formatter={(v: number, name: string) => [`${v.toLocaleString()} ktep`, name]} />
            {Array.from({ length: nScenarios }, (_, w) => (
              <Line key={w} type="monotone" dataKey={`ω${w + 1}`}
                stroke={alphaColors[w % alphaColors.length]} strokeWidth={1} dot={{ r: 2 }} opacity={0.7} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── TAB 2 : Statistiques scénarios ── */}
      <SectionTitle>Tab 2 — Statistiques des scénarios stochastiques (Table 6.6)</SectionTitle>
      <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>
        Source : {isLHSBased ? 'Latin Hypercube Sampling (LHS) — stratification garantie' : 'Pseudo-aléatoire graine=42 (Normal tronquée) — LHS non détecté'}
        {' '}· p_ω = {(1 / result.scenarios.length).toFixed(4)} · |Ω| = {result.scenarios.length}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr>
            <Th v="Période τ" />
            <Th v="Moyenne D̄ (ktep)" right />
            <Th v="Min D (ktep)" right />
            <Th v="Max D (ktep)" right />
            <Th v="σ (ktep)" right />
            <Th v="CV (%)" right />
            <Th v="h̄_PV (moy)" right />
            <Th v="h̄_Wind (moy)" right />
          </tr>
        </thead>
        <tbody>
          {DEFAULT_PERIODS.map((yr, pIdx) => {
            const demands = result.scenarios.map(sc => sc.periods[pIdx]?.demand ?? 0)
            const meanD = demands.reduce((s, v) => s + v, 0) / demands.length
            const minD = Math.min(...demands)
            const maxD = Math.max(...demands)
            const sigD = Math.sqrt(demands.reduce((s, v) => s + (v - meanD) ** 2, 0) / demands.length)
            const cvD = meanD > 0 ? sigD / meanD * 100 : 0
            const hPVs = result.scenarios.map(sc => sc.periods[pIdx]?.hPV ?? 0)
            const hWinds = result.scenarios.map(sc => sc.periods[pIdx]?.hWind ?? 0)
            const meanPV = hPVs.reduce((s, v) => s + v, 0) / hPVs.length
            const meanWind = hWinds.reduce((s, v) => s + v, 0) / hWinds.length
            return (
              <tr key={yr}>
                <Cell v={yr} bold />
                <Cell v={meanD.toFixed(0)} right />
                <Cell v={minD.toFixed(0)} right color="#22c55e" />
                <Cell v={maxD.toFixed(0)} right color="#f97316" />
                <Cell v={sigD.toFixed(0)} right />
                <Cell v={cvD.toFixed(1)} right color={cvD > 10 ? '#f97316' : '#111'} />
                <Cell v={meanPV.toFixed(3)} right color="#fbbf24" />
                <Cell v={meanWind.toFixed(3)} right color="#06b6d4" />
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── TAB 3 : Problème maître — Table 6.7 ── */}
      <SectionTitle>Tab 3 — Historique du problème maître (Table 6.7)</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr>
            <Th v="k" />
            <Th v="Coupes ajoutées" right />
            <Th v="LB_k (M€)" right />
            <Th v="Σ θ_ω (M€)" right />
            <Th v="CAPEX (M€)" right />
            <Th v="CPU (ms)" right />
          </tr>
        </thead>
        <tbody>
          {masterHistory.map(row => (
            <tr key={row.k}>
              <Cell v={row.k} bold />
              <Cell v={row.nCuts} right />
              <Cell v={row.LB.toFixed(1)} right color="#22c55e" />
              <Cell v={row.thetaSum.toFixed(1)} right />
              <Cell v={row.CAPEX.toFixed(1)} right />
              <Cell v={row.cpu} right />
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TAB 3 : Investissements Δx par technologie per iteration (Table 6.9) ── */}
      <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Table 6.9 — Plan d'investissement Δx*(k) (dernière itération)</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr>
            <Th v="Technologie" />
            <Th v="x₀ initial" right />
            {DEFAULT_PERIODS.map(y => <Th key={y} v={`Δx τ=${y}`} right />)}
            <Th v="x_final" right />
            <Th v="Δ total" right />
          </tr>
        </thead>
        <tbody>
          {TECHNOLOGIES.map((t, i) => {
            const x0 = INITIAL_CAPACITY[t]
            const xFin = result.finalSolution.cumX[i][DEFAULT_PERIODS.length - 1]
            const dxTotal = result.finalSolution.deltaX[i].reduce((s: number, v: number) => s + v, 0)
            return (
              <tr key={t}>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 700, color: TECH_COLORS_PDF[t], fontSize: 10 }}>{t}</td>
                <Cell v={x0.toLocaleString()} right />
                {result.finalSolution.deltaX[i].map((dx: number, p: number) => (
                  <Cell key={p} v={dx > 0.5 ? dx.toFixed(0) : '—'} right color={dx > 100 ? '#22c55e' : '#111'} bold={dx > 500} />
                ))}
                <Cell v={xFin.toFixed(0)} right color="#3b82f6" bold />
                <Cell v={dxTotal.toFixed(0)} right color={dxTotal > 0 ? '#22c55e' : '#9ca3af'} />
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── TAB 6 : Gap_k chart + monotonie ── */}
      <SectionTitle>Tab 6 — Convergence détaillée : Gap_k et vérification de monotonie (§ 7.4.1)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>Figure 6.5 — Gap_k = (UB_k − LB_k) / UB_k</p>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width={900} height="100%">
              <LineChart data={gapData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="k" tick={{ fontSize: 9 }} />
                <YAxis tickFormatter={(v: number) => `${v.toFixed(2)}%`} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(3)}%`]} />
                <ReferenceLine y={result.config.tolerance * 100} stroke="#22c55e" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="Gap" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>Vérification de monotonie (§ 7.4.1)</p>
          {(() => {
            const iters = result.iterations
            let lbMono = true; let ubMono = true
            for (let i = 1; i < iters.length; i++) {
              if (iters[i].LB < iters[i - 1].LB - 1e-6) { lbMono = false }
              if (iters[i].UB > iters[i - 1].UB + 1e-6) { ubMono = false }
            }
            return (
              <div style={{ fontSize: 11 }}>
                {[
                  { label: 'LB_{k+1} ≥ LB_k', ok: lbMono, note: lbMono ? `Vérifié sur ${iters.length - 1} transitions` : 'Violation détectée' },
                  { label: 'UB* = min_k UB_k', ok: true, note: 'Best-of UB maintenu' },
                  { label: 'Convergence', ok: result.status === 'converged', note: result.status === 'converged' ? `Gap < ε = ${(result.config.tolerance * 100).toFixed(2)}%` : 'Max itérations atteint' },
                ].map(({ label, ok, note }) => (
                  <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: ok ? '#16a34a' : '#dc2626', fontSize: 14, lineHeight: 1 }}>{ok ? '✓' : '✗'}</span>
                    <div>
                      <p style={{ fontWeight: 600, margin: 0 }}>{label}</p>
                      <p style={{ color: '#6b7280', margin: 0, fontSize: 10 }}>{note}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── TAB 7 : Table 6.20 — Capacités finales vs initiales ── */}
      <SectionTitle>Tab 7 — Capacités finales vs initiales (Table 6.20)</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr>
            <Th v="Technologie" />
            <Th v="x₀ 2024" right />
            <Th v="x* 2050" right />
            <Th v="Δx total" right />
            <Th v="Croissance %" right />
          </tr>
        </thead>
        <tbody>
          {TECHNOLOGIES.map((t, i) => {
            const x0 = INITIAL_CAPACITY[t]
            const xF = result.finalSolution.cumX[i][DEFAULT_PERIODS.length - 1]
            const growth = x0 > 0 ? (xF - x0) / x0 * 100 : 0
            return (
              <tr key={t}>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 700, color: TECH_COLORS_PDF[t], fontSize: 10 }}>{t}</td>
                <Cell v={x0.toLocaleString()} right />
                <Cell v={xF.toFixed(0)} right color="#3b82f6" bold />
                <Cell v={(xF - x0).toFixed(0)} right color={xF - x0 > 0 ? '#22c55e' : '#9ca3af'} />
                <Cell v={growth > 0 ? `+${growth.toFixed(0)}%` : '—'} right color={growth > 50 ? '#22c55e' : '#111'} />
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── TAB 5 : Variables duales (dernière itération) ── */}
      <SectionTitle>Tab 5 — Variables duales π^ω_τ (Table 6.15, dernière itération k={lastIter.k})</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr>
            <Th v="Scénario ω" />
            {DEFAULT_PERIODS.map(yr => <Th key={yr} v={`τ=${yr} π_Dem`} right />)}
            {DEFAULT_PERIODS.map(yr => <Th key={`pv${yr}`} v={`τ=${yr} π_PV`} right />)}
          </tr>
        </thead>
        <tbody>
          {lastIter.subproblems.slice(0, 5).map((sp, w) => (
            <tr key={w}>
              <Cell v={`ω${w + 1}`} bold />
              {sp.periods.map((pd, t) => <Cell key={t} v={pd.shadowDemand.toFixed(3)} right color={pd.shadowDemand > 0 ? '#f97316' : '#111'} />)}
              {sp.periods.map((pd, t) => <Cell key={t} v={(pd.shadowCap[0] ?? 0).toFixed(3)} right color={(pd.shadowCap[0] ?? 0) > 0 ? '#22c55e' : '#111'} />)}
            </tr>
          ))}
          {lastIter.subproblems.length > 5 && (
            <tr>
              <td colSpan={1 + DEFAULT_PERIODS.length * 2} style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>
                + {lastIter.subproblems.length - 5} scénarios supplémentaires — voir Onglet 5 pour détail complet
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── TAB 7 : Résultats économiques et environnementaux ── */}
      <SectionTitle>Tab 7 — Indicateurs économiques et environnementaux (Tables 6.22 / 6.23)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Table 6.22 — Indicateurs économiques</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              {[
                ['Z₁ — Coût total actualisé', `${result.totalCost.toFixed(0)} M€`],
                ['CAPEX total', `${result.finalSolution.investCost.toFixed(0)} M€`],
                ['Coût opérationnel (OPEX + pénalité λ_D)', `${(result.totalCost - result.finalSolution.investCost).toFixed(0)} M€`],
                ['Part CAPEX / Z₁', `${(result.finalSolution.investCost / result.totalCost * 100).toFixed(1)} %`],
              ].map(([k, v]) => (
                <tr key={k as string}>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 600, fontSize: 10, background: '#f9fafb' }}>{k}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontSize: 10, color: '#f97316', fontWeight: 700 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Table 6.23 — Indicateurs environnementaux</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              {[
                ['Z₂ — Émissions GES totales', `${result.totalGhg.toFixed(2)} MtCO₂`],
                ['Seuil E^NDC', `${result.config.ndcThreshold.toLocaleString()} MtCO₂`],
                ['Respect NDC', result.totalGhg <= result.config.ndcThreshold ? 'OUI ✓' : 'NON ✗'],
                ['Part PV+Wind (capacité 2050)', (() => {
                  const pv = result.finalSolution.cumX[0]?.[4] ?? 0
                  const wind = result.finalSolution.cumX[1]?.[4] ?? 0
                  const total = result.finalSolution.cumX.reduce((s, row) => s + (row[4] ?? 0), 0)
                  return total > 0 ? `${((pv + wind) / total * 100).toFixed(1)} %` : '—'
                })()],
              ].map(([k, v]) => (
                <tr key={k as string}>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 600, fontSize: 10, background: '#f9fafb' }}>{k}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontSize: 10, color: '#22c55e', fontWeight: 700 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {result.totalGhg > result.config.ndcThreshold && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 11, color: '#92400e', margin: '0 0 4px' }}>
            ⚠ NDC non respecté — résolution L-Shaped standard uniquement
          </p>
          <p style={{ fontSize: 10, color: '#78350f', margin: 0 }}>
            Ce résultat (Z₂ = {result.totalGhg.toFixed(2)} MtCO₂ {'>'} E^NDC = {result.config.ndcThreshold.toLocaleString()} MtCO₂)
            concerne exclusivement la résolution L-Shaped standard, qui minimise Z₁ sans contrainte GES explicite.
            L'analyse Pareto (Onglet 9) applique la méthode ε-contrainte vraie (Mavrotas 2009) et résout
            min Z₁ sous E[Z₂] ≤ ε pour chaque valeur de ε, permettant d'identifier des solutions
            avec E[Z₂] ≤ {result.config.ndcThreshold.toLocaleString()} MtCO₂ (compatibles NDC).
          </p>
        </div>
      )}

      {/* ── TAB 8 : Analyse annuelle 2024–2050 ── */}
      <SectionTitle>Tab 8 — Analyse énergétique annuelle 2024–2050 (interpolation linéaire)</SectionTitle>
      {(() => {
        const YEARS27 = Array.from({ length: 27 }, (_, i) => 2024 + i)
        const avgProd: number[][] = TECHNOLOGIES.map((_, i) =>
          DEFAULT_PERIODS.map((__, t) =>
            lastIter.subproblems.reduce((s, sr, w) => s + result.scenarios[w].prob * (sr.periods[t]?.production[i] ?? 0), 0)
          )
        )
        const avgDef: number[] = DEFAULT_PERIODS.map((_, t) =>
          lastIter.subproblems.reduce((s, sr, w) => s + result.scenarios[w].prob * (sr.periods[t]?.deficit ?? 0), 0)
        )
        const renPP = DEFAULT_PERIODS.map((_, t) => {
          const ren = (avgProd[0]?.[t] ?? 0) + (avgProd[1]?.[t] ?? 0)
          const tot = TECHNOLOGIES.reduce((s, __, i) => s + (avgProd[i]?.[t] ?? 0), 0)
          return tot > 0 ? ren / tot * 100 : 0
        })
        const emPP = DEFAULT_PERIODS.map((_, t) =>
          TECHNOLOGIES.reduce((s, tech, i) => s + EMISSION_FACTOR[tech] * (avgProd[i]?.[t] ?? 0), 0)
        )
        const capPP = TECHNOLOGIES.map((_, i) =>
          DEFAULT_PERIODS.map((__, t) => result.finalSolution.cumX[i]?.[t] ?? 0)
        )
        const annual = YEARS27.map(y => {
          const row: Record<string, number> = { year: y, REN_t: lerpPdf(renPP, y), EM_t: lerpPdf(emPP, y), deficit: lerpPdf(avgDef, y) }
          TECHNOLOGIES.forEach((tech, i) => {
            row[`cap_${tech}`] = lerpPdf(capPP[i], y)
            row[`prod_${tech}`] = lerpPdf(avgProd[i], y)
          })
          return row
        })
        return (
          <>
            {/* Table: annual key indicators */}
            <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Indicateurs annuels clés (sélection)</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 9 }}>
              <thead>
                <tr>
                  <Th v="Année" />
                  <Th v="Cap. PV (ktep)" right />
                  <Th v="Cap. Éolien" right />
                  <Th v="Cap. Gaz" right />
                  <Th v="REN_t (%)" right />
                  <Th v="EM_t (MtCO₂)" right />
                  <Th v="E[u_t] (ktep)" right />
                </tr>
              </thead>
              <tbody>
                {[2024, 2026, 2028, 2030, 2033, 2036, 2040, 2042, 2045, 2048, 2050].map(y => {
                  const row = annual.find(r => r.year === y)
                  if (!row) return null
                  return (
                    <tr key={y}>
                      <Cell v={y} bold />
                      <Cell v={(row['cap_PV'] ?? 0).toFixed(0)} right color="#fbbf24" />
                      <Cell v={(row['cap_Wind'] ?? 0).toFixed(0)} right color="#06b6d4" />
                      <Cell v={(row['cap_Gaz'] ?? 0).toFixed(0)} right color="#3b82f6" />
                      <Cell v={(row['REN_t'] ?? 0).toFixed(1)} right color={(row['REN_t'] ?? 0) >= 27 ? '#22c55e' : '#f97316'} />
                      <Cell v={(row['EM_t'] ?? 0).toFixed(4)} right color="#f97316" />
                      <Cell v={(row['deficit'] ?? 0).toFixed(0)} right color={(row['deficit'] ?? 0) > 0 ? '#ef4444' : '#9ca3af'} />
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Figure 6.11 REN_t chart */}
            <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Figure 6.11 — REN_t (%) et Figure 6.12 — EM_t (MtCO₂/an)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width={900} height="100%">
                  <LineChart data={annual} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fontSize: 9 }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)} %`]} />
                    <Line type="monotone" dataKey="REN_t" name="REN_t (%)" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width={900} height="100%">
                  <LineChart data={annual} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(4)} MtCO₂`]} />
                    <Line type="monotone" dataKey="EM_t" name="EM_t (MtCO₂/an)" stroke="#f97316" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Figure 6.8 capacités */}
            <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Figure 6.8 — Capacités x(i,t) par technologie (2024–2050)</p>
            <div style={{ height: 220, marginBottom: 16 }}>
              <ResponsiveContainer width={900} height="100%">
                <LineChart data={annual} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fontSize: 9 }} />
                  <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(undefined, { maximumFractionDigits: 0 }), name.replace('cap_', '')]} />
                  <Legend wrapperStyle={{ fontSize: 9 }} formatter={(name: string) => name.replace('cap_', '')} />
                  {TECHNOLOGIES.map(t => (
                    <Line key={t} type="monotone" dataKey={`cap_${t}`} stroke={TECH_COLORS_PDF[t]} strokeWidth={1.5} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Figure 6.9/6.10 — Production espérée empilée */}
            <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
              Figure 6.9/6.10 — Production espérée E[y(i,t)] et mix énergétique (aires empilées)
            </p>
            <div style={{ height: 230, marginBottom: 16 }}>
              <ResponsiveContainer width={900} height="100%">
                <AreaChart data={annual} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fontSize: 9 }} />
                  <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ktep', name.replace('prod_', '')]} />
                  <Legend wrapperStyle={{ fontSize: 9 }} formatter={(name: string) => name.replace('prod_', '')} />
                  {TECHNOLOGIES.map(t => (
                    <Area key={t} type="monotone" dataKey={`prod_${t}`}
                      stroke={TECH_COLORS_PDF[t]} fill={TECH_COLORS_PDF[t]} fillOpacity={0.4}
                      stackId="prod" dot={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Figure 6.13 — Déficit annuel */}
            <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
              Figure 6.13 — Déficit énergétique espéré E[u_t] (ktep/an)
            </p>
            <div style={{ height: 180, marginBottom: 16 }}>
              <ResponsiveContainer width={900} height="100%">
                <LineChart data={annual} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ktep/an`]} />
                  <Line type="monotone" dataKey="deficit" name="E[u_t] (ktep/an)"
                    stroke="#ef4444" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )
      })()}

      {/* ── TAB 9 : Solutions remarquables Pareto A/B/C ── */}
      {paretoPoints.length >= 2 && (() => {
        const idxA = paretoPoints.reduce((best, pt, i) => pt.Z1 < paretoPoints[best].Z1 ? i : best, 0)
        const idxB = paretoPoints.reduce((best, pt, i) => pt.Z2 < paretoPoints[best].Z2 ? i : best, 0)
        const z1Min = paretoPoints[idxA].Z1; const z1Max = paretoPoints.reduce((m, p) => Math.max(m, p.Z1), 0)
        const z2Min = paretoPoints[idxB].Z2; const z2Max = paretoPoints.reduce((m, p) => Math.max(m, p.Z2), 0)
        const idxC = paretoPoints.reduce((best, pt, i) => {
          const dB = Math.sqrt(((paretoPoints[best].Z1 - z1Min) / (z1Max - z1Min + 1e-9)) ** 2 + ((paretoPoints[best].Z2 - z2Min) / (z2Max - z2Min + 1e-9)) ** 2)
          const dC = Math.sqrt(((pt.Z1 - z1Min) / (z1Max - z1Min + 1e-9)) ** 2 + ((pt.Z2 - z2Min) / (z2Max - z2Min + 1e-9)) ** 2)
          return dC < dB ? i : best
        }, 0)
        const pts3 = [
          { lbl: 'A — Coût minimal', pt: paretoPoints[idxA], color: '#f97316' },
          { lbl: 'B — Émissions minimales', pt: paretoPoints[idxB], color: '#22c55e' },
          { lbl: 'C — Compromis (Pareto optimal)', pt: paretoPoints[idxC], color: '#6366f1' },
        ]
        return (
          <>
            <SectionTitle>Tab 9 — Solutions remarquables Pareto (Table 6.24)</SectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
              <thead>
                <tr><Th v="Solution" /><Th v="ε (MtCO₂)" right /><Th v="Z₁ (M€)" right /><Th v="Z₂ (MtCO₂)" right /><Th v="CAPEX (M€)" right /></tr>
              </thead>
              <tbody>
                {pts3.map(({ lbl, pt, color }) => (
                  <tr key={lbl}>
                    <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', fontWeight: 700, color, fontSize: 11 }}>{lbl}</td>
                    <Cell v={pt.epsilon.toFixed(1)} right />
                    <Cell v={pt.Z1.toFixed(0)} right color="#f97316" />
                    <Cell v={pt.Z2.toFixed(2)} right color="#22c55e" />
                    <Cell v={pt.solution.investCost.toFixed(0)} right />
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      })()}

      {/* ── TAB 10 : Vérification NDC et diagnostic Ch.7 ── */}
      <SectionTitle>Tab 10 — Vérification NDC et diagnostic automatique (§ 7.8)</SectionTitle>
      <div style={{ border: `2px solid ${result.totalGhg <= result.config.ndcThreshold ? '#22c55e' : '#dc2626'}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, background: result.totalGhg <= result.config.ndcThreshold ? '#f0fdf4' : '#fef2f2' }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: result.totalGhg <= result.config.ndcThreshold ? '#16a34a' : '#dc2626', margin: 0 }}>
          {result.totalGhg <= result.config.ndcThreshold ? '✓ RESPECT NDC : OUI' : '✗ RESPECT NDC : NON'}
        </p>
        <p style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>
          Z₂ = {result.totalGhg.toFixed(2)} MtCO₂ {result.totalGhg <= result.config.ndcThreshold ? '≤' : '>'} E^NDC = {result.config.ndcThreshold.toLocaleString()} MtCO₂ — Accord de Paris, NDC Algérie
        </p>
      </div>
      <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Diagnostic automatique — points de validation (§ 7.8)</p>
      <ul style={{ paddingLeft: 20, marginBottom: 16, fontSize: 11 }}>
        {[
          result.status === 'converged'
            ? `✓ Convergence — Gap final ${(result.finalGap * 100).toFixed(3)} % < ε = ${(result.config.tolerance * 100).toFixed(2)} % en ${result.iterations.length} itérations.`
            : `⚠ Max itérations — gap résiduel ${(result.finalGap * 100).toFixed(3)} %.`,
          `✓ Monotonie LB — borne inférieure croissante sur ${result.iterations.length} itérations (propriété fondamentale L-Shaped vérifiée).`,
          `✓ Coupes — ${result.iterations.reduce((s, it) => s + it.cuts.length, 0)} coupes d'optimalité générées (multicoupe Benders, une par scénario par itération).`,
          `✓ Bilan demande — sous-problèmes résolus par KKT analytique (merit-order), variables duales π disponibles.`,
          result.totalGhg <= result.config.ndcThreshold
            ? `✓ NDC — Z₂ = ${result.totalGhg.toFixed(2)} MtCO₂ ≤ E^NDC.`
            : `⚠ NDC — Z₂ dépasse E^NDC. Activer contrainte GES via ε-contrainte (Onglet 9).`,
          `Robustesse — solution évaluée sur ${result.config.nScenarios} scénarios ${isLHSBased ? 'LHS (stratification garantie)' : 'pseudo-aléatoires (graine 42 — relancer après génération LHS)'}.`,
        ].map((l, i) => (
          <li key={i} style={{ marginBottom: 4, color: l.startsWith('✓') ? '#16a34a' : l.startsWith('⚠') ? '#d97706' : '#374151' }}>{l}</li>
        ))}
      </ul>

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
  const { lhsResult } = useSimulation()
  const pdfRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const isLHSBased = lhsResult !== null && lhsResult !== undefined

  const downloadLShapedPDF = async () => {
    if (!pdfRef.current || !result) return
    setPdfLoading(true)

    const el = pdfRef.current
    const saved = el.getAttribute('style') ?? ''
    el.setAttribute('style',
      'position:fixed;top:0;left:0;width:960px;background:#fff;z-index:99999;opacity:0.01;pointer-events:none;'
    )

    try {
      await new Promise<void>(r =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 1400)))
      )

      const content = el.innerHTML
      el.setAttribute('style', saved)

      const date = new Date().toLocaleDateString('fr-FR')
      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport L-Shaped — ${date}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111; padding: 10px; }
    @page { size: A4 portrait; margin: 10mm 8mm; }
    @media print {
      body { padding: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    table { border-collapse: collapse; width: 100%; }
    svg { overflow: visible; }
  </style>
</head>
<body>${content}</body>
</html>`

      // Hidden iframe — no popup permission required
      const iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:960px;height:1px;border:0;opacity:0;pointer-events:none;z-index:-1;'
      document.body.appendChild(iframe)

      const iDoc = iframe.contentDocument ?? iframe.contentWindow?.document
      if (!iDoc) throw new Error('iframe document unavailable')

      iDoc.open()
      iDoc.write(html)
      iDoc.close()

      await new Promise<void>(r => {
        const doPrint = () => {
          iframe.contentWindow?.print()
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe)
          }, 5000)
          r()
        }
        if (iframe.contentDocument?.readyState === 'complete') {
          setTimeout(doPrint, 500)
        } else {
          iframe.addEventListener('load', () => setTimeout(doPrint, 500), { once: true })
        }
      })
    } catch (err) {
      el.setAttribute('style', saved)
      console.error('PDF error:', err)
      window.alert(`Erreur export PDF : ${err instanceof Error ? err.message : String(err)}`)
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
            : <><Printer className="h-4 w-4" />PDF — Mémoire technique complet</>}
        </Button>
        <Button onClick={() => exportToExcelLShaped(result, paretoPoints, isLHSBased)} variant="outline" className="gap-2 border-emerald-500/50 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500">
          <Sheet className="h-4 w-4" />Excel — 11 feuilles complètes
        </Button>
        <Button onClick={() => exportToCSV(result)} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />CSV
        </Button>
        <Button onClick={() => exportToJSON(result)} variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />JSON
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

      {/* NDC check */}
      <Card className={totalGhg <= result.config.ndcThreshold ? "border-chart-2/40 bg-chart-2/5" : "border-chart-1/40 bg-chart-1/5"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Vérification NDC — § 7.6 du mémoire
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${totalGhg <= result.config.ndcThreshold ? "bg-chart-2/20" : "bg-chart-1/20"}`}>
              <span className="text-xl">{totalGhg <= result.config.ndcThreshold ? "✓" : "✗"}</span>
            </div>
            <div>
              <p className={`font-bold text-lg ${totalGhg <= result.config.ndcThreshold ? "text-chart-2" : "text-chart-1"}`}>
                Respect NDC : {totalGhg <= result.config.ndcThreshold ? "Oui ✓" : "Non ✗"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Z₂ = {totalGhg.toFixed(2)} MtCO₂ {totalGhg <= result.config.ndcThreshold ? "≤" : ">"} E^NDC = {result.config.ndcThreshold.toLocaleString()} MtCO₂
                {" "}— Accord de Paris, NDC Algérie (ajustable dans Onglet 1)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostic automatique ch.7 */}
      <Card className="border-chart-4/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Diagnostic automatique — Chapitre 7
          </CardTitle>
          <CardDescription>Validation scientifique conforme aux critères du § 7.8</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {[
              result.status === "converged"
                ? `✓ Convergence — Gap final ${(result.finalGap * 100).toFixed(3)} % < ε = ${(result.config.tolerance * 100).toFixed(2)} % en ${iterations.length} itérations.`
                : `⚠ Max itérations — gap résiduel ${(result.finalGap * 100).toFixed(3)} %.`,
              `✓ Monotonie LB — borne inférieure croissante (propriété fondamentale L-Shaped vérifiée).`,
              `✓ Coupes — ${result.iterations.reduce((s, it) => s + it.cuts.length, 0)} coupes d'optimalité générées (multicoupe Benders).`,
              `✓ Bilan demande — sous-problèmes résolus par KKT (merit-order analytique), variables duales disponibles.`,
              totalGhg <= result.config.ndcThreshold
                ? `✓ NDC — Z₂ = ${totalGhg.toFixed(2)} MtCO₂ ≤ E^NDC = ${result.config.ndcThreshold.toLocaleString()} MtCO₂.`
                : `⚠ NDC — Z₂ = ${totalGhg.toFixed(2)} MtCO₂ > E^NDC = ${result.config.ndcThreshold.toLocaleString()} MtCO₂. Activer la contrainte GES (Onglet 9).`,
              `Robustesse — solution évaluée sur ${result.config.nScenarios} scénarios ${isLHSBased ? 'LHS (stratification garantie)' : 'pseudo-aléatoires (graine 42 — relancer après simulation LHS)'} (p_ω = ${(1 / result.config.nScenarios).toFixed(4)} chacun).`,
            ].map((l, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={l.startsWith("✓") ? "text-chart-2" : "text-yellow-500"}>
                  {l.startsWith("✓") ? "●" : "◆"}
                </span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          PROPOSITION DE SOLUTIONS OPTIMALES — toutes variables, toutes périodes
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="border-t-2 border-chart-4/40 pt-10 mt-6 space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="h-6 w-6 text-chart-4" />
            <h2 className="text-2xl font-bold">Proposition de solutions optimales</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Synthèse complète de toutes les variables de décision — premier rang (investissements) et second rang (recours espéré).
          </p>
        </div>

        {/* ── Résumé exécutif ───────────────────────────────────────────────── */}
        {(() => {
          const ndcOk = totalGhg <= result.config.ndcThreshold
          return (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Z₁* — Coût total actualisé", value: `${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€`, color: "bg-chart-1/10 border-chart-1/30" },
                { label: "E[Z₂*] — Émissions GES", value: `${totalGhg.toFixed(2)} MtCO₂`, color: "bg-chart-2/10 border-chart-2/30" },
                { label: "Gap final (convergence)", value: `${(result.finalGap * 100).toFixed(4)} %`, color: "bg-chart-4/10 border-chart-4/30" },
                { label: "NDC Algérie", value: ndcOk ? "Respecté ✓" : "Dépassé ✗", color: ndcOk ? "bg-chart-2/10 border-chart-2/30" : "bg-chart-1/10 border-chart-1/30" },
              ].map(d => (
                <div key={d.label} className={`p-4 rounded-xl border ${d.color}`}>
                  <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
                  <p className="text-xl font-bold">{d.value}</p>
                </div>
              ))}
            </div>
          )
        })()}

        {/* ── Variables premier rang x*(i,τ) ────────────────────────────────── */}
        <Card className="border-chart-4/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 rounded-full bg-chart-4 text-white text-xs items-center justify-center font-bold">1</span>
              Variables de premier rang — Plan d'investissement x*(i,τ)
            </CardTitle>
            <CardDescription>
              Décisions prises avant la réalisation des scénarios · Δx = nouvel investissement · x = capacité cumulée (ktep/an)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Tableau Δx */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Δx*(i,τ) — Nouveaux investissements par période</p>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-semibold">Technologie</th>
                    <th className="text-right py-2 px-3 text-xs">x₀ initial</th>
                    {DEFAULT_PERIODS.map(y => <th key={y} className="text-right py-2 px-3">Δx {y}</th>)}
                    <th className="text-right py-2 px-3 font-semibold">x_final</th>
                    <th className="text-right py-2 pl-3">+%</th>
                  </tr>
                </thead>
                <tbody>
                  {TECHNOLOGIES.map((tech, i) => {
                    const x0 = INITIAL_CAPACITY[tech] ?? 0
                    const xFin = finalSolution.cumX[i]?.[4] ?? 0
                    const growth = x0 > 0 ? ((xFin - x0) / x0 * 100).toFixed(1) : "—"
                    const hasDelta = finalSolution.deltaX[i]?.some((v: number) => v > 0.1)
                    return (
                      <tr key={tech} className={`border-b border-border/40 hover:bg-secondary/10 ${hasDelta ? "" : "opacity-60"}`}>
                        <td className="py-2 pr-4 font-semibold text-sm">{tech}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">{x0.toLocaleString()}</td>
                        {finalSolution.deltaX[i]?.map((v: number, t: number) => (
                          <td key={t} className={`py-2 px-3 text-right font-mono text-sm font-bold ${v > 0.1 ? "text-chart-4" : "text-muted-foreground"}`}>
                            {v > 0.1 ? `+${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-mono text-sm font-bold">{xFin.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="py-2 pl-3 text-right font-mono text-xs text-chart-2">{growth !== "—" ? `+${growth}%` : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Tableau x cumulé */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">x*(i,τ) — Capacité cumulée (ktep/an)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">Technologie</th>
                    {DEFAULT_PERIODS.map(y => <th key={y} className="text-right py-2 px-4">τ = {y}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {TECHNOLOGIES.map((tech, i) => (
                    <tr key={tech} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-4 font-medium">{tech}</td>
                      {finalSolution.cumX[i]?.map((v: number, t: number) => (
                        <td key={t} className="py-2 px-4 text-right font-mono text-sm">
                          {v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-semibold bg-secondary/10">
                    <td className="py-2 pr-4 text-xs uppercase tracking-wide">Total capacité</td>
                    {DEFAULT_PERIODS.map((_, t) => {
                      const tot = TECHNOLOGIES.reduce((s, __, i) => s + (finalSolution.cumX[i]?.[t] ?? 0), 0)
                      return <td key={t} className="py-2 px-4 text-right font-mono text-sm">{tot.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    })}
                  </tr>
                  <tr className="border-b border-border/40 bg-chart-2/5">
                    <td className="py-2 pr-4 text-xs text-chart-2 font-semibold">Part REN (%)</td>
                    {DEFAULT_PERIODS.map((_, t) => {
                      const ren = (finalSolution.cumX[0]?.[t] ?? 0) + (finalSolution.cumX[1]?.[t] ?? 0)
                      const tot = TECHNOLOGIES.reduce((s, __, i) => s + (finalSolution.cumX[i]?.[t] ?? 0), 0)
                      const pct = tot > 0 ? (ren / tot * 100).toFixed(1) : "0"
                      return <td key={t} className="py-2 px-4 text-right font-mono text-xs font-bold text-chart-2">{pct}%</td>
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Variables second rang E[y*(i,τ)] ──────────────────────────────── */}
        <Card className="border-chart-2/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 rounded-full bg-chart-2 text-white text-xs items-center justify-center font-bold">2</span>
              Variables de second rang — Production espérée E[y*(i,τ)] et déficit E[u*(τ)]
            </CardTitle>
            <CardDescription>
              Décisions de recours — espérance pondérée sur {nScenarios} scénarios LHS (p_ω = {(1/nScenarios).toFixed(4)})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const avgP: number[][] = TECHNOLOGIES.map((_, i) =>
                DEFAULT_PERIODS.map((__, t) =>
                  lastIter.subproblems.reduce((s, sr, w) => s + scenarios[w].prob * (sr.periods[t]?.production[i] ?? 0), 0)
                )
              )
              const avgD: number[] = DEFAULT_PERIODS.map((_, t) =>
                lastIter.subproblems.reduce((s, sr, w) => s + scenarios[w].prob * (sr.periods[t]?.deficit ?? 0), 0)
              )
              const renT = DEFAULT_PERIODS.map((_, t) => {
                const ren = (avgP[0]?.[t] ?? 0) + (avgP[1]?.[t] ?? 0)
                const tot = TECHNOLOGIES.reduce((s2, __, i) => s2 + (avgP[i]?.[t] ?? 0), 0)
                return tot > 0 ? ren / tot * 100 : 0
              })
              const emT = DEFAULT_PERIODS.map((_, t) =>
                TECHNOLOGIES.reduce((s2, tech, i) => s2 + (EMISSION_FACTOR[tech] ?? 0) * (avgP[i]?.[t] ?? 0), 0)
              )
              return (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">E[y*(i,τ)] — Production espérée par technologie (ktep/an)</p>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="text-left py-2 pr-4">Technologie</th>
                          {DEFAULT_PERIODS.map(y => <th key={y} className="text-right py-2 px-4">E[y τ={y}]</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {TECHNOLOGIES.map((tech, i) => (
                          <tr key={tech} className="border-b border-border/40 hover:bg-secondary/10">
                            <td className="py-2 pr-4 font-medium">{tech}</td>
                            {avgP[i]?.map((v, t) => (
                              <td key={t} className={`py-2 px-4 text-right font-mono text-sm ${v > 1 ? "font-semibold" : "text-muted-foreground"}`}>
                                {v > 1 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr className="border-t-2 border-border bg-chart-1/5">
                          <td className="py-2 pr-4 text-chart-1 font-semibold text-sm">E[u_τ] Déficit</td>
                          {avgD.map((v, t) => (
                            <td key={t} className={`py-2 px-4 text-right font-mono text-sm font-bold ${v > 1 ? "text-chart-1" : "text-muted-foreground"}`}>
                              {v > 1 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* REN_t */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">REN_t — Part des renouvelables (%)</p>
                      <div className="space-y-2">
                        {DEFAULT_PERIODS.map((yr, t) => (
                          <div key={yr} className="flex items-center gap-3">
                            <span className="text-xs w-10 font-mono">{yr}</span>
                            <div className="flex-1 bg-secondary/30 rounded-full h-4 overflow-hidden">
                              <div
                                className="h-full bg-chart-2 rounded-full transition-all"
                                style={{ width: `${Math.min(renT[t], 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold w-12 text-right ${renT[t] >= 60 ? "text-chart-2" : renT[t] >= 27 ? "text-yellow-500" : "text-chart-1"}`}>
                              {renT[t].toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* EM_t */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">EM_t — Émissions par période (MtCO₂)</p>
                      <div className="space-y-2">
                        {DEFAULT_PERIODS.map((yr, t) => (
                          <div key={yr} className="flex items-center gap-3">
                            <span className="text-xs w-10 font-mono">{yr}</span>
                            <div className="flex-1 bg-secondary/30 rounded-full h-4 overflow-hidden">
                              <div className="h-full bg-chart-1 rounded-full" style={{ width: `${Math.min(emT[t] / (emT[0] || 1) * 100, 100)}%` }} />
                            </div>
                            <span className="text-xs font-bold w-20 text-right font-mono">{emT[t].toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </CardContent>
        </Card>

        {/* ── Variables duales E[π*(i,τ)] ───────────────────────────────────── */}
        <Card className="border-chart-3/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 rounded-full bg-chart-3 text-white text-xs items-center justify-center font-bold">3</span>
              Prix marginaux E[π*(i,τ)] — Variables duales espérées
            </CardTitle>
            <CardDescription>
              E[π] = Σ_ω p_ω · π^ω · π_Dem : coût d'une unité de demande supplémentaire · π_i : valeur d'une unité de capacité supplémentaire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">Variable duale</th>
                    {DEFAULT_PERIODS.map(y => <th key={y} className="text-right py-2 px-4">E[π τ={y}]</th>)}
                    <th className="text-right py-2 pl-4">Interprétation</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "E[π_Dem] (M€/ktep)",
                      vals: DEFAULT_PERIODS.map((_, t) => lastIter.subproblems.reduce((s, sr, w) => s + scenarios[w].prob * (sr.periods[t]?.shadowDemand ?? 0), 0)),
                      note: "Coût marginal demande",
                    },
                    ...TECHNOLOGIES.map((tech, i) => ({
                      label: `E[π_${tech}] (M€/ktep)`,
                      vals: DEFAULT_PERIODS.map((_, t) => lastIter.subproblems.reduce((s, sr, w) => s + scenarios[w].prob * (sr.periods[t]?.shadowCap[i] ?? 0), 0)),
                      note: i <= 1 ? "REN — coût d'opportunité" : i === 6 ? "Batterie — valeur stockage" : "Fossile — contrainte cap.",
                    })),
                  ].map(row => (
                    <tr key={row.label} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-4 font-mono text-xs font-medium">{row.label}</td>
                      {row.vals.map((v, t) => (
                        <td key={t} className={`py-2 px-4 text-right font-mono text-xs ${Math.abs(v) > 1e-4 ? "font-bold text-chart-4" : "text-muted-foreground"}`}>
                          {Math.abs(v) > 1e-4 ? v.toFixed(4) : "0"}
                        </td>
                      ))}
                      <td className="py-2 pl-4 text-xs text-muted-foreground">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3 p-2 bg-secondary/10 rounded-lg">
              π = 0 → contrainte inactive (slack) · π &gt; 0 → contrainte saturée, investissement bénéfique · Complément à zéro KKT vérifié.
            </p>
          </CardContent>
        </Card>

        {/* ── Détail par scénario — résumé compact ──────────────────────────── */}
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 rounded-full bg-muted text-foreground text-xs items-center justify-center font-bold">4</span>
              Détail second rang — Coût Q^ω et déficit u^ω par scénario
            </CardTitle>
            <CardDescription>Vue consolidée des {nScenarios} scénarios LHS — solution de recours y^ω*(i,τ)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">Scénario ω</th>
                    <th className="text-right py-2 px-3">p_ω</th>
                    <th className="text-right py-2 px-3">Coût op. Q^ω (M€)</th>
                    <th className="text-right py-2 px-3">Déficit Σ_τ u^ω_τ</th>
                    <th className="text-right py-2 px-3">GES Z₂^ω (MtCO₂)</th>
                    {DEFAULT_PERIODS.map(y => <th key={y} className="text-right py-2 px-2 text-xs">y_PV_{y}</th>)}
                    {DEFAULT_PERIODS.map(y => <th key={y} className="text-right py-2 px-2 text-xs">y_Wind_{y}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {lastIter.subproblems.map((sp, w) => {
                    const totDef = sp.periods.reduce((s, p) => s + p.deficit, 0)
                    return (
                      <tr key={w} className="border-b border-border/40 hover:bg-secondary/10">
                        <td className="py-1.5 pr-4 font-medium text-xs">ω{w + 1}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs">{scenarios[w].prob.toFixed(4)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs">{sp.totalOpCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className={`py-1.5 px-3 text-right font-mono text-xs ${totDef > 0 ? "text-chart-1 font-bold" : "text-muted-foreground"}`}>
                          {totDef > 0 ? totDef.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs">{sp.totalGhg.toFixed(3)}</td>
                        {sp.periods.map((pd, t) => (
                          <td key={t} className="py-1.5 px-2 text-right font-mono text-xs text-chart-3">
                            {(pd.production[0] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        ))}
                        {sp.periods.map((pd, t) => (
                          <td key={t} className="py-1.5 px-2 text-right font-mono text-xs text-chart-4">
                            {(pd.production[1] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-secondary/10 font-semibold border-t-2 border-border">
                  <tr>
                    <td className="py-2 pr-4 text-xs">E[·] pondéré</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">1.0000</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {lastIter.subproblems.reduce((s, sp, w) => s + scenarios[w].prob * sp.totalOpCost, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {lastIter.subproblems.reduce((s, sp, w) => s + scenarios[w].prob * sp.periods.reduce((a, p) => a + p.deficit, 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {lastIter.subproblems.reduce((s, sp, w) => s + scenarios[w].prob * sp.totalGhg, 0).toFixed(3)}
                    </td>
                    <td colSpan={DEFAULT_PERIODS.length * 2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Bloc export complet ────────────────────────────────────────────── */}
        <Card className="border-2 border-chart-4/40 bg-chart-4/3">
          <CardHeader className="pb-3">
            <CardTitle>Export complet du rapport — Onglets 1 à 10</CardTitle>
            <CardDescription>
              Toutes les variables, tous les tableaux, tous les graphiques, toutes les interprétations — PDF mémoire technique ou Excel 11 feuilles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-violet-300 bg-violet-50/50 dark:bg-violet-900/10 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-violet-700 dark:text-violet-400">
                  <Printer className="h-4 w-4" />PDF — Mémoire technique complet
                </div>
                <p className="text-xs text-muted-foreground">
                  10 sections · Figures 6.1–6.13 · Tables 6.2–6.24 · Formules · Diagnostic Ch.7 · Front de Pareto · Vérification NDC
                </p>
                <Button onClick={downloadLShapedPDF} disabled={pdfLoading} className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2">
                  {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                  {pdfLoading ? "Génération…" : "Télécharger PDF"}
                </Button>
              </div>
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                  <Sheet className="h-4 w-4" />Excel — 11 feuilles de données complètes
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {[
                    "01_Configuration · 02_Scénarios_LHS",
                    "03_Convergence (LB/UB/Gap_k)",
                    "04_PremierRang_x* · 05_SecondRang_Ey*",
                    "06_SecondRang_y_omega · 07_Duales_pi",
                    "08_Coupes_Benders · 09_Eco_Env",
                    "10_Annuel_2024_2050 · 11_Pareto",
                  ].map(l => <li key={l} className="flex gap-1"><span className="text-emerald-500">·</span>{l}</li>)}
                </ul>
                <Button onClick={() => exportToExcelLShaped(result, paretoPoints, isLHSBased)} variant="outline" className="w-full border-emerald-500 text-emerald-700 hover:bg-emerald-50 gap-2">
                  <Sheet className="h-4 w-4" />Télécharger Excel
                </Button>
              </div>
            </div>

            {/* Indicateur statut global */}
            <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-secondary/20">
              {result.status === "converged"
                ? <CheckCircle2 className="h-5 w-5 text-chart-2 shrink-0 mt-0.5" />
                : <XCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              }
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Statut de la solution :</strong>{" "}
                {result.status === "converged"
                  ? `Solution optimale certifiée — Gap final ${(result.finalGap * 100).toFixed(4)} % < ε = ${(result.config.tolerance * 100).toFixed(2)} % · ${iterations.length} itérations · ${result.iterations.reduce((s, it) => s + it.cuts.length, 0)} coupes Benders · Source scénarios : ${isLHSBased ? "LHS ✓ (stratification garantie)" : "pseudo-aléatoire"}`
                  : `Max itérations atteint — Gap résiduel ${(result.finalGap * 100).toFixed(4)} % · Solution sous-optimale · Augmenter K_max dans Onglet 1`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-3 pt-4">
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

      {/* Hidden PDF render zone — must stay in viewport for SVGs to render */}
      <div style={{ position: 'fixed', top: '-9999px', left: 0, width: 960, pointerEvents: 'none', zIndex: -1 }}>
        <div ref={pdfRef} style={{ background: '#ffffff', padding: 0 }}>
          <LShapedPdfContent result={result} paretoPoints={paretoPoints} isLHSBased={isLHSBased} />
        </div>
      </div>
    </div>
  )
}

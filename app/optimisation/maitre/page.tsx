"use client"

import React from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts"
import {
  TECHNOLOGIES, DEFAULT_PERIODS, INITIAL_CAPACITY,
} from "@/lib/lshaped/types"
import Link from "next/link"

const TECH_COLORS: Record<string, string> = {
  PV: "#fbbf24", Wind: "#06b6d4", Gaz: "#3b82f6",
  Pétrole: "#dc2626", GPL: "#16a34a", Condensat: "#f59e0b", Batterie: "#8b5cf6",
}

function autoInterpretMaster(result: NonNullable<ReturnType<typeof useLShaped>["result"]>): string {
  const sol = result.finalSolution
  const pvGrowth = sol.cumX[0]?.[4] - INITIAL_CAPACITY["PV"]
  const windGrowth = sol.cumX[1]?.[4] - INITIAL_CAPACITY["Wind"]
  const batGrowth = sol.cumX[6]?.[4] - INITIAL_CAPACITY["Batterie"]
  const nIter = result.iterations.length

  const parts: string[] = []
  if (pvGrowth > 1000) parts.push(`PV +${pvGrowth.toLocaleString(undefined, {maximumFractionDigits: 0})} unités`)
  if (windGrowth > 500) parts.push(`Éolien +${windGrowth.toLocaleString(undefined, {maximumFractionDigits: 0})} unités`)
  if (batGrowth > 200) parts.push(`Stockage +${batGrowth.toLocaleString(undefined, {maximumFractionDigits: 0})} unités`)

  const dominant = parts.length > 0 ? `Investissements dominants : ${parts.join(", ")}.` : ""
  const conv = result.status === "converged"
    ? `Convergence atteinte en ${nIter} itérations (Gap = ${(result.finalGap * 100).toFixed(3)} %).`
    : `Maximum d'itérations atteint (${nIter}) — gap résiduel ${(result.finalGap * 100).toFixed(3)} %.`

  return `${conv} ${dominant} Le maître LP ajoute une coupe d'optimalité par scénario à chaque itération (${result.config.nScenarios} coupes/iter).`
}

export default function MaitrePage() {
  const { result } = useLShaped()

  if (!result) return (
    <div className="max-w-5xl mx-auto">
      <div className="p-6 rounded-lg border border-yellow-500/40 bg-yellow-500/5 flex gap-3">
        <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
        <p className="text-sm">
          Aucun résultat disponible. Lancez la résolution depuis{" "}
          <Link href="/optimisation/resolution" className="underline text-chart-4">l'onglet 1</Link>.
        </p>
      </div>
    </div>
  )

  const nPeriods = DEFAULT_PERIODS.length
  const sol = result.finalSolution

  // Table 6.7 data
  const table67 = result.iterations.map(it => ({
    k: it.k,
    nCuts: it.cuts.length,
    LB: it.LB,
    thetaSum: it.master.theta.reduce((a, b) => a + b, 0),
    CAPEX: it.master.investCost,
    cpu: it.timeMs,
  }))

  // Figure 6.2 — capacity trajectory [nTech × nPeriods]
  const capacityChart = DEFAULT_PERIODS.map((yr, t) => {
    const row: Record<string, number> = { year: yr }
    TECHNOLOGIES.forEach((tech, i) => {
      row[tech] = sol.cumX[i]?.[t] ?? INITIAL_CAPACITY[tech]
    })
    return row
  })

  // Table 6.8 — investments (Δx and x) from final master solution
  const investRows: { tech: string; periods: { dx: number; cumX: number }[] }[] = TECHNOLOGIES.map((tech, i) => ({
    tech,
    periods: DEFAULT_PERIODS.map((_, t) => ({
      dx: sol.deltaX[i]?.[t] ?? 0,
      cumX: sol.cumX[i]?.[t] ?? INITIAL_CAPACITY[tech],
    })),
  }))

  const interpretation = autoInterpretMaster(result)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Onglet 3 — Problème maître</h1>
        <p className="text-sm text-muted-foreground">
          Master LP (L-Shaped) — {result.iterations.length} itérations · {result.config.nScenarios} coupes/iter
        </p>
      </div>

      {/* Auto-interpretation */}
      <Card className="border-chart-4/30 bg-chart-4/5">
        <CardContent className="py-4">
          <p className="text-sm text-foreground">{interpretation}</p>
        </CardContent>
      </Card>

      {/* Table 6.7 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.7 — Résumé des itérations du problème maître
          </CardTitle>
          <CardDescription>LB : borne inférieure · CAPEX : coût total investissement · CPU : temps par itération</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Iter. k</th>
                  <th className="text-right py-2 px-4">Coupes ajoutées</th>
                  <th className="text-right py-2 px-4">LB_k (M€)</th>
                  <th className="text-right py-2 px-4">Σθ_ω (M€)</th>
                  <th className="text-right py-2 px-4">CAPEX (M€)</th>
                  <th className="text-right py-2 px-4">CPU (ms)</th>
                </tr>
              </thead>
              <tbody>
                {table67.map(r => (
                  <tr key={r.k} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-2 pr-4 font-medium">{r.k}</td>
                    <td className="py-2 px-4 text-right">{r.nCuts}</td>
                    <td className="py-2 px-4 text-right font-mono text-chart-2">
                      {r.LB.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </td>
                    <td className="py-2 px-4 text-right font-mono">
                      {r.thetaSum.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </td>
                    <td className="py-2 px-4 text-right font-mono">
                      {r.CAPEX.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </td>
                    <td className="py-2 px-4 text-right text-muted-foreground">{r.cpu}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Figure 6.2 — Capacity trajectory */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {"Figure 6.2 — Trajectoire des capacités x_{i,τ} (solution finale)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={capacityChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(undefined, {maximumFractionDigits: 0}), name]} />
              <Legend />
              {TECHNOLOGIES.map(tech => (
                <Line key={tech} type="monotone" dataKey={tech}
                  stroke={TECH_COLORS[tech]} strokeWidth={2} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table 6.8 — Investments Δx and x */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {"Table 6.8 — Investissements Δx_{i,τ} et capacités cumulées x_{i,τ}"}
          </CardTitle>
          <CardDescription>Solution maître finale · Unités : même unité que la demande</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Technologie</th>
                  {DEFAULT_PERIODS.map(yr => (
                    <th key={yr} className="text-right py-2 px-3" colSpan={2}>
                      τ = {yr}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="text-left py-1 pr-4"></th>
                  {DEFAULT_PERIODS.map(yr => (
                    <React.Fragment key={yr}>
                      <th className="text-right py-1 px-2 text-[10px]">Δx</th>
                      <th className="text-right py-1 px-2 text-[10px]">x (cum.)</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {investRows.map(({ tech, periods }) => (
                  <tr key={tech} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-2 pr-4 font-medium" style={{ color: TECH_COLORS[tech] }}>{tech}</td>
                    {periods.map((p, t) => (
                      <React.Fragment key={t}>
                        <td className="py-2 px-2 text-right font-mono text-xs">
                          {p.dx > 0
                            ? <span className="text-chart-2">+{p.dx.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-xs">
                          {p.cumX.toLocaleString(undefined, {maximumFractionDigits: 0})}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Table 6.9 — History of master solutions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.9 — Historique des solutions maître (CAPEX d'investissement)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-6">Iter.</th>
                  {TECHNOLOGIES.map(t => (
                    <th key={t} className="text-right py-2 px-3">{t}</th>
                  ))}
                  <th className="text-right py-2 pl-4">CAPEX tot.</th>
                </tr>
              </thead>
              <tbody>
                {result.iterations.map(it => (
                  <tr key={it.k} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-2 pr-6 font-medium">{it.k}</td>
                    {TECHNOLOGIES.map((_, i) => {
                      const deltaSum = it.master.deltaX[i]?.reduce((a, b) => a + b, 0) ?? 0
                      return (
                        <td key={i} className="py-2 px-3 text-right font-mono text-xs">
                          {deltaSum > 0
                            ? <span className="text-chart-2">+{deltaSum.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      )
                    })}
                    <td className="py-2 pl-4 text-right font-mono font-semibold">
                      {it.master.investCost.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

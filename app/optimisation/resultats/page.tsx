"use client"

import Link from "next/link"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts"
import { Play, Trophy } from "lucide-react"
import { TECHNOLOGIES, DEFAULT_PERIODS, DEFAULT_PERIOD_SPANS, INITIAL_CAPACITY } from "@/lib/lshaped/types"

const TECH_COLORS = [
  "#fbbf24",  // PV - amber
  "#06b6d4",  // Wind - cyan
  "#3b82f6",  // Gaz - blue
  "#dc2626",  // Pétrole - red
  "#16a34a",  // GPL - green
  "#f59e0b",  // Condensat - orange
  "#8b5cf6",  // Batterie - purple
]

export default function ResultatsPage() {
  const { result } = useLShaped()

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Resultats optimaux</h1>
          <p className="text-muted-foreground">Capacites installee et plan de production optimal.</p>
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

  const { finalSolution, scenarios, totalCost, totalGhg } = result
  const nScenarios = scenarios.length
  const nPeriods = DEFAULT_PERIODS.length

  // Chart: new capacity added per period
  const deltaXChart = DEFAULT_PERIODS.map((year, pIdx) => {
    const entry: Record<string, number | string> = { year: year.toString() }
    TECHNOLOGIES.forEach((t, i) => {
      entry[t] = parseFloat((finalSolution.deltaX[i][pIdx]).toFixed(1))
    })
    return entry
  })

  // Chart: cumulative capacity per period
  const cumXChart = DEFAULT_PERIODS.map((year, pIdx) => {
    const entry: Record<string, number | string> = { year: year.toString() }
    TECHNOLOGIES.forEach((t, i) => {
      entry[t] = parseFloat((finalSolution.cumX[i][pIdx]).toFixed(1))
    })
    return entry
  })

  // Average production across scenarios at final solution (last iteration subproblems)
  const lastIter = result.iterations[result.iterations.length - 1]
  const avgProdChart = DEFAULT_PERIODS.map((year, pIdx) => {
    const entry: Record<string, number | string> = { year: year.toString() }
    TECHNOLOGIES.forEach((t, i) => {
      const avg = lastIter.subproblems.reduce(
        (s, sp, w) => s + scenarios[w].prob * sp.periods[pIdx].production[i],
        0
      )
      entry[t] = parseFloat(avg.toFixed(1))
    })
    const avgDeficit = lastIter.subproblems.reduce(
      (s, sp, w) => s + scenarios[w].prob * sp.periods[pIdx].deficit,
      0
    )
    entry['Deficit'] = parseFloat(avgDeficit.toFixed(1))
    return entry
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-6 w-6 text-chart-1" />
          <h1 className="text-3xl font-bold">Resultats optimaux</h1>
        </div>
        <p className="text-muted-foreground">
          Solution optimale du probleme maitre L-Shaped · Status : {result.status === 'converged' ? 'Convergee' : 'Max iter'} · Gap = {(result.finalGap * 100).toFixed(3)}%
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { l: "Coût total Z₁", v: `${totalCost.toFixed(0)} M€`, c: "chart-1" },
          { l: "Emissions Z₂", v: `${totalGhg.toFixed(1)} MtCO₂`, c: "chart-3" },
          { l: "Investissement CAPEX", v: `${finalSolution.investCost.toFixed(0)} M€`, c: "chart-2" },
          { l: "Coût opérationnel", v: `${(totalCost - finalSolution.investCost).toFixed(0)} M€`, c: "chart-4" },
        ].map(d => (
          <div key={d.l} className={`p-4 rounded-xl bg-${d.c}/10 border border-${d.c}/30`}>
            <p className="text-xs text-muted-foreground">{d.l}</p>
            <p className={`text-xl font-bold text-${d.c}`}>{d.v}</p>
          </div>
        ))}
      </div>

      {/* New capacity chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{"Nouvelles capacites installees Δx_{i,t} (ktep/an)"}</CardTitle>
          <CardDescription>Capacite additionnelle recommandee par periode d'investissement — courbes par technologie</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={deltaXChart} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(0)} ktep/an`]} />
              <Legend />
              {TECHNOLOGIES.map((t, i) => (
                <Line key={t} type="monotone" dataKey={t} stroke={TECH_COLORS[i]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cumulative capacity chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{"Capacite cumulee x_{i,t} (ktep/an)"}</CardTitle>
          <CardDescription>Evolution du parc energetique optimal sur 2024–2050</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cumXChart} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(0)} ktep/an`]} />
              <Legend />
              {TECHNOLOGIES.map((t, i) => (
                <Line key={t} type="monotone" dataKey={t} stroke={TECH_COLORS[i]} strokeWidth={2} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Average production chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{"Production moyenne esperee E[y_{i,t}] (ktep)"}</CardTitle>
          <CardDescription>Dispatche moyen pondere sur les {nScenarios} scenarios a la derniere iteration — courbes par technologie</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={avgProdChart} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(0)} ktep`]} />
              <Legend />
              {TECHNOLOGIES.map((t, i) => (
                <Line key={t} type="monotone" dataKey={t} stroke={TECH_COLORS[i]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              ))}
              <Line type="monotone" dataKey="Deficit" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} name="Deficit" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Investment table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Tableau des investissements optimaux</CardTitle>
          <CardDescription>{"Δx_{i,t} en ktep/an — capacite additionnelle par technologie et periode"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left py-2 pr-4">Technologie</th>
                  <th className="text-right py-2 px-3">x₀ (2024)</th>
                  {DEFAULT_PERIODS.map(y => (
                    <th key={y} className="text-right py-2 px-3">Δx {y}</th>
                  ))}
                  {DEFAULT_PERIODS.map(y => (
                    <th key={`cum${y}`} className="text-right py-2 px-3">x {y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TECHNOLOGIES.map((t, i) => (
                  <tr key={t} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-2 pr-4 font-medium" style={{ color: TECH_COLORS[i] }}>{t}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {INITIAL_CAPACITY[t].toLocaleString()}
                    </td>
                    {finalSolution.deltaX[i].map((dx, pIdx) => (
                      <td key={pIdx} className="py-2 px-3 text-right font-mono text-xs" style={{ color: dx > 100 ? '#22c55e' : dx > 0 ? undefined : undefined, fontWeight: dx > 100 ? 700 : 400 }}>
                        {dx > 0.5 ? dx.toFixed(0) : '—'}
                      </td>
                    ))}
                    {finalSolution.cumX[i].map((cx, pIdx) => (
                      <td key={pIdx} className="py-2 px-3 text-right font-mono text-xs">
                        {cx.toFixed(0)}
                      </td>
                    ))}
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

"use client"

import { useState } from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, AlertCircle } from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts"
import { DEFAULT_PERIODS } from "@/lib/lshaped/types"
import Link from "next/link"

const PALETTE = [
  "#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6",
  "#06b6d4","#f97316","#84cc16","#ec4899","#14b8a6",
  "#6366f1","#e11d48","#0ea5e9","#d97706","#7c3aed",
  "#10b981","#fb7185","#38bdf8","#a3e635","#fb923c",
]

function stats(vals: number[]) {
  const n = vals.length
  const mean = vals.reduce((a, b) => a + b, 0) / n
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  const cv = mean > 0 ? std / mean : 0
  return { mean, min, max, std, cv }
}

export default function ScenariosPage() {
  const { scenarios, result, runSolver, isRunning } = useLShaped()
  const [hovered, setHovered] = useState<number | null>(null)

  const sc = result?.scenarios ?? scenarios
  const noData = sc.length === 0

  // Build chart data: one point per period
  const chartData = DEFAULT_PERIODS.map((yr, t) => {
    const row: Record<string, number> = { year: yr }
    sc.forEach((s, i) => { row[`sc${i}`] = s.periods[t]?.demand ?? 0 })
    return row
  })

  // Stats table per period
  const statsRows = DEFAULT_PERIODS.map((yr, t) => {
    const vals = sc.map(s => s.periods[t]?.demand ?? 0)
    return { year: yr, ...stats(vals) }
  })

  // Scenario identification
  const identifyScenarios = () => {
    if (sc.length === 0) return []
    const avgDemand = sc.map(s => s.periods.reduce((a, p) => a + p.demand, 0) / s.periods.length)
    const sortedIdx = [...avgDemand.map((_, i) => i)].sort((a, b) => avgDemand[a] - avgDemand[b])
    return [
      { label: "Scénario pessimiste (demande max)", idx: sortedIdx[sortedIdx.length - 1] },
      { label: "Scénario optimiste (demande min)", idx: sortedIdx[0] },
      { label: "Scénario médian", idx: sortedIdx[Math.floor(sortedIdx.length / 2)] },
    ]
  }
  const identified = identifyScenarios()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Onglet 2 — Génération et analyse des scénarios</h1>
        <p className="text-sm text-muted-foreground">
          Figure 6.1 — {sc.length} scénarios LHS · Horizon 2024–2050 · |Ω| = {sc.length}
        </p>
      </div>

      {noData && (
        <div className="p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/5 flex gap-3">
          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-yellow-500">Aucun scénario disponible</p>
            <p className="text-muted-foreground mt-1">
              Lancez d'abord la résolution depuis{" "}
              <Link href="/optimisation/resolution" className="underline">l'onglet 1</Link>
              {" "}pour générer les scénarios.
            </p>
          </div>
        </div>
      )}

      {noData && (
        <div className="flex justify-center">
          <Button onClick={() => runSolver()} disabled={isRunning}
            className="gap-2 bg-chart-4 hover:bg-chart-4/90 text-white">
            <Play className="h-4 w-4" />
            Générer les scénarios (résolution rapide)
          </Button>
        </div>
      )}

      {/* Figure 6.1 — 20 courbes D^ω_t */}
      {!noData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Figure 6.1 — Courbes de demande D^ω_t par scénario (|Ω| = {sc.length})
            </CardTitle>
            <CardDescription>Survolez une courbe pour la mettre en évidence</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, name: string) => {
                    const i = parseInt(name.replace("sc",""))
                    return [`${v.toLocaleString()} ktep/an`, `Scénario ω${i+1}`]
                  }}
                />
                {sc.map((_, i) => (
                  <Line
                    key={i}
                    dataKey={`sc${i}`}
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={hovered === null ? 1.5 : hovered === i ? 2.5 : 0.5}
                    dot={false}
                    opacity={hovered === null ? 0.8 : hovered === i ? 1 : 0.15}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table 6.6 — stats par période */}
      {!noData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Table 6.6 — Statistiques descriptives par période (demande D^ω_t)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-6">Période (τ)</th>
                    <th className="text-right py-2 px-4">Moyenne</th>
                    <th className="text-right py-2 px-4">Min</th>
                    <th className="text-right py-2 px-4">Max</th>
                    <th className="text-right py-2 px-4">Écart-type</th>
                    <th className="text-right py-2 px-4">CV (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {statsRows.map(r => (
                    <tr key={r.year} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-6 font-medium">{r.year}</td>
                      <td className="py-2 px-4 text-right font-mono">{r.mean.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                      <td className="py-2 px-4 text-right font-mono text-chart-2">{r.min.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                      <td className="py-2 px-4 text-right font-mono text-chart-1">{r.max.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                      <td className="py-2 px-4 text-right font-mono">{r.std.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                      <td className="py-2 px-4 text-right font-mono font-semibold">{(r.cv * 100).toFixed(1)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Unités : ktep/an · N = {sc.length} scénarios · Méthode : LHS (Latin Hypercube Sampling)</p>
          </CardContent>
        </Card>
      )}

      {/* Identification automatique */}
      {!noData && identified.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Identification automatique des scénarios remarquables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {identified.map(({ label, idx }) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                  <div className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="ml-auto font-mono text-sm text-chart-4">ω{idx + 1}  (p = {sc[idx]?.prob?.toFixed(4)})</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                Probabilité uniforme : p_ω = 1/|Ω| = {sc.length > 0 ? (1/sc.length).toFixed(4) : "—"} · Biais corrigé par LHS (pondération uniforme)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

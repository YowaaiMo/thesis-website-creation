"use client"

import Link from "next/link"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from "recharts"
import { Play, TrendingDown } from "lucide-react"

export default function IterationsPage() {
  const { result } = useLShaped()

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Convergence L-Shaped</h1>
          <p className="text-muted-foreground">Evolution des bornes LB(k) et UB(k) au fil des iterations.</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Play className="h-8 w-8 mx-auto mb-4 opacity-40" />
            <p>Aucune resolution disponible. Lancez le solveur d'abord.</p>
            <Button asChild className="mt-4 gap-2">
              <Link href="/optimisation/resolution"><Play className="h-4 w-4" />Aller a la resolution</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const chartData = result.iterations.map(it => ({
    k: it.k,
    LB: parseFloat(it.LB.toFixed(2)),
    UB: parseFloat(it.UB.toFixed(2)),
    gap: parseFloat((it.gap * 100).toFixed(4)),
    time: it.timeMs,
  }))

  const finalIter = result.iterations[result.iterations.length - 1]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Convergence L-Shaped</h1>
        <p className="text-muted-foreground">
          {result.iterations.length} iterations · Status : {result.status === 'converged' ? 'Convergee' : 'Max iterations atteint'} · Gap final : {(result.finalGap * 100).toFixed(3)}%
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { l: "Borne inf finale LB", v: `${result.finalLB.toFixed(1)} M€`, color: "#22c55e" },
          { l: "Borne sup finale UB", v: `${result.bestUB.toFixed(1)} M€`,  color: "#f97316" },
          { l: "Gap relatif", v: `${(result.finalGap * 100).toFixed(3)}%`,  color: "#6366f1" },
          { l: "Iterations", v: result.iterations.length.toString(),         color: "#a855f7" },
        ].map(d => (
          <div key={d.l} className="p-4 rounded-xl" style={{ background: d.color + "18", border: `1px solid ${d.color}50` }}>
            <p className="text-xs text-muted-foreground">{d.l}</p>
            <p className="text-xl font-bold" style={{ color: d.color }}>{d.v}</p>
          </div>
        ))}
      </div>

      {/* LB / UB chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Evolution des bornes LB(k) et UB(k)</CardTitle>
          <CardDescription>LB monte, UB descend — elles convergent vers la solution optimale</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="k" label={{ value: "Iteration k", position: "insideBottom", offset: -4 }} />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                label={{ value: "M€", angle: -90, position: "insideLeft" }}
              />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)} M€`]} labelFormatter={k => `Iteration ${k}`} />
              <Legend />
              <Line type="monotone" dataKey="LB" name="LB (borne inf)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="UB" name="UB (borne sup)" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gap chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-chart-4" />
            Ecart relatif Gap(k)
          </CardTitle>
          <CardDescription>Gap_k = (UB_k − LB_k) / max(1, |UB_k|) · 100%</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="k" label={{ value: "Iteration k", position: "insideBottom", offset: -4 }} />
              <YAxis domain={[0, 'auto']} tickFormatter={v => `${v.toFixed(2)}%`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(4)}%`]} labelFormatter={k => `Iteration ${k}`} />
              <ReferenceLine y={result.config.tolerance * 100} stroke="#22c55e" strokeDasharray="4 2" label={{ value: `ε=${(result.config.tolerance * 100).toFixed(1)}%`, fill: "#22c55e", fontSize: 11 }} />
              <Line type="monotone" dataKey="gap" name="Gap (%)" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tableau de convergence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 pr-4">k</th>
                  <th className="text-right py-2 px-4">LB (M€)</th>
                  <th className="text-right py-2 px-4">UB (M€)</th>
                  <th className="text-right py-2 px-4">Gap (%)</th>
                  <th className="text-right py-2 px-4">Coupes</th>
                  <th className="text-right py-2 pl-4">Temps (ms)</th>
                </tr>
              </thead>
              <tbody>
                {result.iterations.map(it => (
                  <tr key={it.k} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="py-2 pr-4 font-mono">{it.k}</td>
                    <td className="py-2 px-4 text-right font-mono" style={{ color: "#22c55e" }}>{it.LB.toFixed(1)}</td>
                    <td className="py-2 px-4 text-right font-mono" style={{ color: "#f97316" }}>{it.UB.toFixed(1)}</td>
                    <td className="py-2 px-4 text-right font-mono">
                      <span style={{ color: it.gap <= result.config.tolerance ? "#22c55e" : "#f97316", fontWeight: it.gap <= result.config.tolerance ? 600 : 400 }}>
                        {(it.gap * 100).toFixed(4)}%
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right font-mono">{it.cuts.length}</td>
                    <td className="py-2 pl-4 text-right font-mono text-muted-foreground">{it.timeMs}</td>
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

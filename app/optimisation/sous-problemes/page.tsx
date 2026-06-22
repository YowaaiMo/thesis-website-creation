"use client"

import Link from "next/link"
import { useState } from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts"
import { Play } from "lucide-react"
import { TECHNOLOGIES, DEFAULT_PERIODS } from "@/lib/lshaped/types"

const TECH_COLORS = [
  "#fbbf24",  // PV - amber
  "#06b6d4",  // Wind - cyan
  "#3b82f6",  // Gaz - blue
  "#dc2626",  // Pétrole - red
  "#16a34a",  // GPL - green
  "#f59e0b",  // Condensat - orange
  "#8b5cf6",  // Batterie - purple
]

export default function SousProblemes() {
  const { result } = useLShaped()
  const [selIter, setSelIter] = useState(0)

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Sous-problemes</h1>
          <p className="text-muted-foreground">Dispatche operationnel par scenario et par periode.</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Play className="h-8 w-8 mx-auto mb-4 opacity-40" />
            <p>Aucune resolution. Lancez le solveur d'abord.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/optimisation/resolution">Aller a la resolution</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const iters = result.iterations
  const iter = iters[selIter]
  const nScenarios = iter.subproblems.length

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Sous-problemes</h1>
        <p className="text-muted-foreground">
          Plan de dispatche optimal par scenario ω a l'iteration k (merit-order economique + deficit penalise).
        </p>
      </div>

      {/* Iteration selector */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <span className="text-sm font-medium">Iteration :</span>
        {iters.map((it, idx) => (
          <button
            key={it.k}
            onClick={() => setSelIter(idx)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              idx === selIter
                ? "bg-chart-4 text-white"
                : "bg-secondary/50 hover:bg-secondary text-muted-foreground"
            }`}
          >
            k={it.k}
          </button>
        ))}
      </div>

      <Tabs defaultValue="0">
        <div className="overflow-x-auto pb-2 mb-4">
          <TabsList>
            {Array.from({ length: nScenarios }, (_, w) => (
              <TabsTrigger key={w} value={w.toString()}>ω={w + 1}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        {iter.subproblems.map((sp, w) => {
          const chartData = sp.periods.map((pd, pIdx) => {
            const entry: Record<string, number | string> = { period: DEFAULT_PERIODS[pIdx].toString() }
            TECHNOLOGIES.forEach((t, i) => {
              entry[t] = parseFloat(pd.production[i].toFixed(1))
            })
            entry['Deficit'] = parseFloat(pd.deficit.toFixed(1))
            return entry
          })

          return (
            <TabsContent key={w} value={w.toString()} className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { l: "Coût op. total", v: `${sp.totalOpCost.toFixed(1)} M€` },
                  { l: "Emissions GES", v: `${sp.totalGhg.toFixed(2)} MtCO₂` },
                  { l: "Deficit total", v: `${sp.periods.reduce((s, p) => s + p.deficit, 0).toFixed(0)} ktep` },
                  { l: "Coupe α", v: sp.cut.alpha.toFixed(1) },
                ].map(d => (
                  <div key={d.l} className="p-3 bg-secondary/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">{d.l}</p>
                    <p className="font-bold">{d.v}</p>
                  </div>
                ))}
              </div>

              {/* Production chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Production par technologie — Scenario {w + 1}</CardTitle>
                  <CardDescription>ktep par periode (dispatche merit-order) — courbes par technologie</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="period" />
                      <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(0)} ktep`]} />
                      <Legend />
                      {TECHNOLOGIES.map((t, i) => (
                        <Line key={t} type="monotone" dataKey={t} stroke={TECH_COLORS[i]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      ))}
                      <Line type="monotone" dataKey="Deficit" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Detailed table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tableau detaille par periode</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground text-xs">
                          <th className="text-left py-2 pr-3">Periode</th>
                          {TECHNOLOGIES.map(t => <th key={t} className="text-right py-2 px-2">{t}</th>)}
                          <th className="text-right py-2 px-2">Deficit</th>
                          <th className="text-right py-2 px-2">π_D (M€/ktep)</th>
                          <th className="text-right py-2 pl-2">GES (MtCO₂)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sp.periods.map((pd, pIdx) => (
                          <tr key={pIdx} className="border-b border-border/40 hover:bg-secondary/10">
                            <td className="py-2 pr-3 font-medium">{DEFAULT_PERIODS[pIdx]}</td>
                            {pd.production.map((y, i) => (
                              <td key={i} className="py-2 px-2 text-right font-mono text-xs">
                                {y > 0 ? y.toFixed(0) : <span className="text-muted-foreground">—</span>}
                              </td>
                            ))}
                            <td className={`py-2 px-2 text-right font-mono text-xs ${pd.deficit > 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                              {pd.deficit > 0 ? pd.deficit.toFixed(0) : '—'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-xs">{pd.shadowDemand.toFixed(3)}</td>
                            <td className="py-2 pl-2 text-right font-mono text-xs">{pd.ghg.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

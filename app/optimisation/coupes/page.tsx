"use client"

import Link from "next/link"
import { useState } from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Scissors } from "lucide-react"
import { TECHNOLOGIES, DEFAULT_PERIODS } from "@/lib/lshaped/types"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts"

export default function CoupesPage() {
  const { result } = useLShaped()
  const [selScenario, setSelScenario] = useState(0)

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Coupes generees</h1>
          <p className="text-muted-foreground">Coupes d'optimalite (multicoupe) θ_ω ≥ α + β·x</p>
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

  const allCuts = result.iterations.flatMap(it => it.cuts)
  const nScenarios = result.scenarios.length

  // All cuts for selected scenario
  const scenarioCuts = allCuts.filter(c => c.scenarioIdx === selScenario)

  // For visualisation: plot alpha vs iteration for each scenario
  const cutEvolution = result.iterations.map(it => {
    const row: Record<string, number> = { k: it.k }
    for (let w = 0; w < nScenarios; w++) {
      const cut = it.cuts.find(c => c.scenarioIdx === w)
      if (cut) row[`ω${w + 1}`] = parseFloat(cut.alpha.toFixed(2))
    }
    return row
  })

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Scissors className="h-6 w-6 text-chart-4" />
          <h1 className="text-3xl font-bold">Coupes d'optimalite (Multicoupe)</h1>
        </div>
        <p className="text-muted-foreground">
          {allCuts.length} coupes generees · {nScenarios} scenarios ·{" "}
          θ<sub>ω</sub> ≥ α<sup>k</sup><sub>ω</sub> + (β<sup>k</sup><sub>ω</sub>)<sup>T</sup> x
        </p>
      </div>

      {/* Global summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { l: "Coupes totales", v: allCuts.length.toString() },
          { l: "Iterations", v: result.iterations.length.toString() },
          { l: "Scenarios", v: nScenarios.toString() },
          { l: "Coupes/iteration", v: (allCuts.length / result.iterations.length).toFixed(1) },
        ].map(d => (
          <div key={d.l} className="p-4 bg-secondary/30 rounded-xl">
            <p className="text-xs text-muted-foreground">{d.l}</p>
            <p className="text-2xl font-bold text-chart-4">{d.v}</p>
          </div>
        ))}
      </div>

      {/* Alpha evolution chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Evolution de α<sup>k</sup><sub>ω</sub> par scenario</CardTitle>
          <CardDescription>La constante de coupe monte (borne inferieure s'ameliore) avec les iterations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mb-2">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left py-2 pr-4">k</th>
                  {Array.from({ length: nScenarios }, (_, w) => (
                    <th key={w} className="text-right py-2 px-3">ω={w + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.iterations.map(it => (
                  <tr key={it.k} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-2 pr-4 font-mono">{it.k}</td>
                    {it.cuts.map((c, w) => (
                      <td key={w} className="py-2 px-3 text-right font-mono text-xs">
                        {c.alpha.toFixed(1)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Per-scenario cut detail */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Detail des coupes par scenario</CardTitle>
          <CardDescription>{"Coefficients β_{i,t} = ∂Q/∂x_{i,t} (gradient de la coupe)"}</CardDescription>
          <div className="flex gap-2 mt-2 flex-wrap">
            {Array.from({ length: nScenarios }, (_, w) => (
              <button
                key={w}
                onClick={() => setSelScenario(w)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  w === selScenario
                    ? "bg-chart-4 text-white"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                ω={w + 1}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 pr-4">k</th>
                  <th className="text-right py-2 px-3">α</th>
                  {TECHNOLOGIES.flatMap((t, i) =>
                    DEFAULT_PERIODS.map((y, p) => (
                      <th key={`${i}-${p}`} className="text-right py-2 px-1 whitespace-nowrap">
                        {`β_${t.slice(0, 3)},${y}`}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {scenarioCuts.map(cut => (
                  <tr key={cut.iteration} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-1.5 pr-4 font-mono">{cut.iteration}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{cut.alpha.toFixed(2)}</td>
                    {TECHNOLOGIES.flatMap((_t, i) =>
                      DEFAULT_PERIODS.map((_y, p) => (
                        <td key={`${i}-${p}`} className="py-1.5 px-1 text-right font-mono">
                          {cut.beta[i][p] !== 0
                            ? <span style={{ color: cut.beta[i][p] < 0 ? "#22c55e" : "#f97316" }}>
                                {cut.beta[i][p].toExponential(1)}
                              </span>
                            : <span className="text-muted-foreground">0</span>
                          }
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            β &lt; 0 → investir dans cette technologie reduit le cout operationnel (coupe incitative).
            β = 0 → technologie non contraignante dans ce scenario/periode.
          </p>
        </CardContent>
      </Card>

      {/* Master problem LP status */}
      <Card>
        <CardHeader>
          <CardTitle>Probleme maitre — progression des bornes inferieures</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left py-2 pr-4">k</th>
                  <th className="text-right py-2 px-4">LB (M€)</th>
                  <th className="text-right py-2 px-4">Σ θ_ω</th>
                  <th className="text-right py-2 px-4">CAPEX (M€)</th>
                  <th className="text-right py-2 pl-4">Nb coupes actives</th>
                </tr>
              </thead>
              <tbody>
                {result.iterations.map(it => {
                  const thetaSum = it.master.theta.reduce((s, v) => s + v, 0)
                  const capex = it.master.investCost
                  const nCuts = result.iterations.slice(0, it.k).reduce((s, i2) => s + i2.cuts.length, 0)
                  return (
                    <tr key={it.k} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-4 font-mono">{it.k}</td>
                      <td className="py-2 px-4 text-right font-mono" style={{ color: "#22c55e" }}>{it.LB.toFixed(1)}</td>
                      <td className="py-2 px-4 text-right font-mono">{thetaSum.toFixed(1)}</td>
                      <td className="py-2 px-4 text-right font-mono">{capex.toFixed(1)}</td>
                      <td className="py-2 pl-4 text-right font-mono">{nCuts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

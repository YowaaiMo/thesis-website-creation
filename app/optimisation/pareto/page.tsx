"use client"

import Link from "next/link"
import { useState } from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Label as RLabel
} from "recharts"
import { Play, Loader2, ScatterChart as ScatterIcon, Info } from "lucide-react"

export default function ParetoPage() {
  const { result, paretoPoints, isRunningPareto, paretoProgress, runParetoFront } = useLShaped()

  const [ghgMin, setGhgMin] = useState<number>(50)
  const [ghgMax, setGhgMax] = useState<number>(200)
  const [nPoints, setNPoints] = useState<number>(8)

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Front de Pareto</h1>
          <p className="text-muted-foreground">Methode ε-contrainte · Z₁ (coût) vs Z₂ (GES)</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Play className="h-8 w-8 mx-auto mb-4 opacity-40" />
            <p>Lancez d'abord une resolution L-Shaped pour activer le front de Pareto.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/optimisation/resolution">Resolution</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Guess GHG bounds from the unconstrained solution
  const defaultGhgMax = Math.ceil(result.totalGhg * 1.1 / 10) * 10
  const defaultGhgMin = Math.ceil(result.totalGhg * 0.4 / 10) * 10

  const scatterData = paretoPoints.map((pt, i) => ({
    x: parseFloat(pt.Z2.toFixed(2)),
    y: parseFloat(pt.Z1.toFixed(0)),
    epsilon: pt.epsilon,
    label: `ε=${pt.epsilon.toFixed(0)}`,
    idx: i,
  }))

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ScatterIcon className="h-6 w-6 text-chart-5" />
          <h1 className="text-3xl font-bold">Front de Pareto</h1>
        </div>
        <p className="text-muted-foreground">
          Methode ε-contrainte : min Z₁ (coût total M€) s.c. Z₂ (GES MtCO₂) ≤ ε<sub>j</sub>
        </p>
      </div>

      {/* Config + launch */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Point de reference (solution sans contrainte GES) : Z₁={result.totalCost.toFixed(0)} M€, Z₂={result.totalGhg.toFixed(1)} MtCO₂
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>ε_min (MtCO₂) — plus contraignant</Label>
              <Input
                type="number"
                value={ghgMin}
                onChange={e => setGhgMin(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>ε_max (MtCO₂) — moins contraignant</Label>
              <Input
                type="number"
                value={ghgMax}
                onChange={e => setGhgMax(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre de points N = {nPoints}</Label>
              <Slider
                min={3} max={15} step={1} value={[nPoints]}
                onValueChange={([v]) => setNPoints(v)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Button
              onClick={() => runParetoFront(ghgMin, ghgMax, nPoints)}
              disabled={isRunningPareto}
              className="gap-2 bg-chart-5 hover:bg-chart-5/90 text-white"
            >
              {isRunningPareto
                ? <><Loader2 className="h-4 w-4 animate-spin" />Calcul Pareto...</>
                : <><Play className="h-4 w-4" />Construire le front de Pareto</>
              }
            </Button>

            {isRunningPareto && paretoProgress && (
              <span className="text-sm text-muted-foreground">
                Point {paretoProgress.pt} / {paretoProgress.total}
              </span>
            )}

            <Button
              variant="ghost" size="sm"
              onClick={() => { setGhgMin(defaultGhgMin); setGhgMax(defaultGhgMax) }}
              className="text-muted-foreground"
            >
              Valeurs suggérées
            </Button>
          </div>

          <div className="flex gap-2 items-start p-3 bg-secondary/20 rounded-lg text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Pour chaque valeur ε<sub>j</sub> (de ε_max à ε_min), le solveur L-Shaped est relancé avec la contrainte GES.
              Temps estimé : ~{(nPoints * result.config.maxIter * 0.1).toFixed(0)}s selon le nombre de scenarios.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scatter plot */}
      {paretoPoints.length > 0 && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Front de Pareto — Coût vs GES</CardTitle>
              <CardDescription>
                {paretoPoints.length} points non-dominés · Chaque point est une solution L-Shaped optimale sous contrainte ε
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="GES"
                    domain={['auto', 'auto']}
                    label={{ value: "Émissions Z₂ (MtCO₂)", position: "insideBottom", offset: -15 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Coût"
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    label={{ value: "Coût Z₁ (M€)", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (!payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-popover border border-border rounded-lg p-3 text-sm shadow">
                          <p className="font-semibold">ε = {d.epsilon.toFixed(1)} MtCO₂</p>
                          <p style={{ color: "#f97316" }}>Z₁ = {d.y.toLocaleString()} M€</p>
                          <p style={{ color: "#16a34a" }}>Z₂ = {d.x.toFixed(2)} MtCO₂</p>
                        </div>
                      )
                    }}
                  />
                  <Scatter
                    data={scatterData}
                    fill="#6366f1"
                    line={{ stroke: "#6366f1", strokeWidth: 1.5 }}
                    lineType="fitting"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Tableau des solutions Pareto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs">
                      <th className="text-left py-2 pr-4">ε (MtCO₂)</th>
                      <th className="text-right py-2 px-4">Z₁ — Coût (M€)</th>
                      <th className="text-right py-2 px-4">Z₂ — GES (MtCO₂)</th>
                      <th className="text-right py-2 px-4">CAPEX (M€)</th>
                      <th className="text-right py-2 pl-4">Coût op. (M€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paretoPoints.map((pt, idx) => (
                      <tr key={idx} className="border-b border-border/40 hover:bg-secondary/10">
                        <td className="py-2 pr-4 font-mono">{pt.epsilon.toFixed(1)}</td>
                        <td className="py-2 px-4 text-right font-mono font-semibold" style={{ color: "#f97316" }}>{pt.Z1.toFixed(0)}</td>
                        <td className="py-2 px-4 text-right font-mono" style={{ color: "#16a34a" }}>{pt.Z2.toFixed(2)}</td>
                        <td className="py-2 px-4 text-right font-mono">{pt.solution.investCost.toFixed(0)}</td>
                        <td className="py-2 pl-4 text-right font-mono">{(pt.Z1 - pt.solution.investCost).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!isRunningPareto && paretoPoints.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ScatterIcon className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>Configurez les bornes ε et lancez le calcul du front de Pareto.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

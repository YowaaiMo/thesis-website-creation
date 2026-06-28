"use client"

import { useState } from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"
import { Play, Loader2, AlertCircle, Info } from "lucide-react"
import Link from "next/link"
import type { ParetoPoint } from "@/lib/lshaped/types"

function remarkableSolutions(pts: ParetoPoint[]): {
  A: ParetoPoint & { idx: number }
  B: ParetoPoint & { idx: number }
  C: ParetoPoint & { idx: number }
} | null {
  if (pts.length < 2) return null
  const idxA = pts.reduce((best, pt, i) => pt.Z1 < pts[best].Z1 ? i : best, 0)
  const idxB = pts.reduce((best, pt, i) => pt.Z2 < pts[best].Z2 ? i : best, 0)

  // C = closest to ideal point (normalized Euclidean distance)
  const z1Min = pts[idxA].Z1; const z1Max = pts.reduce((m, p) => Math.max(m, p.Z1), 0)
  const z2Min = pts[idxB].Z2; const z2Max = pts.reduce((m, p) => Math.max(m, p.Z2), 0)
  const idxC = pts.reduce((best, pt, i) => {
    const dBest = Math.sqrt(((pts[best].Z1 - z1Min) / (z1Max - z1Min + 1e-9)) ** 2 + ((pts[best].Z2 - z2Min) / (z2Max - z2Min + 1e-9)) ** 2)
    const dCurr = Math.sqrt(((pt.Z1 - z1Min) / (z1Max - z1Min + 1e-9)) ** 2 + ((pt.Z2 - z2Min) / (z2Max - z2Min + 1e-9)) ** 2)
    return dCurr < dBest ? i : best
  }, 0)

  return {
    A: { ...pts[idxA], idx: idxA },
    B: { ...pts[idxB], idx: idxB },
    C: { ...pts[idxC], idx: idxC },
  }
}

export default function ParetoPage() {
  const { result, paretoPoints, isRunningPareto, paretoProgress, runParetoFront } = useLShaped()

  // null = not yet customised → effective value falls back to suggestedMin/Max below
  const [customGhgMin, setCustomGhgMin] = useState<number | null>(null)
  const [customGhgMax, setCustomGhgMax] = useState<number | null>(null)
  const [nPoints, setNPoints] = useState(8)

  if (!result) return (
    <div className="max-w-5xl mx-auto">
      <div className="p-6 rounded-lg border border-yellow-500/40 bg-yellow-500/5 flex gap-3">
        <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
        <p className="text-sm">
          Aucun résultat disponible. Lancez d'abord une résolution depuis{" "}
          <Link href="/optimisation/resolution" className="underline text-chart-4">l'onglet 1</Link>.
        </p>
      </div>
    </div>
  )

  const ndcThreshold = result.config.ndcThreshold
  // Only truly feasible points appear in the chart and A/B/C selection.
  // Both 'infeasible' (LP structurally infeasible, Z1=∞) and 'rejected'
  // (LP converged but post-check: E[Z₂] > ε × 1.005) are excluded.
  const feasiblePoints  = paretoPoints.filter(p => p.feasible !== false)
  const infeasiblePoints = paretoPoints.filter(p => p.feasible === false && !p.rejected)
  const rejectedPoints  = paretoPoints.filter(p => p.feasible === false && p.rejected)
  const infeasibleCount = infeasiblePoints.length
  const rejectedCount   = rejectedPoints.length
  const scattered = feasiblePoints.map(pt => ({
    x: pt.Z2, y: pt.Z1, epsilon: pt.epsilon,
    isNdc: Math.abs(pt.epsilon - ndcThreshold) < 1,
  }))
  const remarkables = remarkableSolutions(feasiblePoints)
  // Suggested bounds derived from the unconstrained solution:
  //   min = 40 % of Z₂_ref (ambitious but keeps most solutions feasible)
  //   max = 110 % of Z₂_ref (slightly above the reference, baseline included)
  const suggestedMin = Math.ceil(result.totalGhg * 0.4 / 10) * 10
  const suggestedMax = Math.ceil(result.totalGhg * 1.1 / 10) * 10

  // Effective bounds: custom value if user edited a field, suggested otherwise.
  // This initialises the fields correctly on first open without an extra click.
  const ghgMin = customGhgMin ?? suggestedMin
  const ghgMax = customGhgMax ?? suggestedMax
  const hasCustomBounds = customGhgMin !== null || customGhgMax !== null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Onglet 9 — Analyse Pareto bi-objectif</h1>
        <p className="text-sm text-muted-foreground">
          Méthode ε-contrainte : min Z₁ s.c. E[Z₂] ≤ ε_j — contrainte sur l'espérance (non par scénario)
        </p>
      </div>

      {/* Configuration Pareto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Configuration du front de Pareto
          </CardTitle>
          <CardDescription>
            Point de référence (sans contrainte GES) : Z₁ = {result.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€ · Z₂ = {result.totalGhg.toFixed(2)} MtCO₂
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label>ε_min (MtCO₂) — plus contraignant</Label>
              <Input type="number" value={ghgMin} onChange={e => setCustomGhgMin(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>ε_max (MtCO₂) — moins contraignant</Label>
              <Input type="number" value={ghgMax} onChange={e => setCustomGhgMax(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Points N = {nPoints}</Label>
              <Slider min={3} max={15} step={1} value={[nPoints]} onValueChange={([v]) => setNPoints(v)} />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={() => runParetoFront(ghgMin, ghgMax, nPoints)}
              disabled={isRunningPareto}
              className="gap-2 bg-chart-5 hover:bg-chart-5/90 text-white">
              {isRunningPareto
                ? <><Loader2 className="h-4 w-4 animate-spin" />Calcul Pareto ({paretoProgress?.pt ?? 0}/{paretoProgress?.total ?? nPoints})…</>
                : <><Play className="h-4 w-4" />Construire le front de Pareto</>}
            </Button>
            {hasCustomBounds && (
              <Button variant="ghost" size="sm"
                onClick={() => { setCustomGhgMin(null); setCustomGhgMax(null) }}
                className="text-muted-foreground">
                Réinitialiser les bornes
              </Button>
            )}
          </div>

          <div className="mt-3 flex gap-2 p-3 bg-secondary/20 rounded-lg text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Méthode ε-contrainte (Mavrotas 2009) : min Z₁ s.c. E[Z₂] ≤ ε_j, résolu par L-Shaped étendu avec coupes GES.
              Vérification post-convergence : E[Z₂] calculé sur les scénarios LHS — rejet si E[Z₂] &gt; ε × 1,005 (tolérance 0,5 %).
              Temps estimé ≈ {(nPoints * result.config.maxIter * 0.15).toFixed(0)} s.
            </span>
          </div>
        </CardContent>
      </Card>

      {paretoPoints.length === 0 && !isRunningPareto && (
        <div className="p-8 text-center text-muted-foreground text-sm border border-border rounded-xl">
          Configurez les bornes ε et lancez le calcul pour afficher le front de Pareto.
        </div>
      )}

      {paretoPoints.length > 0 && (
        <>
          {/* Infeasibility / rejection notice */}
          {(infeasibleCount > 0 || rejectedCount > 0) && (
            <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/5 flex gap-3 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                {infeasibleCount > 0 && (
                  <p>
                    <strong>{infeasibleCount} point{infeasibleCount > 1 ? 's' : ''} infaisable{infeasibleCount > 1 ? 's' : ''}</strong> :
                    ε inférieur au minimum d'émissions physiquement atteignable (≈ 1 425 MtCO₂).
                    Le LP maître n'a pas trouvé de solution.
                  </p>
                )}
                {rejectedCount > 0 && (
                  <p>
                    <strong>{rejectedCount} point{rejectedCount > 1 ? 's' : ''} rejeté{rejectedCount > 1 ? 's' : ''}</strong> :
                    le solveur a convergé mais la vérification post-convergence montre E[Z₂] &gt; ε × 1,005 (tolérance 0,5 %).
                    Cause : non-concavité de Z₂ en capacité fossile au voisinage de la transition déficit/couverture complète.
                    Ces points sont exclus du graphe et du calcul A/B/C, mais leurs valeurs réelles Z₁ et Z₂ sont affichées ci-dessous.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Figure 6.14 — Pareto scatter */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Figure 6.14 — Front de Pareto Z₁ vs Z₂ ({feasiblePoints.length} solutions faisables)
              </CardTitle>
              <CardDescription>Chaque point = une résolution L-Shaped sous contrainte ε_j</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <ScatterChart margin={{ top: 20, right: 30, bottom: 35, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis type="number" dataKey="x" name="Z₂ (MtCO₂)"
                    domain={["auto", "auto"]}
                    label={{ value: "Émissions Z₂ (MtCO₂)", position: "insideBottom", offset: -20, fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" name="Z₁ (M€)"
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    label={{ value: "Coût Z₁ (M€)", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <ReferenceLine
                    x={ndcThreshold}
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    label={{ value: `NDC = ${ndcThreshold} MtCO₂`, position: "insideTopRight", fontSize: 10, fill: "#ef4444" }}
                  />
                  <Tooltip content={({ payload }) => {
                    if (!payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-popover border border-border rounded-lg p-3 text-sm shadow">
                        <p className="font-semibold">
                          ε = {d.epsilon.toFixed(1)} MtCO₂
                          {d.isNdc && <span className="ml-2 text-xs font-bold text-red-500">◀ NDC</span>}
                        </p>
                        <p style={{ color: "#f97316" }}>Z₁ = {d.y.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€</p>
                        <p style={{ color: "#16a34a" }}>Z₂ = {d.x.toFixed(2)} MtCO₂</p>
                      </div>
                    )
                  }} />
                  <Scatter data={scattered} fill="#6366f1"
                    line={{ stroke: "#6366f1", strokeWidth: 1.5 }} lineType="fitting" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table 6.24 — Solutions A, B, C */}
          {remarkables && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Table 6.24 — Solutions remarquables du front de Pareto
                </CardTitle>
                <CardDescription>
                  A = min coût · B = min émissions · C = compromis (plus proche du point idéal en distance normalisée)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-4">Solution</th>
                        <th className="text-right py-2 px-4">ε (MtCO₂)</th>
                        <th className="text-right py-2 px-4">Z₁ — Coût (M€)</th>
                        <th className="text-right py-2 px-4">Z₂ — GES (MtCO₂)</th>
                        <th className="text-right py-2 px-4">CAPEX (M€)</th>
                        <th className="text-right py-2 pl-4">OPEX + λ_D·u (M€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: "A", label: "Solution A — Coût minimal", pt: remarkables.A, color: "#f97316" },
                        { key: "B", label: "Solution B — Émissions minimales", pt: remarkables.B, color: "#22c55e" },
                        { key: "C", label: "Solution C — Compromis (Pareto optimal)", pt: remarkables.C, color: "#6366f1" },
                      ].map(({ key, label, pt, color }) => (
                        <tr key={key} className="border-b border-border/40 hover:bg-secondary/10">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: color }}>{key}</span>
                              <span className="text-xs">{label}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono">{pt.epsilon.toFixed(1)}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold" style={{ color: "#f97316" }}>
                            {pt.Z1.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold" style={{ color: "#22c55e" }}>
                            {pt.Z2.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {pt.solution.investCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 pl-4 text-right font-mono">
                            {(pt.Z1 - pt.solution.investCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Auto-analysis */}
                <div className="mt-4 p-4 bg-secondary/20 rounded-xl text-sm text-foreground/90">
                  <p className="font-semibold mb-2">Analyse automatique :</p>
                  <ul className="space-y-1.5 text-sm">
                    <li>• Solution A (coût min, Z₁ = {remarkables.A.Z1.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€) : {((remarkables.A.Z2 - remarkables.B.Z2) / remarkables.B.Z2 * 100).toFixed(0)} % d'émissions supplémentaires vs B.</li>
                    <li>• Solution B (émissions min, Z₂ = {remarkables.B.Z2.toFixed(2)} MtCO₂) : coût supérieur de {((remarkables.B.Z1 - remarkables.A.Z1) / remarkables.A.Z1 * 100).toFixed(0)} % vs A.</li>
                    <li>• Solution C (compromis) : Z₁ = {remarkables.C.Z1.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€, Z₂ = {remarkables.C.Z2.toFixed(2)} MtCO₂ — meilleur équilibre coût-émissions en distance normalisée.</li>
                    <li>• Taux d'échange marginal (A→B) ≈ {Math.abs((remarkables.B.Z1 - remarkables.A.Z1) / ((remarkables.A.Z2 - remarkables.B.Z2) + 1e-9)).toLocaleString(undefined, { maximumFractionDigits: 0 })} M€ / MtCO₂ évitée.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Tableau complet des points Pareto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-4">N°</th>
                      <th className="text-right py-2 px-4">ε (MtCO₂)</th>
                      <th className="text-right py-2 px-4">Z₁ (M€)</th>
                      <th className="text-right py-2 px-4">Z₂ (MtCO₂)</th>
                      <th className="text-right py-2 px-4">CAPEX (M€)</th>
                      <th className="text-right py-2 px-4">OPEX + λ_D·u (M€)</th>
                      <th className="text-left py-2 pl-4">Remarque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paretoPoints.map((pt, i) => {
                      const fIdx = feasiblePoints.indexOf(pt)
                      const isA = remarkables && fIdx >= 0 && remarkables.A.idx === fIdx
                      const isB = remarkables && fIdx >= 0 && remarkables.B.idx === fIdx
                      const isC = remarkables && fIdx >= 0 && remarkables.C.idx === fIdx
                      const isNdc       = Math.abs(pt.epsilon - ndcThreshold) < 1
                      const isInfeasible = pt.feasible === false && !pt.rejected  // LP structurally infeasible
                      const isRejected   = pt.feasible === false && !!pt.rejected // post-check violation
                      const isExcluded   = isInfeasible || isRejected
                      // Rejected points keep real Z1/Z2 values (show them); infeasible points have ∞
                      return (
                        <tr key={i} className={`border-b border-border/40 hover:bg-secondary/10 ${isNdc && !isExcluded ? "bg-red-500/5" : ""} ${isExcluded ? "opacity-50" : ""}`}>
                          <td className="py-2 pr-4 font-mono">{i + 1}</td>
                          <td className="py-2 px-4 text-right font-mono">
                            {pt.epsilon.toFixed(1)}
                            {isNdc && !isExcluded && <span className="ml-1 text-[10px] font-bold text-red-500">NDC</span>}
                          </td>
                          <td className="py-2 px-4 text-right font-mono" style={{ color: isExcluded ? undefined : "#f97316" }}>
                            {isInfeasible ? "—" : pt.Z1.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2 px-4 text-right font-mono" style={{ color: isExcluded ? undefined : "#22c55e" }}>
                            {isInfeasible ? "—" : (
                              <>
                                {pt.Z2.toFixed(2)}
                                {isRejected && (
                                  <span className="ml-1 text-[10px] text-red-400" title={`Violation : Z₂ = ${pt.Z2.toFixed(2)} > ε = ${pt.epsilon.toFixed(2)}`}>
                                    ▲ {((pt.Z2 / pt.epsilon - 1) * 100).toFixed(2)} %
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="py-2 px-4 text-right font-mono">
                            {isInfeasible ? "—" : pt.capex.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-muted-foreground">
                            {isInfeasible ? "—" : pt.opex.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2 pl-4 text-xs">
                            {isInfeasible && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 font-bold">Infaisable</span>}
                            {isRejected   && <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-600 font-bold" title="E[Z₂] &gt; ε — vérification post-convergence">Rejeté Z₂&gt;ε</span>}
                            {isA && <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-500 font-bold mr-1">A</span>}
                            {isB && <span className="px-2 py-0.5 rounded bg-chart-2/20 text-chart-2 font-bold mr-1">B</span>}
                            {isC && <span className="px-2 py-0.5 rounded bg-chart-5/20 text-chart-5 font-bold mr-1">C</span>}
                            {isNdc && !isInfeasible && <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-500 font-bold">NDC</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

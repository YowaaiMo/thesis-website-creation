"use client"

import { useState } from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { TECHNOLOGIES, DEFAULT_PERIODS } from "@/lib/lshaped/types"
import Link from "next/link"

export default function CoupesPage() {
  const { result } = useLShaped()
  const [selectedIter, setSelectedIter] = useState<number | null>(null)

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

  const lastIter = result.iterations[result.iterations.length - 1]
  const activeIt = selectedIter !== null
    ? result.iterations[selectedIter - 1]
    : lastIter
  const allCuts = result.iterations.flatMap(it => it.cuts)
  const scenarios = result.scenarios  // local alias — TypeScript closure narrowing workaround

  function formatCutEquation(w: number): string {
    const sr = activeIt?.subproblems[w]
    if (!sr) return "—"
    const alpha = sr.cut.alpha
    const terms: string[] = []
    TECHNOLOGIES.forEach((tech, i) => {
      DEFAULT_PERIODS.forEach((yr, t) => {
        const b = sr.cut.beta[i]?.[t] ?? 0
        if (Math.abs(b) > 1e-6) {
          const sign = b < 0 ? " − " : " + "
          terms.push(`${sign}${Math.abs(b).toFixed(3)}·x_{${tech},${yr}}`)
        }
      })
    })
    return `θ_{ω${w + 1}} ≥ ${alpha.toLocaleString(undefined, { maximumFractionDigits: 0 })}${terms.slice(0, 5).join("")}${terms.length > 5 ? " + …" : ""}`
  }

  function interpDualAnalysis(): string {
    const subs = lastIter.subproblems
    const avgPiDem = subs.reduce((s, sr, w) => s + scenarios[w].prob * (sr.periods[0]?.shadowDemand ?? 0), 0)
    const pvPi = subs.reduce((s, sr, w) => s + scenarios[w].prob * Math.abs(sr.periods[0]?.shadowCap[0] ?? 0), 0)
    const windPi = subs.reduce((s, sr, w) => s + scenarios[w].prob * Math.abs(sr.periods[0]?.shadowCap[1] ?? 0), 0)
    const batPi = subs.reduce((s, sr, w) => s + scenarios[w].prob * Math.abs(sr.periods[0]?.shadowCap[6] ?? 0), 0)
    const dom = pvPi > windPi && pvPi > batPi ? "PV" : windPi > batPi ? "Éolien" : "Batterie"
    return `π_Dem ≈ ${avgPiDem.toFixed(3)} M€/ktep (coût marginal demande). Contrainte la plus active en τ=2024 : ${dom} (duale la plus élevée). Investir dans ${dom} offrirait le plus grand gain d'efficacité à la première période.`
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Onglet 5 — Variables duales et coupes de Benders</h1>
        <p className="text-sm text-muted-foreground">
          {allCuts.length} coupes d'optimalité · Multicoupe : une coupe par scénario par itération
        </p>
      </div>

      {/* Table 6.15 — Variables duales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.15 — Variables duales π^ω_τ (itération k = {lastIter.k})
          </CardTitle>
          <CardDescription>
            π_Dem : valeur duale contrainte de demande · π_i : valeur duale contrainte de capacité
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">ω</th>
                  <th className="text-right py-2 px-3">π_Dem (τ₁)</th>
                  <th className="text-right py-2 px-3">π_PV (τ₁)</th>
                  <th className="text-right py-2 px-3">π_Wind (τ₁)</th>
                  <th className="text-right py-2 px-3">π_Gaz (τ₁)</th>
                  <th className="text-right py-2 px-3">π_Bat (τ₁)</th>
                </tr>
              </thead>
              <tbody>
                {lastIter.subproblems.map((sr, w) => (
                  <tr key={w} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-2 pr-4 font-medium">ω{w + 1}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs text-chart-4">
                      {(sr.periods[0]?.shadowDemand ?? 0).toFixed(4)}
                    </td>
                    {[0, 1, 2, 6].map(i => {
                      const v = sr.periods[0]?.shadowCap[i] ?? 0
                      return (
                        <td key={i} className={`py-2 px-3 text-right font-mono text-xs ${Math.abs(v) > 1e-6 ? "font-semibold text-chart-4" : "text-muted-foreground"}`}>
                          {Math.abs(v) > 1e-6 ? v.toFixed(4) : "—"}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-3 bg-secondary/20 rounded-lg text-xs text-muted-foreground">
            {interpDualAnalysis()}
          </div>
        </CardContent>
      </Card>

      {/* Table 6.16 — Coefficients de coupe + formule */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.16 — Coefficients de la coupe d'optimalité (itération k = {activeIt?.k ?? "—"})
          </CardTitle>
          <CardDescription>
            θ_ω ≥ α^k_ω + (β^k_ω)ᵀ x — multicoupe de Benders, une coupe par scénario ω
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Iteration selector */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {result.iterations.map(it => (
              <button key={it.k}
                onClick={() => setSelectedIter(it.k)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  (activeIt?.k) === it.k
                    ? "bg-chart-4 text-white border-chart-4"
                    : "border-border hover:border-chart-4 text-muted-foreground"
                }`}
              >
                k = {it.k}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">ω</th>
                  <th className="text-right py-2 px-3">α^k_ω (M€)</th>
                  <th className="text-right py-2 px-3">β_PV (τ₁)</th>
                  <th className="text-right py-2 px-3">β_Wind (τ₁)</th>
                  <th className="text-right py-2 px-3">β_Gaz (τ₁)</th>
                  <th className="text-right py-2 px-3">β_Bat (τ₁)</th>
                  <th className="text-right py-2 px-3">‖β‖₁</th>
                </tr>
              </thead>
              <tbody>
                {activeIt?.subproblems.map((sr, w) => {
                  const normBeta = sr.cut.beta.flat().reduce((s, b) => s + Math.abs(b), 0)
                  return (
                    <tr key={w} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-4 font-medium">ω{w + 1}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs text-chart-2 font-semibold">
                        {sr.cut.alpha.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      {[0, 1, 2, 6].map(i => {
                        const b = sr.cut.beta[i]?.[0] ?? 0
                        return (
                          <td key={i} className={`py-2 px-3 text-right font-mono text-xs ${b < -1e-6 ? "text-chart-2" : b > 1e-6 ? "text-chart-1" : "text-muted-foreground"}`}>
                            {Math.abs(b) > 1e-6 ? b.toFixed(4) : "—"}
                          </td>
                        )
                      })}
                      <td className="py-2 px-3 text-right font-mono text-xs">{normBeta.toFixed(3)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Formule complète */}
          <div className="mt-4 p-4 bg-secondary/10 rounded-xl overflow-x-auto">
            <p className="text-xs text-muted-foreground mb-1">Exemple — ω₁, k = {activeIt?.k} :</p>
            <p className="font-mono text-xs text-foreground leading-relaxed">{formatCutEquation(0)}</p>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            β &lt; 0 → investir dans cette technologie réduit le coût de recours (coupe incitative).
            β &gt; 0 → rare (peut indiquer une interaction de capacité).
          </p>
        </CardContent>
      </Card>

      {/* Table 6.17 — Historique coupes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.17 — Historique complet des coupes
          </CardTitle>
          <CardDescription>{allCuts.length} coupes · Type : Optimalité (décomposition de Benders)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Iter. k</th>
                  <th className="text-right py-2 px-4">Scénario ω</th>
                  <th className="text-right py-2 px-4">α^k_ω (M€)</th>
                  <th className="text-right py-2 px-4">‖β‖₁</th>
                  <th className="text-left py-2 pl-4">Type</th>
                </tr>
              </thead>
              <tbody>
                {allCuts.map((c, idx) => {
                  const normBeta = c.beta.flat().reduce((s, b) => s + Math.abs(b), 0)
                  return (
                    <tr key={idx} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-1.5 pr-4 font-medium">{c.iteration}</td>
                      <td className="py-1.5 px-4 text-right">ω{c.scenarioIdx + 1}</td>
                      <td className="py-1.5 px-4 text-right font-mono text-xs text-chart-2">
                        {c.alpha.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-1.5 px-4 text-right font-mono text-xs">{normBeta.toFixed(3)}</td>
                      <td className="py-1.5 pl-4 text-xs">
                        <span className="px-2 py-0.5 rounded bg-chart-4/20 text-chart-4 font-medium">Optimalité</span>
                      </td>
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

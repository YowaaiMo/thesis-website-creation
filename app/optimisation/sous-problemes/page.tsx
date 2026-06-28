"use client"

import { useState } from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, ChevronLeft } from "lucide-react"
import { TECHNOLOGIES, DEFAULT_PERIODS, BATTERY_ROUND_TRIP_EFF } from "@/lib/lshaped/types"
import Link from "next/link"

const TECH_COLORS: Record<string, string> = {
  PV: "#fbbf24", Wind: "#06b6d4", Gaz: "#3b82f6",
  Pétrole: "#dc2626", GPL: "#16a34a", Condensat: "#f59e0b", Batterie: "#8b5cf6",
}

const PERIOD_YEARS = DEFAULT_PERIODS as readonly number[]
const SPANS = [6, 6, 6, 6, 3] as const

// Linear interpolation of 5-period values to 27 annual values (2024–2050)
function toAnnual(vals: number[]): { year: number; value: number }[] {
  return Array.from({ length: 27 }, (_, i) => {
    const y = 2024 + i
    let p = 4
    for (let j = 0; j < 4; j++) {
      if (y >= PERIOD_YEARS[j] && y < PERIOD_YEARS[j + 1]) { p = j; break }
    }
    if (p < 4) {
      const t = (y - PERIOD_YEARS[p]) / SPANS[p]
      return { year: y, value: (1 - t) * vals[p] + t * vals[p + 1] }
    }
    return { year: y, value: vals[4] }
  })
}

export default function SousProblemesoPage() {
  const { result } = useLShaped()
  const [selectedOmega, setSelectedOmega] = useState<number | null>(null)

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
  const subproblems = lastIter.subproblems
  const scenarios = result.scenarios

  if (selectedOmega !== null) {
    const sr = subproblems[selectedOmega]
    const annualDeficit = toAnnual(sr.periods.map(p => p.deficit))
    const scenarioDeficit = sr.periods.reduce((s, p) => s + p.deficit, 0)

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedOmega(null)} className="gap-1">
            <ChevronLeft className="h-4 w-4" />Retour
          </Button>
          <div>
            <h1 className="text-xl font-bold">Scénario ω{selectedOmega + 1} — Détail sous-problème</h1>
            <p className="text-sm text-muted-foreground">
              p_ω = {scenarios[selectedOmega]?.prob?.toFixed(4)} · Statut :{" "}
              {scenarioDeficit > 0
                ? <span className="text-amber-600 font-semibold">Optimal (déficit pénalisé λ_D)</span>
                : <span className="text-chart-2 font-semibold">Optimal</span>}
            </p>
          </div>
        </div>

        {scenarioDeficit > 0 && (
          <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/5 flex gap-3 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <span>
              Ce scénario présente un déficit total de{" "}
              <strong>{scenarioDeficit.toLocaleString(undefined, { maximumFractionDigits: 0 })} ktep</strong>.
              La solution est néanmoins <strong>optimale au sens du modèle</strong> : pour les périodes
              déficitaires, le solveur a jugé économiquement préférable d'accepter la pénalité
              λ_D = {result.config.lambdaD} M€/ktep plutôt que d'investir dans des capacités supplémentaires
              peu sollicitées sur l'horizon de planification.
              Ce résultat traduit un arbitrage coût-fiabilité explicite, non une impossibilité physique.
            </span>
          </div>
        )}

        {/* Table 6.11 — Production par technologie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {"Table 6.11 — Production y^ω_{i,τ} par technologie et période"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">Technologie</th>
                    {DEFAULT_PERIODS.map(yr => <th key={yr} className="text-right py-2 px-4">τ = {yr}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {TECHNOLOGIES.map((tech, i) => (
                    <tr key={tech} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-4 font-medium" style={{ color: TECH_COLORS[tech] }}>{tech}</td>
                      {sr.periods.map((p, t) => (
                        <td key={t} className="py-2 px-4 text-right font-mono text-xs">
                          {(p.production[i] ?? 0) > 0.5
                            ? (p.production[i] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-border">
                    <td className="py-2 pr-4 font-semibold text-chart-1">Déficit u^ω_τ</td>
                    {sr.periods.map((p, t) => (
                      <td key={t} className={`py-2 px-4 text-right font-mono text-xs font-bold ${p.deficit > 0 ? "text-chart-1" : "text-muted-foreground"}`}>
                        {p.deficit > 0 ? p.deficit.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Table 6.12 — Stockage batterie (Level B) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Table 6.12 — Variables de stockage batterie (estimations Level B)
            </CardTitle>
            <CardDescription>
              Décharge ≈ y_Bat · Charge ≈ y_Bat / η_rt · SoC final ≈ 0 (horizon pluriannuel)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">Variable</th>
                    {DEFAULT_PERIODS.map(yr => <th key={yr} className="text-right py-2 px-4">τ = {yr}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Décharge q^{d,ω}_τ",   vals: sr.periods.map(p => p.production[6] ?? 0) },
                    { label: "Charge q^{c,ω}_τ",      vals: sr.periods.map(p => (p.production[6] ?? 0) / BATTERY_ROUND_TRIP_EFF) },
                    { label: "SoC final (estimé)",    vals: sr.periods.map(() => 0) },
                  ].map(row => (
                    <tr key={row.label} className="border-b border-border/40">
                      <td className="py-2 pr-4 font-mono text-xs">{row.label}</td>
                      {row.vals.map((v, t) => (
                        <td key={t} className="py-2 px-4 text-right font-mono text-xs">
                          {v > 0.1 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Modèle Level B — η_rt = {BATTERY_ROUND_TRIP_EFF} · SoC non modélisé explicitement au niveau de la planification
            </p>
          </CardContent>
        </Card>

        {/* Table 6.13 — Déficit annuel 27 ans */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Table 6.13 — Déficit annuel u^ω_t (2024–2050) — 27 années
            </CardTitle>
            <CardDescription>Interpolation linéaire des 5 périodes repr. vers l'horizon annuel complet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-6">Année t</th>
                    <th className="text-right py-2 px-4">u^ω_t (ktep/an)</th>
                    <th className="text-left py-2 pl-4">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {annualDeficit.map(({ year, value }) => (
                    <tr key={year} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-1.5 pr-6 font-medium">{year}</td>
                      <td className={`py-1.5 px-4 text-right font-mono text-xs ${value > 0.5 ? "text-chart-1 font-semibold" : "text-muted-foreground"}`}>
                        {value > 0.5 ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
                      </td>
                      <td className="py-1.5 pl-4 text-xs">
                        {value > 1 ? "⚠ Déficit" : <span className="text-chart-2">✓ Équilibré</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Table 6.14 — Contraintes actives */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Table 6.14 — Contraintes actives (π &gt; 0)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-6">Contrainte (variable duale)</th>
                    {DEFAULT_PERIODS.map(yr => <th key={yr} className="text-right py-2 px-4">τ = {yr}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "π_Dem (demande)", vals: sr.periods.map(p => p.shadowDemand) },
                    ...TECHNOLOGIES.map((tech, i) => ({
                      label: `π_${tech}`,
                      vals: sr.periods.map(p => p.shadowCap[i] ?? 0),
                    })),
                  ].map(row => (
                    <tr key={row.label} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-6 font-mono text-xs">{row.label}</td>
                      {row.vals.map((v, t) => (
                        <td key={t} className={`py-2 px-4 text-right font-mono text-xs ${Math.abs(v) > 1e-6 ? "font-bold text-chart-4" : "text-muted-foreground"}`}>
                          {Math.abs(v) > 1e-6 ? v.toFixed(4) : "—"}
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

  // Table 6.10 — All scenarios summary
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Onglet 4 — Sous-problèmes de dispatche</h1>
        <p className="text-sm text-muted-foreground">
          Table 6.10 — {subproblems.length} scénarios · Itération finale k = {lastIter.k} · Cliquez sur une ligne pour le détail
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.10 — Résultats des sous-problèmes par scénario (k = {lastIter.k})
          </CardTitle>
          <CardDescription>
            Dispatch optimal merit-order (KKT) pour la capacité x* fixée. Vert = Optimal sans déficit · Ambré = Optimal (λ_D) = optimum du modèle pénalisé, déficit économiquement préféré à l'investissement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Scénario ω</th>
                  <th className="text-right py-2 px-4">Prob. p_ω</th>
                  <th className="text-right py-2 px-4">Coût op. Q^ω (M€)</th>
                  <th className="text-right py-2 px-4">Déficit total (ktep)</th>
                  <th className="text-right py-2 px-4">GES (MtCO₂)</th>
                  <th className="text-right py-2 px-4">Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subproblems.map((sr, w) => {
                  const def = sr.periods.reduce((s, p) => s + p.deficit, 0)
                  return (
                    <tr key={w} className="border-b border-border/40 hover:bg-secondary/10 cursor-pointer"
                      onClick={() => setSelectedOmega(w)}>
                      <td className="py-2 pr-4 font-medium">ω{w + 1}</td>
                      <td className="py-2 px-4 text-right font-mono text-xs">{scenarios[w].prob.toFixed(4)}</td>
                      <td className="py-2 px-4 text-right font-mono">{sr.totalOpCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className={`py-2 px-4 text-right font-mono ${def > 0 ? "text-chart-1 font-semibold" : "text-muted-foreground"}`}>
                        {def > 0 ? def.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                      </td>
                      <td className="py-2 px-4 text-right font-mono">{sr.totalGhg.toFixed(3)}</td>
                      <td className="py-2 px-4 text-right">
                        {def > 0
                          ? <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 font-medium" title="Optimum du modèle pénalisé — déficit accepté par arbitrage économique">Optimal (λ_D)</span>
                          : <span className="text-xs px-2 py-0.5 rounded bg-chart-2/20 text-chart-2 font-medium">Optimal</span>}
                      </td>
                      <td className="py-2 pl-2 text-chart-4 text-xs">→</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-secondary/10 font-semibold text-sm">
                <tr>
                  <td className="py-2 pr-4">E[·] pondéré</td>
                  <td className="py-2 px-4 text-right font-mono text-xs">1.0000</td>
                  <td className="py-2 px-4 text-right font-mono">
                    {subproblems.reduce((s, sr, w) => s + scenarios[w].prob * sr.totalOpCost, 0)
                      .toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 px-4 text-right font-mono">
                    {subproblems.reduce((s, sr, w) => s + scenarios[w].prob * sr.periods.reduce((a, p) => a + p.deficit, 0), 0)
                      .toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 px-4 text-right font-mono">
                    {subproblems.reduce((s, sr, w) => s + scenarios[w].prob * sr.totalGhg, 0).toFixed(3)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

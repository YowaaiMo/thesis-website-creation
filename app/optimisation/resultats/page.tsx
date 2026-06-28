"use client"

import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, XCircle, Download, FileText, Printer } from "lucide-react"
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts"
import {
  TECHNOLOGIES, DEFAULT_PERIODS, INITIAL_CAPACITY, DEFAULT_PERIOD_SPANS,
} from "@/lib/lshaped/types"
import Link from "next/link"

const TECH_COLORS: Record<string, string> = {
  PV: "#fbbf24", Wind: "#06b6d4", Gaz: "#3b82f6",
  Pétrole: "#dc2626", GPL: "#16a34a", Condensat: "#f59e0b", Batterie: "#8b5cf6",
}

function exportCSV(result: NonNullable<ReturnType<typeof useLShaped>["result"]>) {
  const rows = [["Section", "Variable", "Période", "Valeur", "Unité"]]
  TECHNOLOGIES.forEach((t, i) => {
    DEFAULT_PERIODS.forEach((yr, p) => {
      rows.push(["Δx", t, yr.toString(), result.finalSolution.deltaX[i][p].toFixed(2), "unité/an"])
      rows.push(["x cumulatif", t, yr.toString(), result.finalSolution.cumX[i][p].toFixed(2), "unité/an"])
    })
  })
  rows.push(["Objectifs", "Z1 coût", "2024-2050", result.totalCost.toFixed(0), "M€"])
  rows.push(["Objectifs", "Z2 GES", "2024-2050", result.totalGhg.toFixed(2), "MtCO₂"])
  const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n")
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: "resultats_lshaped.csv",
  })
  a.click()
}

function exportJSON(result: NonNullable<ReturnType<typeof useLShaped>["result"]>) {
  const data = {
    status: result.status, finalGap: result.finalGap, totalCost: result.totalCost,
    totalGhg: result.totalGhg, investCost: result.finalSolution.investCost,
    opCost: result.totalCost - result.finalSolution.investCost,
    iterations: result.iterations.length,
    finalSolution: { deltaX: result.finalSolution.deltaX, cumX: result.finalSolution.cumX },
  }
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })),
    download: "resultats_lshaped.json",
  })
  a.click()
}

export default function ResultatsPage() {
  const { result, config } = useLShaped()

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

  const { finalSolution, totalCost, totalGhg } = result
  const lastIter = result.iterations[result.iterations.length - 1]
  const opCost = totalCost - finalSolution.investCost
  const deficitPenalty = lastIter.subproblems.reduce((s, sr, w) => {
    return s + result.scenarios[w].prob * sr.periods.reduce((a, p) => a + p.deficit, 0)
  }, 0) * config.lambdaD
  const pureOpCost = opCost - deficitPenalty
  const ndcOk = totalGhg <= config.ndcThreshold

  // Table 6.20 — Capacités finales 2050 (period index 4)
  const final2050 = TECHNOLOGIES.map((t, i) => ({
    tech: t,
    x0: INITIAL_CAPACITY[t],
    xFinal: finalSolution.cumX[i]?.[4] ?? INITIAL_CAPACITY[t],
    dx: (finalSolution.cumX[i]?.[4] ?? INITIAL_CAPACITY[t]) - INITIAL_CAPACITY[t],
  }))

  // Table 6.21 — Investissements cumulés
  const cumInvest = TECHNOLOGIES.map((t, i) => ({
    tech: t,
    total: finalSolution.deltaX[i]?.reduce((s, d) => s + d, 0) ?? 0,
    byPeriod: finalSolution.deltaX[i] ?? Array(5).fill(0),
  }))

  // Figure 6.6 — trajectory
  const cumXChart = DEFAULT_PERIODS.map((yr, t) => {
    const row: Record<string, number> = { year: yr }
    TECHNOLOGIES.forEach((tech, i) => { row[tech] = finalSolution.cumX[i]?.[t] ?? INITIAL_CAPACITY[tech] })
    return row
  })

  // Figure 6.7 — energy mix pie (last period production)
  const lastProd = lastIter.subproblems.reduce((acc, sr, w) => {
    const prob = result.scenarios[w].prob
    TECHNOLOGIES.forEach((_, i) => {
      acc[i] = (acc[i] ?? 0) + prob * (sr.periods[4]?.production[i] ?? 0)
    })
    return acc
  }, [] as number[])
  const pieData = TECHNOLOGIES.map((t, i) => ({ name: t, value: lastProd[i] ?? 0 }))
    .filter(d => d.value > 0.1)

  // Renewable share (battery excluded)
  const totalProd2050 = lastProd.reduce((s, v) => s + (v ?? 0), 0)
  const renProd2050 = (lastProd[0] ?? 0) + (lastProd[1] ?? 0)
  const renShare = totalProd2050 > 0 ? renProd2050 / totalProd2050 * 100 : 0

  // GHG reduction vs fossil baseline
  const baseGhg = result.scenarios.reduce((s, sc, w) => {
    const bg = sc.periods.reduce((ss, pd, t) => {
      return ss + Math.min(INITIAL_CAPACITY["Gaz"], pd.demand) * 0.00235 * DEFAULT_PERIOD_SPANS[t]
    }, 0)
    return s + sc.prob * bg
  }, 0)
  const ghgReduction = baseGhg > 0 ? (baseGhg - totalGhg) / baseGhg * 100 : 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Onglet 7 — Solution optimale</h1>
          <p className="text-sm text-muted-foreground">
            Statut : {result.status === "converged" ? "Convergée ✓" : "Max iter"} · Gap = {(result.finalGap * 100).toFixed(3)} % · k = {result.iterations.length} itérations
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => exportCSV(result)} variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />CSV
          </Button>
          <Button onClick={() => exportJSON(result)} variant="outline" size="sm" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />JSON
          </Button>
          <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />Imprimer
          </Button>
        </div>
      </div>

      {/* Table 6.20 — Capacités finales 2050 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.20 — Capacités installées finales en 2050
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Technologie</th>
                  <th className="text-right py-2 px-4">x⁰ (2024)</th>
                  <th className="text-right py-2 px-4">x_final (2050)</th>
                  <th className="text-right py-2 px-4">Δx total</th>
                  <th className="text-right py-2 pl-4">Croissance (%)</th>
                </tr>
              </thead>
              <tbody>
                {final2050.map(({ tech, x0, xFinal, dx }) => {
                  const pct = x0 > 0 ? dx / x0 * 100 : 0
                  return (
                    <tr key={tech} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-4 font-medium" style={{ color: TECH_COLORS[tech] }}>{tech}</td>
                      <td className="py-2 px-4 text-right font-mono text-xs">{x0.toLocaleString()}</td>
                      <td className="py-2 px-4 text-right font-mono font-semibold">{xFinal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className={`py-2 px-4 text-right font-mono ${dx > 0 ? "text-chart-2 font-semibold" : "text-muted-foreground"}`}>
                        {dx > 0 ? `+${dx.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                      </td>
                      <td className={`py-2 pl-4 text-right font-mono ${pct > 0 ? "text-chart-2" : "text-muted-foreground"}`}>
                        {pct > 0 ? `+${pct.toFixed(0)} %` : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Figure 6.6 — Trajectory */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {"Figure 6.6 — Trajectoire optimale des capacités x_{i,τ} (2024–2050)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cumXChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(undefined, { maximumFractionDigits: 0 }), name]} />
              <Legend />
              {TECHNOLOGIES.map(t => (
                <Line key={t} type="monotone" dataKey={t} stroke={TECH_COLORS[t]} strokeWidth={2} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table 6.21 — Investissements cumulés */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {"Table 6.21 — Investissements cumulés Δx_{i,τ} par période"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Technologie</th>
                  {DEFAULT_PERIODS.map(yr => <th key={yr} className="text-right py-2 px-3">τ = {yr}</th>)}
                  <th className="text-right py-2 pl-4">Σ Δx</th>
                </tr>
              </thead>
              <tbody>
                {cumInvest.map(({ tech, byPeriod, total }) => (
                  <tr key={tech} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-2 pr-4 font-medium" style={{ color: TECH_COLORS[tech] }}>{tech}</td>
                    {byPeriod.map((dx, t) => (
                      <td key={t} className={`py-2 px-3 text-right font-mono text-xs ${dx > 0 ? "text-chart-2 font-semibold" : "text-muted-foreground"}`}>
                        {dx > 0.5 ? dx.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                      </td>
                    ))}
                    <td className="py-2 pl-4 text-right font-mono font-bold">
                      {total > 0 ? total.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Table 6.22 — Indicateurs économiques */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.22 — Indicateurs économiques (Z₁)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { l: "CAPEX total actualisé", v: `${finalSolution.investCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€`, sub: "Investissements en capacité" },
              { l: "OPEX actualisé (hors pénalité)", v: `${pureOpCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€`, sub: "Coût opérationnel pur (dispatche, hors λ_D·u)" },
              { l: "Pénalité déficit E[λ_D · u]", v: `${deficitPenalty.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€`, sub: `λ_D = ${config.lambdaD} M€/u.` },
              { l: "Z₁ — Coût total actualisé", v: `${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€`, sub: "CAPEX + OPEX + Pénalité", bold: true },
            ].map(d => (
              <div key={d.l} className={`p-4 rounded-xl ${(d as { bold?: boolean }).bold ? "bg-chart-4/10 border border-chart-4/30" : "bg-secondary/30"}`}>
                <p className="text-xs text-muted-foreground">{d.l}</p>
                <p className={`text-xl font-bold mt-1 ${(d as { bold?: boolean }).bold ? "text-chart-4" : "text-foreground"}`}>{d.v}</p>
                <p className="text-xs text-muted-foreground mt-1">{d.sub}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table 6.23 — Indicateurs environnementaux + NDC */}
      <Card className={ndcOk ? "border-chart-2/40" : "border-chart-1/40"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.23 — Indicateurs environnementaux (Z₂) et vérification NDC
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              { l: "Z₂ — Émissions totales", v: `${totalGhg.toFixed(2)} MtCO₂` },
              { l: "Réduction vs référence", v: `${ghgReduction.toFixed(1)} %`, sub: "vs scénario 100% Gaz" },
              { l: "Part renouvelables 2050", v: `${renShare.toFixed(1)} %`, sub: "PV + Éolien (batterie exclue)" },
              { l: "Plafond E^NDC", v: `${config.ndcThreshold.toLocaleString()} MtCO₂`, sub: "Accord de Paris Algérie" },
            ].map(d => (
              <div key={d.l} className="p-4 bg-secondary/30 rounded-xl">
                <p className="text-xs text-muted-foreground">{d.l}</p>
                <p className="text-xl font-bold mt-1">{d.v}</p>
                {(d as { sub?: string }).sub && <p className="text-xs text-muted-foreground mt-1">{(d as { sub?: string }).sub}</p>}
              </div>
            ))}
          </div>
          <div className={`flex items-center gap-3 p-4 rounded-xl ${ndcOk ? "bg-chart-2/10 border border-chart-2/30" : "bg-chart-1/10 border border-chart-1/30"}`}>
            {ndcOk
              ? <CheckCircle className="h-5 w-5 text-chart-2 shrink-0" />
              : <XCircle className="h-5 w-5 text-chart-1 shrink-0" />}
            <div>
              <p className={`font-bold ${ndcOk ? "text-chart-2" : "text-chart-1"}`}>
                Respect NDC : {ndcOk ? "Oui ✓" : "Non ✗"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Z₂ = {totalGhg.toFixed(2)} MtCO₂ {ndcOk ? "≤" : ">"} E^NDC = {config.ndcThreshold.toLocaleString()} MtCO₂
                {" "}(§ 7.6 du mémoire — vérification post-hoc)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Figure 6.7 — Energy mix pie */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Figure 6.7 — Mix énergétique (production, période 2048–2050)
          </CardTitle>
          <CardDescription>
            Production E[y_(i,τ=2048)] pondérée sur {result.scenarios.length} scénarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-8 items-center justify-center">
            <ResponsiveContainer width={280} height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={110}
                  dataKey="value" nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {pieData.map(d => (
                    <Cell key={d.name} fill={TECH_COLORS[d.name] ?? "#888"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ktep/an`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {pieData.map(d => {
                const pct = totalProd2050 > 0 ? d.value / totalProd2050 * 100 : 0
                return (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: TECH_COLORS[d.name] }} />
                    <span className="text-sm font-medium w-20">{d.name}</span>
                    <div className="w-32 h-2 bg-secondary/30 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TECH_COLORS[d.name] }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-12 text-right">{pct.toFixed(1)} %</span>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executive summary */}
      <Card className="border-chart-4/30 bg-chart-4/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Résumé exécutif automatique
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground leading-relaxed">
            Le solveur L-Shaped (décomposition de Benders, {result.config.nScenarios} scénarios LHS) converge en{" "}
            {result.iterations.length} itérations avec un gap final de {(result.finalGap * 100).toFixed(3)} %.{" "}
            La solution optimale privilégie l'investissement dans{" "}
            {[...TECHNOLOGIES]
              .map((t, i) => ({ t, dx: finalSolution.deltaX[i]?.reduce((s, d) => s + d, 0) ?? 0 }))
              .filter(x => x.dx > 0)
              .sort((a, b) => b.dx - a.dx)
              .slice(0, 3)
              .map(x => x.t).join(", ")
            }.{" "}
            Coût total actualisé Z₁ = {totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€ (CAPEX {finalSolution.investCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€ + OPEX {pureOpCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€).{" "}
            Émissions Z₂ = {totalGhg.toFixed(2)} MtCO₂ (réduction {ghgReduction.toFixed(1)} % vs référence fossile).{" "}
            Part renouvelables en 2050 : {renShare.toFixed(1)} % (PV + Éolien, batterie exclue du ratio REN).{" "}
            Respect NDC : <strong>{ndcOk ? "Oui ✓" : "Non ✗"}</strong>
            {!ndcOk && ` — réduire ε ou activer la contrainte GES dans le front de Pareto (Onglet 9)`}.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

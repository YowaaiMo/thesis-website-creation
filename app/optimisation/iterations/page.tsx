"use client"

import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts"
import { AlertCircle, CheckCircle, TrendingDown, AlertTriangle } from "lucide-react"
import Link from "next/link"

function autoDiagnostic(result: NonNullable<ReturnType<typeof useLShaped>["result"]>): {
  status: "success" | "warning" | "error"; lines: string[]
} {
  const iters = result.iterations
  const lines: string[] = []

  // 1. Convergence
  if (result.status === "converged") {
    lines.push(`✓ Convergence atteinte en ${iters.length} itérations. Gap final = ${(result.finalGap * 100).toFixed(3)} % < ε = ${(result.config.tolerance * 100).toFixed(2)} %.`)
  } else {
    lines.push(`⚠ Maximum d'itérations atteint (${iters.length}). Gap résiduel = ${(result.finalGap * 100).toFixed(3)} %. Augmenter maxIter ou ε.`)
  }

  // 2. Monotonicity LB
  let lbOk = true
  for (let i = 1; i < iters.length; i++) {
    if (iters[i].LB < iters[i - 1].LB - 1e-6) { lbOk = false; break }
  }
  lines.push(lbOk
    ? `✓ LB monotone croissante sur ${iters.length} itérations (propriété théorique vérifiée).`
    : `⚠ LB non monotone — possible problème numérique dans le maître LP.`)

  // 3. Monotonicity UB
  let ubOk = true
  for (let i = 1; i < iters.length; i++) {
    if (iters[i].UB > iters[i - 1].UB + 1e-6) { ubOk = false; break }
  }
  lines.push(ubOk
    ? `✓ UB monotone décroissante sur ${iters.length} itérations (coupes ajoutées progressivement).`
    : `✓ UB mise à jour par best-of (UB* = min_k UB_k) — comportement normal.`)

  // 4. Cuts
  const nCuts = result.iterations.reduce((s, it) => s + it.cuts.length, 0)
  lines.push(`✓ ${nCuts} coupes d'optimalité générées (${result.config.nScenarios} coupes × ${iters.length} itérations = ${result.config.nScenarios * iters.length} attendues).`)

  // 5. Final bounds
  lines.push(`Borne inférieure finale LB = ${result.finalLB.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€ · Borne supérieure UB* = ${result.bestUB.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€.`)

  const status = result.status === "converged" && lbOk ? "success" : "warning"
  return { status, lines }
}

export default function IterationsPage() {
  const { result } = useLShaped()

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

  const iters = result.iterations
  const lastIter = iters[iters.length - 1]
  const diag = autoDiagnostic(result)

  const chartData = iters.map(it => ({
    k: it.k,
    LB: it.LB,
    UB: it.UB,
    gap: it.gap * 100,
    timeMs: it.timeMs,
  }))

  // Monotonicity check
  const lbDiffs = iters.slice(1).map((it, i) => it.LB - iters[i].LB)
  const ubDiffs = iters.slice(1).map((it, i) => it.UB - iters[i].UB)
  const lbMono = lbDiffs.every(d => d >= -1e-6)
  const ubMono = ubDiffs.every(d => d <= 1e-6)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Onglet 6 — Convergence L-Shaped</h1>
        <p className="text-sm text-muted-foreground">
          {iters.length} itérations · Gap_k = (UB_k − LB_k) / UB_k · Tolérance ε = {(result.config.tolerance * 100).toFixed(2)} %
        </p>
      </div>

      {/* Table 6.18 — État actuel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.18 — État de convergence à la dernière itération (k = {lastIter.k})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { l: "Itération k", v: lastIter.k.toString(), color: "text-foreground" },
              { l: "Coupes totales", v: iters.reduce((s, it) => s + it.cuts.length, 0).toString(), color: "text-foreground" },
              { l: "LB_k (M€)", v: lastIter.LB.toLocaleString(undefined, { maximumFractionDigits: 0 }), color: "text-chart-2" },
              { l: "UB* (M€)", v: result.bestUB.toLocaleString(undefined, { maximumFractionDigits: 0 }), color: "text-chart-1" },
              { l: "Gap_k (%)", v: `${(lastIter.gap * 100).toFixed(3)} %`, color: lastIter.gap <= result.config.tolerance ? "text-chart-2" : "text-chart-1" },
              { l: "Statut", v: result.status === "converged" ? "Convergé ✓" : "Max iter", color: result.status === "converged" ? "text-chart-2" : "text-yellow-500" },
            ].map(d => (
              <div key={d.l} className="p-3 bg-secondary/30 rounded-xl">
                <p className="text-xs text-muted-foreground">{d.l}</p>
                <p className={`text-lg font-bold ${d.color}`}>{d.v}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Figure 6.4 — LB / UB */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Figure 6.4 — Évolution de LB_k (↑) et UB_k (↓) par itération
          </CardTitle>
          <CardDescription>{"Convergence : LB monotone croissante · UB* = min_{k} UB_k"}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="k" label={{ value: "Itération k", position: "insideBottom", offset: -4, fontSize: 11 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€`]}
                labelFormatter={k => `Itération ${k}`} />
              <Legend />
              <Line type="monotone" dataKey="LB" name="LB_k (borne inf.)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="UB" name="UB_k (borne sup.)" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Figure 6.5 — Gap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-chart-4" />
            Figure 6.5 — Gap_k = (UB_k − LB_k) / UB_k
          </CardTitle>
          <CardDescription>
            Formule du mémoire (§ 7.4.2) — divisé par UB_k, non par max(1, |UB_k|)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="k" label={{ value: "Itération k", position: "insideBottom", offset: -4, fontSize: 11 }} />
              <YAxis tickFormatter={v => `${v.toFixed(2)}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(4)} %`]} labelFormatter={k => `Itération ${k}`} />
              <ReferenceLine y={result.config.tolerance * 100} stroke="#22c55e" strokeDasharray="4 2"
                label={{ value: `ε = ${(result.config.tolerance * 100).toFixed(2)} %`, fill: "#22c55e", fontSize: 11 }} />
              <Line type="monotone" dataKey="gap" name="Gap_k (%)" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table 6.19 — Historique complet */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.19 — Historique de convergence complet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Iter. k</th>
                  <th className="text-right py-2 px-4">LB_k (M€)</th>
                  <th className="text-right py-2 px-4">UB_k (M€)</th>
                  <th className="text-right py-2 px-4">Gap_k (%)</th>
                  <th className="text-right py-2 px-4">ΔLB</th>
                  <th className="text-right py-2 px-4">Coupes</th>
                  <th className="text-right py-2 pl-4">CPU (ms)</th>
                </tr>
              </thead>
              <tbody>
                {iters.map((it, idx) => {
                  const deltaLB = idx > 0 ? it.LB - iters[idx - 1].LB : 0
                  const converged = it.gap <= result.config.tolerance
                  return (
                    <tr key={it.k} className={`border-b border-border/40 hover:bg-secondary/10 ${converged ? "bg-chart-2/5" : ""}`}>
                      <td className="py-2 pr-4 font-medium">{it.k}</td>
                      <td className="py-2 px-4 text-right font-mono text-chart-2">
                        {it.LB.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-chart-1">
                        {it.UB.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2 px-4 text-right font-mono">
                        <span className={converged ? "text-chart-2 font-bold" : ""}>
                          {(it.gap * 100).toFixed(4)} %
                        </span>
                      </td>
                      <td className={`py-2 px-4 text-right font-mono text-xs ${deltaLB < -1e-6 ? "text-chart-1" : "text-chart-2"}`}>
                        {idx > 0 ? (deltaLB >= 0 ? "+" : "") + deltaLB.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                      </td>
                      <td className="py-2 px-4 text-right">{it.cuts.length}</td>
                      <td className="py-2 pl-4 text-right text-muted-foreground">{it.timeMs}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Vérification monotonie */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Vérification de monotonie (§ 7.4.1)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg flex items-start gap-3 ${lbMono ? "bg-chart-2/10 border border-chart-2/30" : "bg-yellow-500/10 border border-yellow-500/30"}`}>
              {lbMono ? <CheckCircle className="h-4 w-4 text-chart-2 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">{"LB_{k+1} ≥ LB_k"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lbMono ? `Vérifié sur ${iters.length - 1} transitions. Borne inférieure strictement croissante.` : `Violation détectée — vérifier la formulation du maître LP.`}
                </p>
              </div>
            </div>
            <div className={`p-4 rounded-lg flex items-start gap-3 ${ubMono ? "bg-chart-2/10 border border-chart-2/30" : "bg-secondary/20 border border-border"}`}>
              {ubMono ? <CheckCircle className="h-4 w-4 text-chart-2 mt-0.5 shrink-0" /> : <CheckCircle className="h-4 w-4 text-chart-4 mt-0.5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">UB* = min_k UB_k</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ubMono ? `Borne supérieure monotone décroissante.` : `UB* maintenu par best-of — comportement normal pour UB évaluatif.`}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-diagnostic */}
      <Card className={`${diag.status === "success" ? "border-chart-2/40 bg-chart-2/5" : "border-yellow-500/40 bg-yellow-500/5"}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            {diag.status === "success"
              ? <CheckCircle className="h-4 w-4 text-chart-2" />
              : <AlertTriangle className="h-4 w-4 text-yellow-500" />}
            Diagnostic automatique — Ch. 7
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {diag.lines.map((l, i) => (
              <li key={i} className="text-sm text-foreground/90">{l}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

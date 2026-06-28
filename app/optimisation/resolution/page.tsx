"use client"

import Link from "next/link"
import { useState } from "react"
import { useLShaped } from "@/lib/lshaped-context"
import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Play, Loader2, CheckCircle, AlertCircle, Info } from "lucide-react"
import {
  TECHNOLOGIES, DEFAULT_PERIODS, INITIAL_CAPACITY,
  MAX_DELTA_X, MAX_CUMULATIVE_X, NDC_THRESHOLD_DEFAULT,
} from "@/lib/lshaped/types"

const TECH_COLORS: Record<string, string> = {
  PV: "#fbbf24", Wind: "#06b6d4", Gaz: "#3b82f6",
  Pétrole: "#dc2626", GPL: "#16a34a", Condensat: "#f59e0b", Batterie: "#8b5cf6",
}

const FOSSIL = new Set(["Gaz", "Pétrole", "GPL", "Condensat"])

export default function ParametresPage() {
  const { config, setConfig, result, isRunning, progress, runSolver, lhsAvailable } = useLShaped()
  const { lhsResult } = useSimulation()

  const [localN,       setLocalN]       = useState(config.nScenarios)
  const [localMaxIter, setLocalMaxIter] = useState(config.maxIter)
  const [localTol,     setLocalTol]     = useState(config.tolerance * 100)
  const [localLambda,  setLocalLambda]  = useState(config.lambdaD)
  const [localNDC,     setLocalNDC]     = useState(config.ndcThreshold)

  function handleLaunch() {
    const newConfig = {
      ...config,
      nScenarios:   localN,
      maxIter:      localMaxIter,
      tolerance:    localTol / 100,
      lambdaD:      localLambda,
      ndcThreshold: localNDC,
    }
    setConfig(newConfig)
    runSolver(newConfig)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Onglet 1 — Paramètres du modèle</h1>
        <p className="text-sm text-muted-foreground">
          Ensembles, données technologiques et paramètres scalaires du problème stochastique bi-objectif.
        </p>
      </div>

      {/* ── Bloc LHS obligatoire ── */}
      {!lhsAvailable ? (
        <div className="p-6 rounded-xl border-2 border-destructive/60 bg-destructive/5">
          <div className="flex gap-4">
            <AlertCircle className="h-6 w-6 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-destructive text-base mb-2">
                Résolution bloquée — Scénarios LHS requis
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                Le solveur L-Shaped utilise <strong>exclusivement</strong> les scénarios générés par
                Latin Hypercube Sampling (LHS). Il n'existe qu'une seule source de scénarios dans cette application :
              </p>
              <div className="text-sm bg-secondary/30 rounded-lg p-3 font-mono mb-4 text-foreground/80">
                Génération LHS → 20 scénarios → L-Shaped (résolution) → Pareto → Rapport
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Aucun scénario LHS n'a encore été généré dans cette session. La résolution ne peut
                pas démarrer sans scénarios réels. Générez-les d'abord via l'onglet MC/LHS, puis
                revenez ici.
              </p>
              <Button asChild className="gap-2 bg-chart-4 hover:bg-chart-4/90 text-white">
                <Link href="/generation">
                  <Play className="h-4 w-4" />
                  Aller générer les scénarios LHS
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-chart-2/30 bg-chart-2/5 flex gap-3">
          <CheckCircle className="h-4 w-4 text-chart-2 mt-0.5 shrink-0" />
          <p className="text-sm text-chart-2 font-medium">
            {lhsResult!.scenarios.length} scénarios LHS disponibles — le solveur utilisera ces scénarios exacts.
            Méthode : Latin Hypercube Sampling · p_ω = {(1 / Math.min(config.nScenarios, lhsResult!.scenarios.length)).toFixed(4)}
          </p>
        </div>
      )}

      {/* ── Ensembles ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dimensions du modèle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Technologies  |I|", value: "7",  sub: "PV · Wind · Gaz · Pétrole · GPL · Cond · Bat" },
              { label: "Années totales |T|", value: "27", sub: "2024 → 2050 (horizon complet)" },
              { label: "Périodes repr. |T_rep|", value: "5",  sub: "2024 · 2030 · 2036 · 2042 · 2048" },
              { label: "Scénarios |Ω|", value: `${localN}`, sub: "générés par LHS (Hypercube Latin)" },
            ].map(d => (
              <div key={d.label} className="p-3 bg-secondary/30 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
                <p className="text-2xl font-bold text-chart-4">{d.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{d.sub}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Paramètres scalaires ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Paramètres scalaires globaux
          </CardTitle>
          <CardDescription>Table 6.2 — valeurs modifiables par l'utilisateur</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-6">Paramètre</th>
                  <th className="text-left py-2 pr-6">Symbole</th>
                  <th className="text-right py-2 px-4">Valeur courante</th>
                  <th className="text-left py-2 pl-6">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  { name: "Taux d'actualisation", sym: "r", val: "2 %", desc: "Actualise les flux sur 2024–2050" },
                  { name: "Pénalité déficit", sym: "λ_D", val: `${localLambda} M€/u.`, desc: ">> coût op. max (~0.22 M€/u.)" },
                  { name: "Rendement charge", sym: "η_c", val: "0.92", desc: "Li-ion, charge" },
                  { name: "Rendement décharge", sym: "η_d", val: "0.92", desc: "Li-ion, décharge" },
                  { name: "Rendement aller-retour", sym: "η_rt", val: "0.846", desc: "η_c × η_d = 0.92²" },
                  { name: "Disponibilité batterie", sym: "AV_bat", val: "0.30", desc: "η_rt × utilisation (Level B)" },
                  { name: "Disponibilité fossile", sym: "AV_foss", val: "0.85", desc: "Taux de charge moyen" },
                  { name: "Plafond NDC", sym: "E^NDC", val: `${localNDC.toLocaleString()} MtCO₂`, desc: "Contrainte Accord de Paris (§ 7.6)" },
                ].map(r => (
                  <tr key={r.sym} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-2 pr-6 font-medium">{r.name}</td>
                    <td className="py-2 pr-6 font-mono text-chart-4">{r.sym}</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold">{r.val}</td>
                    <td className="py-2 pl-6 text-muted-foreground text-xs">{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Table 6.3 : capacités initiales ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.3 — Capacités initiales x⁰ (Algérie 2024)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Technologie</th>
                  <th className="text-right py-2 px-4">x⁰ (unité)</th>
                  <th className="text-left py-2 pl-6">Nature</th>
                </tr>
              </thead>
              <tbody>
                {TECHNOLOGIES.map(t => (
                  <tr key={t} className="border-b border-border/40 hover:bg-secondary/10">
                    <td className="py-2 pr-4 font-medium" style={{ color: TECH_COLORS[t] }}>{t}</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold">
                      {INITIAL_CAPACITY[t].toLocaleString()}
                    </td>
                    <td className="py-2 pl-6 text-xs text-muted-foreground">
                      {FOSSIL.has(t) ? "Fossile — investissement plafonné" : "Renouvelable / stockage"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Table 6.4 : bornes technologiques ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Table 6.4 — Bornes technologiques
          </CardTitle>
          <CardDescription>
            ΔX̄ = ajout maximal par période de 6 ans · X̄ = capacité cumulée maximale
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Technologie</th>
                  <th className="text-right py-2 px-4">x⁰</th>
                  <th className="text-right py-2 px-4">ΔX̄ / période</th>
                  <th className="text-right py-2 px-4">X̄ cumulatif</th>
                  <th className="text-left py-2 pl-6">Hypothèse</th>
                </tr>
              </thead>
              <tbody>
                {TECHNOLOGIES.map(t => {
                  const dx = MAX_DELTA_X[t]
                  const xmax = MAX_CUMULATIVE_X[t]
                  const isFossil = FOSSIL.has(t)
                  return (
                    <tr key={t} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="py-2 pr-4 font-medium" style={{ color: TECH_COLORS[t] }}>{t}</td>
                      <td className="py-2 px-4 text-right font-mono text-xs">{INITIAL_CAPACITY[t].toLocaleString()}</td>
                      <td className="py-2 px-4 text-right font-mono text-xs font-semibold">
                        {dx.toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-xs">
                        {xmax.toLocaleString()}
                      </td>
                      <td className="py-2 pl-6 text-xs text-muted-foreground">
                        {isFossil
                          ? "Fossile — expansion réaliste plafonnée"
                          : t === "PV"   ? "4 000/an × 6 ans (Table 6.4)"
                          : t === "Wind" ? "3 000/an × 6 ans (Table 6.4)"
                          : t === "Batterie" ? "1 200/an × 6 ans (Table 6.4)"
                          : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-start gap-2 p-3 bg-secondary/20 rounded-lg text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Les bornes fossiles permettent l'investissement si nécessaire à la sécurité d'approvisionnement,
              tout en évitant les solutions irréalistes. Le modèle optimise librement dans ces plafonds.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Contrôles solveur ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Configuration du solveur L-Shaped
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Scénarios |Ω| = {localN}  <span className="text-xs text-muted-foreground">(20 requis pour résultats finaux)</span></Label>
                <Slider
                  min={2} max={Math.min(20, lhsResult?.scenarios.length ?? 20)}
                  step={1} value={[localN]}
                  onValueChange={([v]) => setLocalN(v)}
                />
                <p className="text-xs text-muted-foreground">
                  {lhsResult ? `${lhsResult.scenarios.length} scénarios LHS disponibles` : "Scénarios par défaut (seed=42)"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Itérations max = {localMaxIter}</Label>
                <Slider min={5} max={50} step={5} value={[localMaxIter]}
                  onValueChange={([v]) => setLocalMaxIter(v)} />
              </div>

              <div className="space-y-2">
                <Label>Tolérance Gap = {localTol.toFixed(2)} %</Label>
                <Slider min={0.1} max={5} step={0.1} value={[localTol]}
                  onValueChange={([v]) => setLocalTol(v)} />
                <p className="text-xs text-muted-foreground">
                  Arrêt si Gap_k = (UB_k − LB_k) / UB_k &lt; {localTol.toFixed(2)} %
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="lambda">Pénalité déficit λ_D (M€/u.)</Label>
                <Input id="lambda" type="number" value={localLambda}
                  onChange={e => setLocalLambda(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">&gt;&gt; coût op. max fossile (~0.22 M€/u.)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ndc">Plafond NDC E^NDC (MtCO₂)</Label>
                <Input id="ndc" type="number" value={localNDC}
                  onChange={e => setLocalNDC(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">
                  Vérification post-hoc : Z₂ ≤ E^NDC (Onglet 7, § 7.6)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── LHS warning ── */}
      {!lhsResult && (
        <div className="p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/5 flex gap-3">
          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-yellow-500">Simulation LHS non disponible</p>
            <p className="text-muted-foreground mt-1">
              Scénarios par défaut (seed=42). Pour des résultats scientifiques, générez d'abord les 20 scénarios LHS depuis{" "}
              <Link href="/generation" className="underline text-chart-2">Génération MC/LHS</Link>.
            </p>
          </div>
        </div>
      )}

      {/* ── Lancement ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" onClick={handleLaunch} disabled={isRunning || !lhsAvailable}
              className="gap-2 bg-chart-4 hover:bg-chart-4/90 text-white disabled:opacity-40 disabled:cursor-not-allowed">
              {isRunning
                ? <><Loader2 className="h-4 w-4 animate-spin" />Calcul en cours ({progress?.k ?? 0} it.)…</>
                : !lhsAvailable
                  ? <><AlertCircle className="h-4 w-4" />Scénarios LHS requis</>
                  : <><Play className="h-4 w-4" />Lancer la résolution L-Shaped</>}
            </Button>
            {result && (
              <div className="flex items-center gap-2 text-sm text-chart-2">
                <CheckCircle className="h-4 w-4" />
                Dernière résolution : {result.iterations.length} itérations · {result.status === "converged" ? "Convergée" : "Max iter"}
              </div>
            )}
          </div>

          {isRunning && progress && (
            <div className="mt-4 p-4 bg-secondary/20 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Itération {progress.k} / {localMaxIter}</span>
                <span className="text-muted-foreground font-mono">Gap = {(progress.gap * 100).toFixed(3)} %</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Borne inférieure LB</p>
                  <p className="font-mono font-bold text-chart-2">
                    {progress.LB.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Borne supérieure UB</p>
                  <p className="font-mono font-bold text-chart-1">
                    {progress.UB.toLocaleString(undefined, { maximumFractionDigits: 0 })} M€
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Résumé post-résolution ── */}
      {result && (
        <Card className="border-chart-2/40 bg-chart-2/5">
          <CardContent className="py-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-chart-2/20 flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5 text-chart-2" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-3">
                  Résolution terminée — {result.status === "converged" ? "Convergée ✓" : "Max itérations atteint"}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { l: "Itérations", v: result.iterations.length.toString() },
                    { l: "Gap final", v: `${(result.finalGap * 100).toFixed(3)} %` },
                    { l: "Z₁ Coût", v: `${result.totalCost.toFixed(0)} M€` },
                    { l: "Z₂ GES", v: `${result.totalGhg.toFixed(1)} MtCO₂` },
                  ].map(d => (
                    <div key={d.l} className="p-3 bg-background/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">{d.l}</p>
                      <p className="font-bold text-lg">{d.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

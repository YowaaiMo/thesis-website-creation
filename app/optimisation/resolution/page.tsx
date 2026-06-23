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
import {
  Play, Loader2, CheckCircle, TrendingUp, Network, Scissors,
  ScatterChart, Trophy, AlertCircle
} from "lucide-react"
import { TECHNOLOGIES, DEFAULT_PERIODS } from "@/lib/lshaped/types"

export default function ResolutionPage() {
  const { config, setConfig, result, isRunning, progress, runSolver } = useLShaped()
  const { lhsResult } = useSimulation()

  const [localN, setLocalN] = useState(config.nScenarios)
  const [localMaxIter, setLocalMaxIter] = useState(config.maxIter)
  const [localTol, setLocalTol] = useState(config.tolerance * 100)
  const [localLambda, setLocalLambda] = useState(config.lambdaD)

  function handleLaunch() {
    const newConfig = {
      ...config,
      nScenarios: localN,
      maxIter: localMaxIter,
      tolerance: localTol / 100,
      lambdaD: localLambda,
    }
    setConfig(newConfig)
    runSolver(newConfig)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Resolution L-Shaped</h1>
        <p className="text-muted-foreground">
          Configurer et lancer le solveur de programmation stochastique par decomposition de Benders.
        </p>
      </div>

      {/* LHS status */}
      {!lhsResult && (
        <div className="mb-6 p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/5 flex gap-3">
          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-yellow-500">Simulation LHS non disponible</p>
            <p className="text-muted-foreground mt-1">
              Les scenarios seront generes aleatoirement (graine fixe). Pour utiliser vos scenarios
              LHS, lancez d'abord la generation depuis{" "}
              <Link href="/generation" className="underline text-chart-2">Generation MC/LHS</Link>.
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Parametres du solveur</CardTitle>
            <CardDescription>Dimensions et criteres de convergence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Nombre de scenarios |Ω| = {localN}</Label>
              <Slider
                min={2} max={Math.min(20, lhsResult?.scenarios.length ?? 20)}
                step={1} value={[localN]}
                onValueChange={([v]) => setLocalN(v)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground">
                {lhsResult ? `${lhsResult.scenarios.length} scenarios LHS disponibles` : "Scenarios par defaut (seed=42)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Iterations max = {localMaxIter}</Label>
              <Slider
                min={5} max={50} step={5} value={[localMaxIter]}
                onValueChange={([v]) => setLocalMaxIter(v)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tolerance Gap = {localTol.toFixed(2)}%</Label>
              <Slider
                min={0.1} max={5} step={0.1} value={[localTol]}
                onValueChange={([v]) => setLocalTol(v)}
              />
              <p className="text-xs text-muted-foreground">Convergence si (UB−LB)/UB &lt; {localTol.toFixed(2)}%</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lambda">Penalite deficit λ_D (M€/ktep)</Label>
              <Input
                id="lambda"
                type="number"
                value={localLambda}
                onChange={e => setLocalLambda(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Doit être &gt;&gt; coût op max (~0.22 M€/ktep)</p>
            </div>
          </CardContent>
        </Card>

        {/* Problem summary */}
        <Card>
          <CardHeader>
            <CardTitle>Synthese du modele</CardTitle>
            <CardDescription>Parametres fixes du probleme d'optimisation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Technologies</p>
              <div className="flex flex-wrap gap-1">
                {TECHNOLOGIES.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 bg-secondary/50 rounded-full">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Periodes (T={DEFAULT_PERIODS.length})</p>
              <div className="flex flex-wrap gap-1">
                {DEFAULT_PERIODS.map(y => (
                  <span key={y} className="text-xs px-2 py-0.5 bg-secondary/50 rounded-full">{y}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: "Taux d'actualisation", v: "2%" },
                { l: "Rend. batterie ηc=ηd", v: "0.92" },
                { l: "Disponibilite fossile", v: "85%" },
                { l: "Horizon", v: "2024–2050" },
              ].map(d => (
                <div key={d.l} className="p-2 bg-secondary/20 rounded-lg">
                  <p className="text-xs text-muted-foreground">{d.l}</p>
                  <p className="font-semibold text-sm">{d.v}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Launch */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              onClick={handleLaunch}
              disabled={isRunning}
              className="gap-2 bg-chart-4 hover:bg-chart-4/90 text-white"
            >
              {isRunning
                ? <><Loader2 className="h-4 w-4 animate-spin" />Calcul en cours...</>
                : <><Play className="h-4 w-4" />Lancer la resolution</>}
            </Button>
            {result && (
              <div className="flex items-center gap-2 text-sm text-chart-2">
                <CheckCircle className="h-4 w-4" />
                Derniere resolution : {result.iterations.length} iterations · status : {result.status}
              </div>
            )}
          </div>

          {/* Progress */}
          {isRunning && progress && (
            <div className="mt-4 p-4 bg-secondary/20 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Iteration {progress.k}</span>
                <span className="text-muted-foreground">Gap = {(progress.gap * 100).toFixed(3)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Borne inferieure LB</p>
                  <p className="font-mono font-semibold">{progress.LB.toLocaleString(undefined, { maximumFractionDigits: 1 })} M€</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Borne superieure UB</p>
                  <p className="font-mono font-semibold">{progress.UB.toLocaleString(undefined, { maximumFractionDigits: 1 })} M€</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result summary */}
      {result && (
        <div className="space-y-4">
          <Card className="border-chart-2/40 bg-chart-2/5">
            <CardContent className="py-5">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-chart-2/20 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-chart-2" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-3">Resolution terminee — {result.status === 'converged' ? 'Convergee' : 'Iterations max atteintes'}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { l: "Iterations", v: result.iterations.length.toString() },
                      { l: "Gap final", v: `${(result.finalGap * 100).toFixed(3)}%` },
                      { l: "Coût total", v: `${result.totalCost.toFixed(0)} M€` },
                      { l: "GES total", v: `${result.totalGhg.toFixed(1)} MtCO₂` },
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

          <div className="flex flex-wrap gap-3">
            {[
              { href: "/optimisation/iterations", icon: TrendingUp, label: "Convergence" },
              { href: "/optimisation/sous-problemes", icon: Network, label: "Sous-problemes" },
              { href: "/optimisation/coupes", icon: Scissors, label: "Coupes" },
              { href: "/optimisation/resultats", icon: Trophy, label: "Resultats" },
              { href: "/optimisation/rapport", icon: ScatterChart, label: "Rapport" },
            ].map(l => (
              <Button key={l.href} asChild variant="outline" size="sm" className="gap-2">
                <Link href={l.href}>
                  <l.icon className="h-3.5 w-3.5" />{l.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

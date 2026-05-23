"use client"

import Link from "next/link"
import { useState } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { type SimulationResult, type SimulationParams } from "@/lib/monte-carlo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Play, CheckCircle, Loader2, BarChart3, Download, GitCompare, Layers } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function GenerationPage() {
  const { params, seed, setSeed, result, lhsResult, isRunning, isRunningLHS, runMonteCarlo, runLHS, runBoth } = useSimulation()
  const [seedInput, setSeedInput] = useState(seed !== null ? String(seed) : "")
  const numYears = params.endYear - params.startYear + 1

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Generation de scenarios</h1>
        <p className="text-muted-foreground">
          Lancez la simulation Monte Carlo (MC) et/ou Latin Hypercube Sampling (LHS) pour generer
          les scenarios stochastiques du systeme energetique algerien.
        </p>
      </div>

      {/* Current Parameters Summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Configuration actuelle</CardTitle>
          <CardDescription>Resume des parametres de simulation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ParamDisplay label="Scenarios (S)" value={params.numScenarios.toString()} />
            <ParamDisplay label="Horizon" value={`${params.startYear} – ${params.endYear}`} />
            <ParamDisplay label="Annees (T)" value={numYears.toString()} />
            <ParamDisplay label="Points totaux" value={(params.numScenarios * numYears).toLocaleString()} />
          </div>
        </CardContent>
      </Card>

      {/* Method explanation */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card className="border-chart-1/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-chart-1">Monte Carlo (MC)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tirage aleatoire independant pour chaque scenario et chaque annee. Converge en O(1/√S).
            <code className="block mt-2 bg-secondary/40 rounded px-2 py-1 text-xs">zt ~ N(0,1) indep.</code>
          </CardContent>
        </Card>
        <Card className="border-chart-2/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-chart-2">Latin Hypercube Sampling (LHS)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Echantillonnage stratifie : chaque strate [k/S, (k+1)/S] est echantillonnee exactement une fois.
            <code className="block mt-2 bg-secondary/40 rounded px-2 py-1 text-xs">uk = (k + U) / S, zt = Φ⁻¹(uk)</code>
          </CardContent>
        </Card>
      </div>

      {/* Generation Buttons */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Lancer la simulation</CardTitle>
          <CardDescription>Choisissez la methode ou lancez les deux pour comparaison</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Seed input — section 6.3 */}
          <div className="flex items-end gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="seed">Graine (seed) — optionnelle</Label>
              <Input
                id="seed"
                type="number"
                placeholder="ex: 42 (laisser vide = aleatoire)"
                value={seedInput}
                onChange={(e) => {
                  setSeedInput(e.target.value)
                  const v = parseInt(e.target.value)
                  setSeed(e.target.value === "" || isNaN(v) ? null : v)
                }}
                className="w-64"
              />
            </div>
            {seed !== null && (
              <p className="text-xs text-muted-foreground pb-2">Graine active : {seed}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              onClick={runMonteCarlo}
              disabled={isRunning || isRunningLHS}
              className="gap-2 bg-chart-1 hover:bg-chart-1/90 text-white"
            >
              {isRunning ? (
                <><Loader2 className="h-4 w-4 animate-spin" />MC en cours...</>
              ) : (
                <><Play className="h-4 w-4" />Generer MC</>
              )}
            </Button>

            <Button
              size="lg"
              onClick={runLHS}
              disabled={isRunning || isRunningLHS}
              variant="outline"
              className="gap-2 border-chart-2 text-chart-2 hover:bg-chart-2/10"
            >
              {isRunningLHS ? (
                <><Loader2 className="h-4 w-4 animate-spin" />LHS en cours...</>
              ) : (
                <><Layers className="h-4 w-4" />Generer LHS</>
              )}
            </Button>

            <Button
              size="lg"
              onClick={runBoth}
              disabled={isRunning || isRunningLHS}
              variant="secondary"
              className="gap-2"
            >
              {(isRunning || isRunningLHS) ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Simulation en cours...</>
              ) : (
                <><GitCompare className="h-4 w-4" />Generer MC + LHS</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {(result || lhsResult) && (
        <Tabs defaultValue={result ? "mc" : "lhs"} className="space-y-6">
          <TabsList>
            <TabsTrigger value="mc" disabled={!result}>Monte Carlo</TabsTrigger>
            <TabsTrigger value="lhs" disabled={!lhsResult}>LHS</TabsTrigger>
          </TabsList>

          {result && (
            <TabsContent value="mc">
              <ResultCard
                method="Monte Carlo"
                result={result}
                params={params}
                color="chart-1"
              />
            </TabsContent>
          )}

          {lhsResult && (
            <TabsContent value="lhs">
              <ResultCard
                method="Latin Hypercube Sampling"
                result={lhsResult}
                params={params}
                color="chart-2"
              />
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Instructions if no result */}
      {!result && !lhsResult && !isRunning && !isRunningLHS && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="mb-2">Cliquez sur un bouton ci-dessus pour lancer la simulation.</p>
            <p className="text-sm">
              Variables stochastiques :&nbsp;
              <code className="bg-secondary/40 rounded px-1">D(ω)</code>&nbsp;
              <code className="bg-secondary/40 rounded px-1">h_PV(ω)</code>&nbsp;
              <code className="bg-secondary/40 rounded px-1">h_Wind(ω)</code>&nbsp;
              <code className="bg-secondary/40 rounded px-1">c_PV(ω)</code>&nbsp;
              <code className="bg-secondary/40 rounded px-1">P_gaz(ω)</code>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ResultCard({
  method,
  result,
  params,
  color
}: {
  method: string
  result: SimulationResult
  params: SimulationParams
  color: string
}) {
  return (
    <div className="space-y-6">
      <Card className={`border-${color}/40 bg-${color}/5`}>
        <CardContent className="py-5">
          <div className="flex items-center gap-4">
            <div className={`h-10 w-10 rounded-full bg-${color}/20 flex items-center justify-center`}>
              <CheckCircle className={`h-5 w-5 text-${color}`} />
            </div>
            <div>
              <h3 className="font-semibold">{method} — simulation terminee</h3>
              <p className="text-sm text-muted-foreground">
                {result.scenarios.length} scenarios · horizon {params.startYear}–{params.endYear} ·
                calcules en {(result.computationTime / 1000).toFixed(2)}s
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variables generees</CardTitle>
          <CardDescription>Statistiques en {params.endYear} · Big-M = max D_t(ω) = {Math.max(...result.scenarios.flatMap(s => s.demand.total)).toFixed(0)} ktep</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <VariableCard
              name="Demande totale"
              description="D_t(ω)"
              meanValue={result.statistics.demand.mean[result.statistics.demand.mean.length - 1].toFixed(0)}
              unit="ktep"
            />
            <VariableCard
              name="Disponibilite solaire"
              description="h_PV(ω)"
              meanValue={(result.statistics.solarAvailability.mean[0] * 100).toFixed(1)}
              unit="%"
            />
            <VariableCard
              name="Disponibilite eolienne"
              description="h_Wind(ω)"
              meanValue={(result.statistics.windAvailability.mean[0] * 100).toFixed(1)}
              unit="%"
            />
            <VariableCard
              name="CAPEX PV (2050)"
              description="c_inv_PV(ω)"
              meanValue={result.statistics.capexPv.mean[result.statistics.capexPv.mean.length - 1].toFixed(0)}
              unit="€/kW"
            />
            <VariableCard
              name="Prix du gaz (2050)"
              description="P_gaz(ω)"
              meanValue={result.statistics.gasPrice.mean[result.statistics.gasPrice.mean.length - 1].toFixed(2)}
              unit="€/MBtu"
            />
            <VariableCard
              name="Scenarios extremes"
              description="Pessimiste, optimiste"
              meanValue="5"
              unit="identifies"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild className="gap-2">
          <Link href="/visualisation">
            <BarChart3 className="h-4 w-4" />Visualiser
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/mc-lhs">
            <GitCompare className="h-4 w-4" />Comparaison MC vs LHS
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/interpretation">
            Interpretation automatique
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/export">
            <Download className="h-4 w-4" />Exporter
          </Link>
        </Button>
      </div>
    </div>
  )
}

function ParamDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-secondary/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function VariableCard({ name, description, meanValue, unit }: {
  name: string; description: string; meanValue: string; unit: string
}) {
  return (
    <div className="p-4 rounded-lg bg-secondary/30 border border-border">
      <p className="text-sm font-medium">{name}</p>
      <code className="text-xs text-muted-foreground">{description}</code>
      <div className="mt-2">
        <span className="text-2xl font-bold text-primary">{meanValue}</span>
        <span className="text-sm text-muted-foreground ml-1">{unit}</span>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { runSimulation, DEFAULT_PARAMS, type SimulationParams } from "@/lib/monte-carlo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import Link from "next/link"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts"

export default function SensibilitePage() {
  const { result, params } = useSimulation()
  const [testParams, setTestParams] = useState<SimulationParams>({ ...params, numScenarios: 100 })
  const [comparisonResult, setComparisonResult] = useState<{ baseline: typeof result; modified: typeof result } | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const runSensitivityTest = () => {
    setIsRunning(true)
    setTimeout(() => {
      const baseline = runSimulation({ ...params, numScenarios: 100 })
      const modified = runSimulation({ ...testParams, numScenarios: 100 })
      setComparisonResult({ baseline, modified })
      setIsRunning(false)
    }, 50)
  }

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Analyse de sensibilite</h1>
          <p className="text-muted-foreground">
            Testez l&apos;impact des variations de parametres sur les scenarios.
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Aucune simulation n&apos;a encore ete lancee.
              </p>
              <Button asChild>
                <Link href="/generation">Lancer une simulation</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const years = result.scenarios[0].years

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analyse de sensibilite</h1>
        <p className="text-muted-foreground">
          Modifiez un parametre et observez l&apos;impact sur la dispersion des scenarios.
        </p>
      </div>

      {/* Parameter Adjustments */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Parametres a tester</CardTitle>
          <CardDescription>
            Ajustez les parametres puis lancez le test de sensibilite
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Demand Variance */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Variance de la demande</Label>
              <span className="text-sm text-muted-foreground">
                x{testParams.demandVarianceMultiplier.toFixed(1)} (base: x{DEFAULT_PARAMS.demandVarianceMultiplier})
              </span>
            </div>
            <Slider
              value={[testParams.demandVarianceMultiplier]}
              onValueChange={([value]) => setTestParams({ ...testParams, demandVarianceMultiplier: value })}
              min={0.5}
              max={2.5}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* CAPEX Volatility */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Volatilite CAPEX PV (σ)</Label>
              <span className="text-sm text-muted-foreground">
                {testParams.capexPvSigma.toFixed(2)} (base: {DEFAULT_PARAMS.capexPvSigma})
              </span>
            </div>
            <Slider
              value={[testParams.capexPvSigma]}
              onValueChange={([value]) => setTestParams({ ...testParams, capexPvSigma: value })}
              min={0.05}
              max={0.25}
              step={0.01}
              className="w-full"
            />
          </div>

          {/* Gas Price Volatility (GARCH alpha) */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Volatilite prix du gaz (α GARCH)</Label>
              <span className="text-sm text-muted-foreground">
                {testParams.garchAlpha.toFixed(2)} (base: {DEFAULT_PARAMS.garchAlpha})
              </span>
            </div>
            <Slider
              value={[testParams.garchAlpha]}
              onValueChange={([value]) => setTestParams({ ...testParams, garchAlpha: value })}
              min={0.05}
              max={0.3}
              step={0.01}
              className="w-full"
            />
          </div>

          {/* Solar Mean */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Moyenne solaire (α Beta)</Label>
              <span className="text-sm text-muted-foreground">
                {testParams.solarAlpha.toFixed(2)} (base: {DEFAULT_PARAMS.solarAlpha})
              </span>
            </div>
            <Slider
              value={[testParams.solarAlpha]}
              onValueChange={([value]) => setTestParams({ ...testParams, solarAlpha: value })}
              min={3}
              max={9}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* Wind Mean */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Moyenne eolienne (μ)</Label>
              <span className="text-sm text-muted-foreground">
                {testParams.windMean.toFixed(3)} (base: {DEFAULT_PARAMS.windMean})
              </span>
            </div>
            <Slider
              value={[testParams.windMean]}
              onValueChange={([value]) => setTestParams({ ...testParams, windMean: value })}
              min={0.2}
              max={0.4}
              step={0.01}
              className="w-full"
            />
          </div>

          <div className="flex gap-4">
            <Button 
              onClick={runSensitivityTest} 
              disabled={isRunning}
              className="bg-primary"
            >
              {isRunning ? "Calcul en cours..." : "Lancer le test de sensibilite"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setTestParams({ ...params, numScenarios: 100 })}
            >
              Reinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {comparisonResult && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Impact sur la demande</CardTitle>
              <CardDescription>
                Comparaison de l&apos;intervalle de confiance (Q5-Q95)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={years.map((year, i) => ({
                    year,
                    baselineQ5: comparisonResult.baseline.statistics.demand.q5[i],
                    baselineQ95: comparisonResult.baseline.statistics.demand.q95[i],
                    baselineMean: comparisonResult.baseline.statistics.demand.mean[i],
                    modifiedQ5: comparisonResult.modified.statistics.demand.q5[i],
                    modifiedQ95: comparisonResult.modified.statistics.demand.q95[i],
                    modifiedMean: comparisonResult.modified.statistics.demand.mean[i],
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="year" 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--card-foreground)'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="baselineMean" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} name="Base - Moyenne" />
                    <Line type="monotone" dataKey="baselineQ5" stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Base - Q5" />
                    <Line type="monotone" dataKey="baselineQ95" stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Base - Q95" />
                    <Line type="monotone" dataKey="modifiedMean" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Modifie - Moyenne" />
                    <Line type="monotone" dataKey="modifiedQ5" stroke="var(--chart-1)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Modifie - Q5" />
                    <Line type="monotone" dataKey="modifiedQ95" stroke="var(--chart-1)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Modifie - Q95" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Impact sur le CAPEX PV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={years.map((year, i) => ({
                      year,
                      baselineMean: comparisonResult.baseline.statistics.capexPv.mean[i],
                      modifiedMean: comparisonResult.modified.statistics.capexPv.mean[i],
                      baselineQ95: comparisonResult.baseline.statistics.capexPv.q95[i],
                      modifiedQ95: comparisonResult.modified.statistics.capexPv.q95[i],
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis 
                        dataKey="year" 
                        stroke="var(--muted-foreground)"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      />
                      <YAxis 
                        stroke="var(--muted-foreground)"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          color: 'var(--card-foreground)'
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="baselineMean" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} name="Base" />
                      <Line type="monotone" dataKey="modifiedMean" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Modifie" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Impact sur le prix du gaz</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={years.map((year, i) => ({
                      year,
                      baselineMean: comparisonResult.baseline.statistics.gasPrice.mean[i],
                      modifiedMean: comparisonResult.modified.statistics.gasPrice.mean[i],
                      baselineQ95: comparisonResult.baseline.statistics.gasPrice.q95[i],
                      modifiedQ95: comparisonResult.modified.statistics.gasPrice.q95[i],
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis 
                        dataKey="year" 
                        stroke="var(--muted-foreground)"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      />
                      <YAxis 
                        stroke="var(--muted-foreground)"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          color: 'var(--card-foreground)'
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="baselineMean" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} name="Base" />
                      <Line type="monotone" dataKey="modifiedMean" stroke="var(--chart-4)" strokeWidth={2} dot={false} name="Modifie" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Resume des ecarts</CardTitle>
              <CardDescription>
                Comparaison des statistiques en 2050
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4">Variable</th>
                      <th className="text-right py-3 px-4">Base</th>
                      <th className="text-right py-3 px-4">Modifie</th>
                      <th className="text-right py-3 px-4">Ecart</th>
                      <th className="text-right py-3 px-4">Ecart relatif</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SummaryRow
                      label="Demande moyenne 2050"
                      baseline={comparisonResult.baseline.statistics.demand.mean[comparisonResult.baseline.statistics.demand.mean.length - 1]}
                      modified={comparisonResult.modified.statistics.demand.mean[comparisonResult.modified.statistics.demand.mean.length - 1]}
                      decimals={0}
                      unit=" ktep"
                    />
                    <SummaryRow
                      label="CAPEX PV moyen 2050"
                      baseline={comparisonResult.baseline.statistics.capexPv.mean[comparisonResult.baseline.statistics.capexPv.mean.length - 1]}
                      modified={comparisonResult.modified.statistics.capexPv.mean[comparisonResult.modified.statistics.capexPv.mean.length - 1]}
                      decimals={0}
                      unit=" €/kW"
                    />
                    <SummaryRow
                      label="Prix gaz moyen 2050"
                      baseline={comparisonResult.baseline.statistics.gasPrice.mean[comparisonResult.baseline.statistics.gasPrice.mean.length - 1]}
                      modified={comparisonResult.modified.statistics.gasPrice.mean[comparisonResult.modified.statistics.gasPrice.mean.length - 1]}
                      decimals={2}
                      unit=" €/MBtu"
                    />
                    <SummaryRow
                      label="Ecart-type demande 2050"
                      baseline={comparisonResult.baseline.statistics.demand.std[comparisonResult.baseline.statistics.demand.std.length - 1]}
                      modified={comparisonResult.modified.statistics.demand.std[comparisonResult.modified.statistics.demand.std.length - 1]}
                      decimals={0}
                      unit=" ktep"
                    />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function SummaryRow({ 
  label, 
  baseline, 
  modified, 
  decimals, 
  unit 
}: { 
  label: string; 
  baseline: number; 
  modified: number; 
  decimals: number;
  unit: string;
}) {
  const diff = modified - baseline
  const diffPercent = ((diff / baseline) * 100).toFixed(1)
  
  return (
    <tr className="border-b border-border/50">
      <td className="py-3 px-4">{label}</td>
      <td className="text-right py-3 px-4 font-mono">{baseline.toFixed(decimals)}{unit}</td>
      <td className="text-right py-3 px-4 font-mono">{modified.toFixed(decimals)}{unit}</td>
      <td className="text-right py-3 px-4 font-mono">
        <span className={diff > 0 ? "text-chart-4" : "text-chart-2"}>
          {diff > 0 ? "+" : ""}{diff.toFixed(decimals)}
        </span>
      </td>
      <td className="text-right py-3 px-4 font-mono">
        <span className={diff > 0 ? "text-chart-4" : "text-chart-2"}>
          {diff > 0 ? "+" : ""}{diffPercent}%
        </span>
      </td>
    </tr>
  )
}

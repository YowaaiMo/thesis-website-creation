"use client"

import { useState } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

export default function ComparaisonPage() {
  const { result } = useSimulation()
  const [scenario1, setScenario1] = useState(0)
  const [scenario2, setScenario2] = useState(1)

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Comparaison de scenarios</h1>
          <p className="text-muted-foreground">
            Comparez deux scenarios cote a cote.
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

  const s1 = result.scenarios[scenario1]
  const s2 = result.scenarios[scenario2]
  const years = s1.years

  // Prepare comparison data
  const demandComparison = years.map((year, i) => ({
    year,
    scenario1: s1.demand.total[i],
    scenario2: s2.demand.total[i],
    mean: result.statistics.demand.mean[i],
  }))

  const solarComparison = years.map((year, i) => ({
    year,
    scenario1: s1.solarAvailability[i] * 100,
    scenario2: s2.solarAvailability[i] * 100,
  }))

  const capexComparison = years.map((year, i) => ({
    year,
    scenario1: s1.capexPv[i],
    scenario2: s2.capexPv[i],
  }))

  const gasComparison = years.map((year, i) => ({
    year,
    scenario1: s1.gasPrice[i],
    scenario2: s2.gasPrice[i],
  }))

  // Quick comparison presets
  const setPreset = (preset: string) => {
    switch (preset) {
      case "pessimist-optimist":
        setScenario1(result.extremeScenarios.pessimistic)
        setScenario2(result.extremeScenarios.minDemand)
        break
      case "max-min-demand":
        setScenario1(result.extremeScenarios.maxDemand)
        setScenario2(result.extremeScenarios.minDemand)
        break
      case "max-gas":
        setScenario1(result.extremeScenarios.maxGasPrice)
        setScenario2(0)
        break
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Comparaison de scenarios</h1>
        <p className="text-muted-foreground">
          Comparez deux scenarios pour analyser les differences de trajectoires.
        </p>
      </div>

      {/* Scenario Selectors */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Selection des scenarios</CardTitle>
          <CardDescription>
            Choisissez deux scenarios a comparer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-6">
            <div className="space-y-2">
              <Label>Scenario 1 (bleu)</Label>
              <Select
                value={scenario1.toString()}
                onValueChange={(value) => setScenario1(parseInt(value))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {result.scenarios.map((_, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      Scenario {idx + 1}
                      {idx === result.extremeScenarios.pessimistic && " (Pessimiste)"}
                      {idx === result.extremeScenarios.maxDemand && " (Max Demande)"}
                      {idx === result.extremeScenarios.minDemand && " (Min Demande)"}
                      {idx === result.extremeScenarios.maxGasPrice && " (Max Gaz)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scenario 2 (vert)</Label>
              <Select
                value={scenario2.toString()}
                onValueChange={(value) => setScenario2(parseInt(value))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {result.scenarios.map((_, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      Scenario {idx + 1}
                      {idx === result.extremeScenarios.pessimistic && " (Pessimiste)"}
                      {idx === result.extremeScenarios.maxDemand && " (Max Demande)"}
                      {idx === result.extremeScenarios.minDemand && " (Min Demande)"}
                      {idx === result.extremeScenarios.maxGasPrice && " (Max Gaz)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreset("pessimist-optimist")}>
                Pessimiste vs Optimiste
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreset("max-min-demand")}>
                Max vs Min Demande
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreset("max-gas")}>
                Max Prix Gaz vs Reference
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Demand Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Demande totale</CardTitle>
            <CardDescription>
              Comparaison des trajectoires de demande
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={demandComparison}>
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
                  <Line
                    type="monotone"
                    dataKey="scenario1"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    name={`Scenario ${scenario1 + 1}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario2"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    name={`Scenario ${scenario2 + 1}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    stroke="var(--muted-foreground)"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Moyenne"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Solar Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Disponibilite solaire</CardTitle>
            <CardDescription>
              Comparaison des facteurs de capacite PV
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={solarComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="year" 
                    stroke="var(--muted-foreground)"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="var(--muted-foreground)"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      color: 'var(--card-foreground)'
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="scenario1"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    name={`Scenario ${scenario1 + 1}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario2"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    name={`Scenario ${scenario2 + 1}`}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* CAPEX Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>CAPEX solaire</CardTitle>
            <CardDescription>
              Comparaison des couts d&apos;investissement PV
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={capexComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="year" 
                    stroke="var(--muted-foreground)"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="var(--muted-foreground)"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    tickFormatter={(value) => `${value}€`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      color: 'var(--card-foreground)'
                    }}
                    formatter={(value: number) => [`${value.toFixed(0)} €/kW`, '']}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="scenario1"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    name={`Scenario ${scenario1 + 1}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario2"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    name={`Scenario ${scenario2 + 1}`}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gas Price Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Prix du gaz</CardTitle>
            <CardDescription>
              Comparaison des trajectoires de prix
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gasComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="year" 
                    stroke="var(--muted-foreground)"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="var(--muted-foreground)"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    tickFormatter={(value) => `${value.toFixed(1)}€`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      color: 'var(--card-foreground)'
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)} €/MBtu`, '']}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="scenario1"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    name={`Scenario ${scenario1 + 1}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario2"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    name={`Scenario ${scenario2 + 1}`}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Comparison Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resume comparatif</CardTitle>
          <CardDescription>
            Valeurs cles pour les deux scenarios (horizon 2050)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">Variable</th>
                  <th className="text-right py-3 px-4 text-chart-1">Scenario {scenario1 + 1}</th>
                  <th className="text-right py-3 px-4 text-chart-2">Scenario {scenario2 + 1}</th>
                  <th className="text-right py-3 px-4">Difference</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow
                  label="Demande 2050 (ktep)"
                  value1={s1.demand.total[s1.demand.total.length - 1]}
                  value2={s2.demand.total[s2.demand.total.length - 1]}
                  format={(v) => v.toFixed(0)}
                />
                <ComparisonRow
                  label="Solaire moyen (%)"
                  value1={s1.solarAvailability.reduce((a, b) => a + b, 0) / s1.solarAvailability.length * 100}
                  value2={s2.solarAvailability.reduce((a, b) => a + b, 0) / s2.solarAvailability.length * 100}
                  format={(v) => v.toFixed(1)}
                />
                <ComparisonRow
                  label="CAPEX PV 2050 (€/kW)"
                  value1={s1.capexPv[s1.capexPv.length - 1]}
                  value2={s2.capexPv[s2.capexPv.length - 1]}
                  format={(v) => v.toFixed(0)}
                />
                <ComparisonRow
                  label="Prix Gaz 2050 (€/MBtu)"
                  value1={s1.gasPrice[s1.gasPrice.length - 1]}
                  value2={s2.gasPrice[s2.gasPrice.length - 1]}
                  format={(v) => v.toFixed(2)}
                />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ComparisonRow({ 
  label, 
  value1, 
  value2, 
  format 
}: { 
  label: string; 
  value1: number; 
  value2: number; 
  format: (v: number) => string;
}) {
  const diff = value1 - value2
  const diffPercent = ((diff / value2) * 100).toFixed(1)
  
  return (
    <tr className="border-b border-border/50">
      <td className="py-3 px-4">{label}</td>
      <td className="text-right py-3 px-4 font-mono">{format(value1)}</td>
      <td className="text-right py-3 px-4 font-mono">{format(value2)}</td>
      <td className="text-right py-3 px-4 font-mono">
        <span className={diff > 0 ? "text-chart-4" : "text-chart-2"}>
          {diff > 0 ? "+" : ""}{format(diff)} ({diffPercent}%)
        </span>
      </td>
    </tr>
  )
}

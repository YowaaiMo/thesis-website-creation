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

export default function ScenarioPage() {
  const { result } = useSimulation()
  const [selectedScenario, setSelectedScenario] = useState(0)

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Scenario individuel</h1>
          <p className="text-muted-foreground">
            Explorez un scenario particulier en detail.
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

  const scenario = result.scenarios[selectedScenario]
  const years = scenario.years

  // Prepare data for sector demand chart
  const sectorDemandData = years.map((year, i) => ({
    year,
    residential: scenario.demand.residential[i],
    industrial: scenario.demand.industrial[i],
    transport: scenario.demand.transport[i],
    agriculture: scenario.demand.agriculture[i],
    tertiary: scenario.demand.tertiary[i],
  }))

  // Prepare data for total demand
  const totalDemandData = years.map((year, i) => ({
    year,
    total: scenario.demand.total[i],
    mean: result.statistics.demand.mean[i],
  }))

  // Prepare data for availability
  const availabilityData = years.map((year, i) => ({
    year,
    solar: scenario.solarAvailability[i] * 100,
    wind: scenario.windAvailability[i] * 100,
  }))

  // Prepare data for costs
  const costData = years.map((year, i) => ({
    year,
    capexPv: scenario.capexPv[i],
    gasPrice: scenario.gasPrice[i] * 50, // Scale for visibility
  }))

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Scenario individuel</h1>
        <p className="text-muted-foreground">
          Explorez un scenario particulier ω ∈ {'{'}1, ..., {result.scenarios.length}{'}'}
        </p>
      </div>

      {/* Scenario Selector */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Selection du scenario</CardTitle>
          <CardDescription>
            Choisissez un scenario pour visualiser sa trajectoire complete
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="scenario">Scenario ω =</Label>
            <Select
              value={selectedScenario.toString()}
              onValueChange={(value) => setSelectedScenario(parseInt(value))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selectionnez un scenario" />
              </SelectTrigger>
              <SelectContent>
                {result.scenarios.map((_, idx) => (
                  <SelectItem key={idx} value={idx.toString()}>
                    Scenario {idx + 1}
                    {idx === result.extremeScenarios.pessimistic && " (Pessimiste)"}
                    {idx === result.extremeScenarios.maxDemand && " (Max Demande)"}
                    {idx === result.extremeScenarios.minDemand && " (Min Demande)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedScenario(result.extremeScenarios.pessimistic)}
              >
                Pessimiste
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedScenario(result.extremeScenarios.maxDemand)}
              >
                Max Demande
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedScenario(result.extremeScenarios.minDemand)}
              >
                Min Demande
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Total Demand */}
        <Card>
          <CardHeader>
            <CardTitle>Demande totale</CardTitle>
            <CardDescription>
              Scenario {selectedScenario + 1} vs Moyenne
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={totalDemandData}>
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
                    dataKey="total"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    name="Scenario"
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

        {/* Sector Demand */}
        <Card>
          <CardHeader>
            <CardTitle>Demande par secteur</CardTitle>
            <CardDescription>
              Decomposition sectorielle du scenario {selectedScenario + 1}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sectorDemandData}>
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
                  <Line type="monotone" dataKey="residential" stroke="var(--chart-1)" strokeWidth={1.5} dot={false} name="Residentiel" />
                  <Line type="monotone" dataKey="industrial" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} name="Industriel" />
                  <Line type="monotone" dataKey="transport" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} name="Transport" />
                  <Line type="monotone" dataKey="agriculture" stroke="var(--chart-4)" strokeWidth={1.5} dot={false} name="Agriculture" />
                  <Line type="monotone" dataKey="tertiary" stroke="var(--chart-5)" strokeWidth={1.5} dot={false} name="Tertiaire" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Renewable Availability */}
        <Card>
          <CardHeader>
            <CardTitle>Disponibilite renouvelable</CardTitle>
            <CardDescription>
              Facteurs de capacite solaire et eolien (%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={availabilityData}>
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
                    dataKey="solar"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                    name="Solaire h_PV"
                  />
                  <Line
                    type="monotone"
                    dataKey="wind"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    name="Eolien h_Wind"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Costs */}
        <Card>
          <CardHeader>
            <CardTitle>Couts energetiques</CardTitle>
            <CardDescription>
              CAPEX PV (€/kW) et Prix du gaz (€/MBtu)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={costData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="year" 
                    stroke="var(--muted-foreground)"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="var(--chart-2)"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    tickFormatter={(value) => `${value}€`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--chart-4)"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 50).toFixed(1)}€`}
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
                    yAxisId="left"
                    type="monotone"
                    dataKey="capexPv"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    name="CAPEX PV (€/kW)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="gasPrice"
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    dot={false}
                    name="Prix Gaz (scaled)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats for this scenario */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resume du scenario {selectedScenario + 1}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Demande 2050"
              value={`${(scenario.demand.total[scenario.demand.total.length - 1] / 1000).toFixed(1)}k ktep`}
            />
            <StatCard
              label="Solaire moyen"
              value={`${(scenario.solarAvailability.reduce((a, b) => a + b, 0) / scenario.solarAvailability.length * 100).toFixed(1)}%`}
            />
            <StatCard
              label="CAPEX PV 2050"
              value={`${scenario.capexPv[scenario.capexPv.length - 1].toFixed(0)} €/kW`}
            />
            <StatCard
              label="Prix Gaz 2050"
              value={`${scenario.gasPrice[scenario.gasPrice.length - 1].toFixed(2)} €/MBtu`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-secondary/30 border border-border">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-primary">{value}</p>
    </div>
  )
}

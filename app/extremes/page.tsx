"use client"

import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertTriangle, TrendingUp, TrendingDown, Flame, Sun } from "lucide-react"
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

export default function ExtremesPage() {
  const { result } = useSimulation()

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Scenarios extremes</h1>
          <p className="text-muted-foreground">
            Identification automatique des scenarios extremes.
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

  const { extremeScenarios, scenarios, statistics } = result
  const years = scenarios[0].years

  // Get extreme scenarios data
  const pessimistic = scenarios[extremeScenarios.pessimistic]
  const maxDemand = scenarios[extremeScenarios.maxDemand]
  const minDemand = scenarios[extremeScenarios.minDemand]
  const maxGas = scenarios[extremeScenarios.maxGasPrice]
  const minCapex = scenarios[extremeScenarios.minCapexPv]

  // Prepare comparison data
  const demandComparison = years.map((year, i) => ({
    year,
    maxDemand: maxDemand.demand.total[i],
    minDemand: minDemand.demand.total[i],
    mean: statistics.demand.mean[i],
    pessimistic: pessimistic.demand.total[i],
  }))

  const gasComparison = years.map((year, i) => ({
    year,
    maxGas: maxGas.gasPrice[i],
    mean: statistics.gasPrice.mean[i],
    pessimistic: pessimistic.gasPrice[i],
  }))

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Scenarios extremes</h1>
        <p className="text-muted-foreground">
          Identification automatique des scenarios critiques pour la planification robuste.
        </p>
      </div>

      {/* Extreme Scenarios Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <ExtremeCard
          icon={AlertTriangle}
          title="Scenario pessimiste"
          scenarioId={extremeScenarios.pessimistic + 1}
          description="Forte demande + faible renouvelable + gaz cher"
          color="text-chart-4"
        />
        <ExtremeCard
          icon={TrendingUp}
          title="Demande maximale"
          scenarioId={extremeScenarios.maxDemand + 1}
          description="Plus haute demande energetique cumulee"
          color="text-chart-4"
        />
        <ExtremeCard
          icon={TrendingDown}
          title="Demande minimale"
          scenarioId={extremeScenarios.minDemand + 1}
          description="Plus basse demande energetique cumulee"
          color="text-chart-2"
        />
        <ExtremeCard
          icon={Flame}
          title="Prix gaz maximum"
          scenarioId={extremeScenarios.maxGasPrice + 1}
          description="Plus haute moyenne du prix du gaz"
          color="text-chart-4"
        />
        <ExtremeCard
          icon={Sun}
          title="CAPEX PV minimum"
          scenarioId={extremeScenarios.minCapexPv + 1}
          description="Cout PV le plus bas en 2050"
          color="text-chart-2"
        />
      </div>

      {/* Pessimistic Scenario Detail */}
      <Card className="mb-6 border-chart-4/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-chart-4" />
            <CardTitle>Scenario pessimiste en detail</CardTitle>
          </div>
          <CardDescription>
            Ce scenario combine une forte demande, une faible disponibilite renouvelable et un prix du gaz eleve.
            Il represente le pire cas pour la planification energetique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Demande 2050"
              value={`${(pessimistic.demand.total[pessimistic.demand.total.length - 1] / 1000).toFixed(1)}k`}
              unit="ktep"
              comparison={`Moyenne: ${(statistics.demand.mean[statistics.demand.mean.length - 1] / 1000).toFixed(1)}k`}
            />
            <StatCard
              label="Solaire moyen"
              value={`${(pessimistic.solarAvailability.reduce((a, b) => a + b, 0) / pessimistic.solarAvailability.length * 100).toFixed(1)}`}
              unit="%"
              comparison={`Moyenne: ${(statistics.solarAvailability.mean.reduce((a, b) => a + b, 0) / statistics.solarAvailability.mean.length * 100).toFixed(1)}%`}
            />
            <StatCard
              label="Prix Gaz 2050"
              value={`${pessimistic.gasPrice[pessimistic.gasPrice.length - 1].toFixed(2)}`}
              unit="€/MBtu"
              comparison={`Moyenne: ${statistics.gasPrice.mean[statistics.gasPrice.mean.length - 1].toFixed(2)}€`}
            />
            <StatCard
              label="CAPEX PV 2050"
              value={`${pessimistic.capexPv[pessimistic.capexPv.length - 1].toFixed(0)}`}
              unit="€/kW"
              comparison={`Moyenne: ${statistics.capexPv.mean[statistics.capexPv.mean.length - 1].toFixed(0)}€`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Comparison Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Comparaison des demandes extremes</CardTitle>
            <CardDescription>
              Trajectoires de demande pour les scenarios extremes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
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
                    dataKey="maxDemand"
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    dot={false}
                    name="Max Demande"
                  />
                  <Line
                    type="monotone"
                    dataKey="minDemand"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    name="Min Demande"
                  />
                  <Line
                    type="monotone"
                    dataKey="pessimistic"
                    stroke="var(--chart-5)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Pessimiste"
                  />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    stroke="var(--muted-foreground)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Moyenne"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prix du gaz - Scenarios extremes</CardTitle>
            <CardDescription>
              Trajectoires de prix pour le scenario pessimiste et max gaz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
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
                    dataKey="maxGas"
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    dot={false}
                    name="Max Prix Gaz"
                  />
                  <Line
                    type="monotone"
                    dataKey="pessimistic"
                    stroke="var(--chart-5)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Pessimiste"
                  />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    stroke="var(--muted-foreground)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Moyenne"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Implications */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Implications pour la planification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2 text-chart-4">Risques identifies</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Ecart de demande entre scenarios extremes: {((maxDemand.demand.total[maxDemand.demand.total.length - 1] - minDemand.demand.total[minDemand.demand.total.length - 1]) / 1000).toFixed(0)}k ktep</li>
                <li>• Volatilite du prix du gaz: jusqu&apos;a {maxGas.gasPrice[maxGas.gasPrice.length - 1].toFixed(2)} €/MBtu</li>
                <li>• Le scenario pessimiste cumule plusieurs facteurs defavorables</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-chart-2">Recommandations</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Dimensionner les capacites pour le scenario pessimiste</li>
                <li>• Diversifier les sources d&apos;energie pour reduire la dependance au gaz</li>
                <li>• Prevoir des marges de securite dans la planification</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ExtremeCard({ 
  icon: Icon, 
  title, 
  scenarioId, 
  description, 
  color 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  title: string; 
  scenarioId: number; 
  description: string; 
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-secondary ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium">{title}</h3>
            <p className="text-2xl font-bold mt-1">Scenario {scenarioId}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({ label, value, unit, comparison }: { 
  label: string; 
  value: string; 
  unit: string; 
  comparison: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-secondary/30 border border-border">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{comparison}</p>
    </div>
  )
}

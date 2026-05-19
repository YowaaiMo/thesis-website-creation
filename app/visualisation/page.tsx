"use client"

import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Legend
} from "recharts"

export default function VisualisationPage() {
  const { result } = useSimulation()

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Visualisation globale</h1>
          <p className="text-muted-foreground">
            Visualisez l&apos;ensemble des scenarios generes.
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

  // Prepare data for charts
  const demandData = years.map((year, i) => ({
    year,
    mean: result.statistics.demand.mean[i],
    q5: result.statistics.demand.q5[i],
    q95: result.statistics.demand.q95[i],
    min: result.statistics.demand.min[i],
    max: result.statistics.demand.max[i],
  }))

  const solarData = years.map((year, i) => ({
    year,
    mean: result.statistics.solarAvailability.mean[i] * 100,
    q5: result.statistics.solarAvailability.q5[i] * 100,
    q95: result.statistics.solarAvailability.q95[i] * 100,
  }))

  const windData = years.map((year, i) => ({
    year,
    mean: result.statistics.windAvailability.mean[i] * 100,
    q5: result.statistics.windAvailability.q5[i] * 100,
    q95: result.statistics.windAvailability.q95[i] * 100,
  }))

  const capexData = years.map((year, i) => ({
    year,
    mean: result.statistics.capexPv.mean[i],
    q5: result.statistics.capexPv.q5[i],
    q95: result.statistics.capexPv.q95[i],
  }))

  const gasData = years.map((year, i) => ({
    year,
    mean: result.statistics.gasPrice.mean[i],
    q5: result.statistics.gasPrice.q5[i],
    q95: result.statistics.gasPrice.q95[i],
  }))

  // Add individual scenario trajectories (sample for performance)
  const sampleSize = Math.min(50, result.scenarios.length)
  const sampledIndices = Array.from({ length: sampleSize }, (_, i) => 
    Math.floor(i * result.scenarios.length / sampleSize)
  )

  const demandWithTrajectories = years.map((year, i) => {
    const data: Record<string, number> = { year, mean: result.statistics.demand.mean[i] }
    sampledIndices.forEach((idx, j) => {
      data[`s${j}`] = result.scenarios[idx].demand.total[i]
    })
    return data
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Visualisation globale</h1>
        <p className="text-muted-foreground">
          Nuage de scenarios avec moyenne et intervalles de confiance (5% - 95%)
        </p>
      </div>

      <Tabs defaultValue="demand" className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
          <TabsTrigger value="demand">Demande</TabsTrigger>
          <TabsTrigger value="solar">Solaire</TabsTrigger>
          <TabsTrigger value="wind">Eolien</TabsTrigger>
          <TabsTrigger value="capex">CAPEX PV</TabsTrigger>
          <TabsTrigger value="gas">Prix Gaz</TabsTrigger>
        </TabsList>

        <TabsContent value="demand">
          <Card>
            <CardHeader>
              <CardTitle>Demande totale</CardTitle>
              <CardDescription>
                Evolution de la demande energetique totale (ktep) avec {result.scenarios.length} trajectoires
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={demandWithTrajectories}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="year" 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--card-foreground)'
                      }}
                      formatter={(value: number) => [`${value.toFixed(0)} ktep`, '']}
                    />
                    {/* Individual trajectories in background */}
                    {sampledIndices.map((_, j) => (
                      <Line
                        key={j}
                        type="monotone"
                        dataKey={`s${j}`}
                        stroke="var(--chart-1)"
                        strokeWidth={0.5}
                        strokeOpacity={0.2}
                        dot={false}
                      />
                    ))}
                    {/* Mean line */}
                    <Line
                      type="monotone"
                      dataKey="mean"
                      stroke="var(--chart-2)"
                      strokeWidth={3}
                      dot={false}
                      name="Moyenne"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="solar">
          <Card>
            <CardHeader>
              <CardTitle>Disponibilite solaire</CardTitle>
              <CardDescription>
                Facteur de capacite solaire h_PV (%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={solarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="year" 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
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
                    <Area
                      type="monotone"
                      dataKey="q95"
                      fill="var(--chart-3)"
                      fillOpacity={0.3}
                      stroke="none"
                      name="Q95"
                    />
                    <Area
                      type="monotone"
                      dataKey="q5"
                      fill="var(--background)"
                      stroke="none"
                      name="Q5"
                    />
                    <Line
                      type="monotone"
                      dataKey="mean"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      dot={false}
                      name="Moyenne"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wind">
          <Card>
            <CardHeader>
              <CardTitle>Disponibilite eolienne</CardTitle>
              <CardDescription>
                Facteur de capacite eolien h_Wind (%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={windData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="year" 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
                      domain={[0, 50]}
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
                    <Area
                      type="monotone"
                      dataKey="q95"
                      fill="var(--chart-1)"
                      fillOpacity={0.3}
                      stroke="none"
                      name="Q95"
                    />
                    <Area
                      type="monotone"
                      dataKey="q5"
                      fill="var(--background)"
                      stroke="none"
                      name="Q5"
                    />
                    <Line
                      type="monotone"
                      dataKey="mean"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={false}
                      name="Moyenne"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capex">
          <Card>
            <CardHeader>
              <CardTitle>CAPEX solaire</CardTitle>
              <CardDescription>
                Cout d&apos;investissement PV (€/kW) - Mouvement brownien geometrique
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={capexData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="year" 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
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
                    <Area
                      type="monotone"
                      dataKey="q95"
                      fill="var(--chart-2)"
                      fillOpacity={0.3}
                      stroke="none"
                      name="Q95"
                    />
                    <Area
                      type="monotone"
                      dataKey="q5"
                      fill="var(--background)"
                      stroke="none"
                      name="Q5"
                    />
                    <Line
                      type="monotone"
                      dataKey="mean"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={false}
                      name="Moyenne"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gas">
          <Card>
            <CardHeader>
              <CardTitle>Prix du gaz</CardTitle>
              <CardDescription>
                Evolution du prix du gaz (€/MBtu) - Modele GARCH(1,1)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={gasData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="year" 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis 
                      stroke="var(--muted-foreground)"
                      tick={{ fill: 'var(--muted-foreground)' }}
                      tickFormatter={(value) => `${value}€`}
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
                    <Area
                      type="monotone"
                      dataKey="q95"
                      fill="var(--chart-4)"
                      fillOpacity={0.3}
                      stroke="none"
                      name="Q95"
                    />
                    <Area
                      type="monotone"
                      dataKey="q5"
                      fill="var(--background)"
                      stroke="none"
                      name="Q5"
                    />
                    <Line
                      type="monotone"
                      dataKey="mean"
                      stroke="var(--chart-4)"
                      strokeWidth={2}
                      dot={false}
                      name="Moyenne"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function StatistiquesPage() {
  const { result, params } = useSimulation()

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Resume statistique</h1>
          <p className="text-muted-foreground">
            Statistiques descriptives des scenarios generes.
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

  const { statistics } = result
  const lastIdx = statistics.demand.mean.length - 1

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Resume statistique</h1>
        <p className="text-muted-foreground">
          Statistiques descriptives calculees sur {result.scenarios.length} scenarios 
          ({params.startYear}-{params.endYear})
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="Scenarios"
          value={result.scenarios.length.toString()}
          subtitle={`${(result.computationTime / 1000).toFixed(2)}s de calcul`}
        />
        <SummaryCard
          title="Horizon"
          value={`${params.endYear - params.startYear + 1} ans`}
          subtitle={`${params.startYear} - ${params.endYear}`}
        />
        <SummaryCard
          title="Points de donnees"
          value={(result.scenarios.length * (params.endYear - params.startYear + 1)).toLocaleString()}
          subtitle="par variable"
        />
        <SummaryCard
          title="Variables"
          value="7"
          subtitle="variables stochastiques"
        />
      </div>

      {/* Statistics Tables */}
      <div className="space-y-6">
        {/* Demand Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Demande totale (ktep)</CardTitle>
            <CardDescription>Statistiques de la demande energetique totale</CardDescription>
          </CardHeader>
          <CardContent>
            <StatsTable stats={statistics.demand} startYear={params.startYear} />
          </CardContent>
        </Card>

        {/* Solar Availability */}
        <Card>
          <CardHeader>
            <CardTitle>Disponibilite solaire (%)</CardTitle>
            <CardDescription>Facteur de capacite PV h_PV</CardDescription>
          </CardHeader>
          <CardContent>
            <StatsTable 
              stats={statistics.solarAvailability} 
              startYear={params.startYear}
              multiplier={100}
              decimals={1}
            />
          </CardContent>
        </Card>

        {/* Wind Availability */}
        <Card>
          <CardHeader>
            <CardTitle>Disponibilite eolienne (%)</CardTitle>
            <CardDescription>Facteur de capacite h_Wind</CardDescription>
          </CardHeader>
          <CardContent>
            <StatsTable 
              stats={statistics.windAvailability} 
              startYear={params.startYear}
              multiplier={100}
              decimals={1}
            />
          </CardContent>
        </Card>

        {/* CAPEX PV */}
        <Card>
          <CardHeader>
            <CardTitle>CAPEX solaire (€/kW)</CardTitle>
            <CardDescription>Cout d&apos;investissement PV</CardDescription>
          </CardHeader>
          <CardContent>
            <StatsTable 
              stats={statistics.capexPv} 
              startYear={params.startYear}
              decimals={0}
            />
          </CardContent>
        </Card>

        {/* Gas Price */}
        <Card>
          <CardHeader>
            <CardTitle>Prix du gaz (€/MBtu)</CardTitle>
            <CardDescription>Prix du gaz naturel</CardDescription>
          </CardHeader>
          <CardContent>
            <StatsTable 
              stats={statistics.gasPrice} 
              startYear={params.startYear}
              decimals={2}
            />
          </CardContent>
        </Card>
      </div>

      {/* Final Year Summary */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Resume pour {params.endYear}</CardTitle>
          <CardDescription>Statistiques de l&apos;annee finale de l&apos;horizon</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">Variable</th>
                  <th className="text-right py-3 px-4">Moyenne</th>
                  <th className="text-right py-3 px-4">Ecart-type</th>
                  <th className="text-right py-3 px-4">Min</th>
                  <th className="text-right py-3 px-4">Max</th>
                  <th className="text-right py-3 px-4">Q5%</th>
                  <th className="text-right py-3 px-4">Q95%</th>
                </tr>
              </thead>
              <tbody>
                <FinalYearRow
                  label="Demande totale (ktep)"
                  stats={statistics.demand}
                  lastIdx={lastIdx}
                  decimals={0}
                />
                <FinalYearRow
                  label="Solaire (%)"
                  stats={statistics.solarAvailability}
                  lastIdx={lastIdx}
                  multiplier={100}
                  decimals={1}
                />
                <FinalYearRow
                  label="Eolien (%)"
                  stats={statistics.windAvailability}
                  lastIdx={lastIdx}
                  multiplier={100}
                  decimals={1}
                />
                <FinalYearRow
                  label="CAPEX PV (€/kW)"
                  stats={statistics.capexPv}
                  lastIdx={lastIdx}
                  decimals={0}
                />
                <FinalYearRow
                  label="Prix Gaz (€/MBtu)"
                  stats={statistics.gasPrice}
                  lastIdx={lastIdx}
                  decimals={2}
                />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

interface VariableStats {
  mean: number[]
  std: number[]
  min: number[]
  max: number[]
  q5: number[]
  q95: number[]
}

function StatsTable({ 
  stats, 
  startYear, 
  multiplier = 1, 
  decimals = 0 
}: { 
  stats: VariableStats;
  startYear: number;
  multiplier?: number;
  decimals?: number;
}) {
  // Show selected years (every 5 years + first and last)
  const years = stats.mean.map((_, i) => startYear + i)
  const selectedIndices = [0, 5, 10, 15, 20, 26].filter(i => i < stats.mean.length)

  const formatValue = (val: number) => (val * multiplier).toFixed(decimals)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3">Annee</th>
            <th className="text-right py-2 px-3">Moyenne</th>
            <th className="text-right py-2 px-3">Ecart-type</th>
            <th className="text-right py-2 px-3">Min</th>
            <th className="text-right py-2 px-3">Max</th>
            <th className="text-right py-2 px-3">Q5%</th>
            <th className="text-right py-2 px-3">Q95%</th>
          </tr>
        </thead>
        <tbody>
          {selectedIndices.map((idx) => (
            <tr key={idx} className="border-b border-border/50">
              <td className="py-2 px-3 font-medium">{years[idx]}</td>
              <td className="text-right py-2 px-3 font-mono">{formatValue(stats.mean[idx])}</td>
              <td className="text-right py-2 px-3 font-mono text-muted-foreground">{formatValue(stats.std[idx])}</td>
              <td className="text-right py-2 px-3 font-mono text-muted-foreground">{formatValue(stats.min[idx])}</td>
              <td className="text-right py-2 px-3 font-mono text-muted-foreground">{formatValue(stats.max[idx])}</td>
              <td className="text-right py-2 px-3 font-mono">{formatValue(stats.q5[idx])}</td>
              <td className="text-right py-2 px-3 font-mono">{formatValue(stats.q95[idx])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FinalYearRow({ 
  label, 
  stats, 
  lastIdx, 
  multiplier = 1, 
  decimals = 0 
}: { 
  label: string;
  stats: VariableStats;
  lastIdx: number;
  multiplier?: number;
  decimals?: number;
}) {
  const format = (val: number) => (val * multiplier).toFixed(decimals)
  
  return (
    <tr className="border-b border-border/50">
      <td className="py-3 px-4 font-medium">{label}</td>
      <td className="text-right py-3 px-4 font-mono">{format(stats.mean[lastIdx])}</td>
      <td className="text-right py-3 px-4 font-mono text-muted-foreground">{format(stats.std[lastIdx])}</td>
      <td className="text-right py-3 px-4 font-mono text-muted-foreground">{format(stats.min[lastIdx])}</td>
      <td className="text-right py-3 px-4 font-mono text-muted-foreground">{format(stats.max[lastIdx])}</td>
      <td className="text-right py-3 px-4 font-mono">{format(stats.q5[lastIdx])}</td>
      <td className="text-right py-3 px-4 font-mono">{format(stats.q95[lastIdx])}</td>
    </tr>
  )
}

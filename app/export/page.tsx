"use client"

import { useSimulation } from "@/lib/simulation-context"
import { exportToCSV, exportToJSON } from "@/lib/monte-carlo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Download, FileText, FileJson, FileSpreadsheet } from "lucide-react"

export default function ExportPage() {
  const { result, params } = useSimulation()

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Export des scenarios</h1>
          <p className="text-muted-foreground">
            Exportez vos scenarios pour l&apos;optimisation.
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

  const downloadCSV = () => {
    const csv = exportToCSV(result)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `monte_carlo_scenarios_${params.numScenarios}s_${params.startYear}-${params.endYear}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const downloadJSON = () => {
    const json = exportToJSON(result)
    const blob = new Blob([json], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `monte_carlo_scenarios_${params.numScenarios}s_${params.startYear}-${params.endYear}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const downloadStatisticsCSV = () => {
    const years = result.scenarios[0].years
    const headers = ['year', 'demand_mean', 'demand_std', 'demand_q5', 'demand_q95', 
      'solar_mean', 'solar_std', 'wind_mean', 'wind_std', 
      'capex_mean', 'capex_std', 'gas_mean', 'gas_std']
    
    const rows = [headers.join(',')]
    
    years.forEach((year, i) => {
      const row = [
        year,
        result.statistics.demand.mean[i].toFixed(2),
        result.statistics.demand.std[i].toFixed(2),
        result.statistics.demand.q5[i].toFixed(2),
        result.statistics.demand.q95[i].toFixed(2),
        (result.statistics.solarAvailability.mean[i] * 100).toFixed(2),
        (result.statistics.solarAvailability.std[i] * 100).toFixed(2),
        (result.statistics.windAvailability.mean[i] * 100).toFixed(2),
        (result.statistics.windAvailability.std[i] * 100).toFixed(2),
        result.statistics.capexPv.mean[i].toFixed(2),
        result.statistics.capexPv.std[i].toFixed(2),
        result.statistics.gasPrice.mean[i].toFixed(2),
        result.statistics.gasPrice.std[i].toFixed(2),
      ]
      rows.push(row.join(','))
    })
    
    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `monte_carlo_statistics_${params.startYear}-${params.endYear}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const totalDataPoints = result.scenarios.length * result.scenarios[0].years.length

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Export des scenarios</h1>
        <p className="text-muted-foreground">
          Exportez les scenarios generes pour les utiliser dans le module d&apos;optimisation.
        </p>
      </div>

      {/* Export Summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Donnees disponibles</CardTitle>
          <CardDescription>Resume de la simulation a exporter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Scenarios" value={result.scenarios.length.toString()} />
            <StatCard label="Annees" value={(params.endYear - params.startYear + 1).toString()} />
            <StatCard label="Variables" value="7" />
            <StatCard label="Points de donnees" value={totalDataPoints.toLocaleString()} />
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* CSV Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">CSV</CardTitle>
                <CardDescription>Format tabulaire</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Format long avec une ligne par (scenario, annee). Compatible avec Excel, Python/Pandas, R.
            </p>
            <Button onClick={downloadCSV} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Telecharger CSV
            </Button>
          </CardContent>
        </Card>

        {/* JSON Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileJson className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">JSON</CardTitle>
                <CardDescription>Format structure</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Format hierarchique avec metadata, scenarios et statistiques. Ideal pour l&apos;integration API.
            </p>
            <Button onClick={downloadJSON} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Telecharger JSON
            </Button>
          </CardContent>
        </Card>

        {/* Statistics Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Statistiques</CardTitle>
                <CardDescription>Resume agregé</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Moyennes, ecarts-types et quantiles par annee. Format CSV compact.
            </p>
            <Button onClick={downloadStatisticsCSV} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Telecharger Stats
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* File Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Structure des fichiers</CardTitle>
          <CardDescription>Format des donnees exportees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CSV Structure */}
          <div>
            <h4 className="font-medium mb-2">Format CSV (scenarios complets)</h4>
            <div className="bg-secondary/30 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs font-mono">
{`scenario,year,demand_total,demand_residential,demand_industrial,demand_transport,demand_agriculture,demand_tertiary,h_PV,h_Wind,capex_PV,gas_price,op_cost_gas
0,2024,14235.67,3614.88,4045.29,3291.95,0.00,0.00,0.6012,0.2958,800.00,4.50,19.50
0,2025,15123.45,3836.40,3944.23,3249.99,39.77,141.29,0.5842,0.3012,762.34,4.59,19.59
...`}
              </pre>
            </div>
          </div>

          {/* JSON Structure */}
          <div>
            <h4 className="font-medium mb-2">Format JSON (structure complete)</h4>
            <div className="bg-secondary/30 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs font-mono">
{`{
  "metadata": {
    "numScenarios": 300,
    "years": [2024, 2025, ..., 2050],
    "computationTime": 1234.56
  },
  "scenarios": [
    {
      "id": 0,
      "years": [2024, 2025, ...],
      "demand": { "residential": [...], "industrial": [...], ... },
      "solarAvailability": [...],
      "windAvailability": [...],
      "capexPv": [...],
      "gasPrice": [...]
    },
    ...
  ],
  "statistics": { ... },
  "extremeScenarios": { ... }
}`}
              </pre>
            </div>
          </div>

          {/* Usage Instructions */}
          <div>
            <h4 className="font-medium mb-2">Utilisation pour l&apos;optimisation</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Les fichiers exportes peuvent etre directement utilises comme entrees du module d&apos;optimisation :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>CSV : Chargez avec pandas.read_csv() ou Excel</li>
                <li>JSON : Chargez avec json.load() en Python</li>
                <li>Les variables de decision ne sont PAS incluses (elles seront calculees par le solveur)</li>
                <li>Seuls les parametres stochastiques sont fournis</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variables Exported */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Variables exportees</CardTitle>
          <CardDescription>Liste des parametres stochastiques inclus</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <VariableRow variable="demand_total" description="Demande totale (ktep)" />
            <VariableRow variable="demand_residential" description="Demande residentielle" />
            <VariableRow variable="demand_industrial" description="Demande industrielle" />
            <VariableRow variable="demand_transport" description="Demande transport" />
            <VariableRow variable="demand_agriculture" description="Demande agriculture" />
            <VariableRow variable="demand_tertiary" description="Demande tertiaire" />
            <VariableRow variable="h_PV" description="Disponibilite solaire [0-1]" />
            <VariableRow variable="h_Wind" description="Disponibilite eolienne [0-1]" />
            <VariableRow variable="capex_PV" description="CAPEX PV (€/kW)" />
            <VariableRow variable="gas_price" description="Prix du gaz (€/MBtu)" />
            <VariableRow variable="op_cost_gas" description="Cout op. gaz (€/MWh)" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-secondary/30">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function VariableRow({ variable, description }: { variable: string; description: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/20">
      <code className="text-sm font-mono">{variable}</code>
      <span className="text-sm text-muted-foreground">{description}</span>
    </div>
  )
}

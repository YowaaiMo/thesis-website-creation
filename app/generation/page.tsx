"use client"

import Link from "next/link"
import { useSimulation } from "@/lib/simulation-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, CheckCircle, Loader2, BarChart3, Download } from "lucide-react"

export default function GenerationPage() {
  const { params, result, isRunning, runMonteCarlo } = useSimulation()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Generation Monte Carlo</h1>
        <p className="text-muted-foreground">
          Lancez la simulation pour generer les scenarios stochastiques du systeme energetique algerien.
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
            <ParamDisplay label="Scenarios" value={params.numScenarios.toString()} />
            <ParamDisplay label="Horizon" value={`${params.startYear} - ${params.endYear}`} />
            <ParamDisplay label="Annees" value={(params.endYear - params.startYear + 1).toString()} />
            <ParamDisplay label="Points de donnees" value={(params.numScenarios * (params.endYear - params.startYear + 1)).toLocaleString()} />
          </div>
        </CardContent>
      </Card>

      {/* Generation Button */}
      <div className="flex justify-center mb-8">
        <Button 
          size="lg" 
          onClick={runMonteCarlo} 
          disabled={isRunning}
          className="h-16 px-12 text-lg bg-primary hover:bg-primary/90"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Generation en cours...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              Generer les scenarios
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Success Message */}
          <Card className="border-accent bg-accent/10">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Simulation terminee avec succes</h3>
                  <p className="text-muted-foreground">
                    {result.scenarios.length} scenarios generes sur l&apos;horizon {params.startYear}-{params.endYear} 
                    en {(result.computationTime / 1000).toFixed(2)} secondes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generated Variables */}
          <Card>
            <CardHeader>
              <CardTitle>Variables generees</CardTitle>
              <CardDescription>Resume des donnees simulees</CardDescription>
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

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <Button asChild className="gap-2">
              <Link href="/visualisation">
                <BarChart3 className="h-4 w-4" />
                Visualiser les resultats
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/export">
                <Download className="h-4 w-4" />
                Exporter les donnees
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/statistiques">
                Resume statistique
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Instructions if no result */}
      {!result && !isRunning && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <p className="mb-4">
                Cliquez sur le bouton ci-dessus pour lancer la simulation Monte Carlo.
              </p>
              <p className="text-sm">
                La simulation generera les parametres incertains suivants pour chaque scenario:
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <code className="px-2 py-1 bg-secondary rounded text-sm">D_{'{s,t}'}(ω)</code>
                <code className="px-2 py-1 bg-secondary rounded text-sm">h_{'{PV,t}'}(ω)</code>
                <code className="px-2 py-1 bg-secondary rounded text-sm">h_{'{Wind,t}'}(ω)</code>
                <code className="px-2 py-1 bg-secondary rounded text-sm">c^inv_{'{PV,t}'}(ω)</code>
                <code className="px-2 py-1 bg-secondary rounded text-sm">P^gaz_t(ω)</code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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
  name: string; 
  description: string; 
  meanValue: string; 
  unit: string;
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

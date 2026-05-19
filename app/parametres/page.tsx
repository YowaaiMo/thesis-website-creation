"use client"

import { useSimulation } from "@/lib/simulation-context"
import { DEFAULT_PARAMS } from "@/lib/monte-carlo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RotateCcw } from "lucide-react"

export default function ParametresPage() {
  const { params, setParams, resetParams } = useSimulation()

  const updateParam = <K extends keyof typeof params>(key: K, value: typeof params[K]) => {
    setParams({ ...params, [key]: value })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Parametres de simulation</h1>
        <p className="text-muted-foreground">
          Configurez les parametres de la simulation Monte Carlo. Les valeurs par defaut sont calibrees 
          sur les donnees historiques de l&apos;etude statistique.
        </p>
      </div>

      <div className="flex justify-end mb-6">
        <Button variant="outline" onClick={resetParams} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reinitialiser
        </Button>
      </div>

      <div className="grid gap-6">
        {/* General Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Parametres generaux</CardTitle>
            <CardDescription>Nombre de scenarios et horizon temporel</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numScenarios">Nombre de scenarios (S)</Label>
              <Input
                id="numScenarios"
                type="number"
                value={params.numScenarios}
                onChange={(e) => updateParam("numScenarios", parseInt(e.target.value) || 100)}
                min={10}
                max={1000}
              />
              <p className="text-xs text-muted-foreground">Recommande: 100, 300 ou 500</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startYear">Annee de debut</Label>
              <Input
                id="startYear"
                type="number"
                value={params.startYear}
                onChange={(e) => updateParam("startYear", parseInt(e.target.value) || 2024)}
                min={2020}
                max={2030}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endYear">Annee de fin</Label>
              <Input
                id="endYear"
                type="number"
                value={params.endYear}
                onChange={(e) => updateParam("endYear", parseInt(e.target.value) || 2050)}
                min={2030}
                max={2100}
              />
            </div>
          </CardContent>
        </Card>

        {/* Demand Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Demande energetique</CardTitle>
            <CardDescription>Parametres de la variance de la demande sectorielle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="demandVariance">Multiplicateur de variance</Label>
              <Input
                id="demandVariance"
                type="number"
                step="0.1"
                value={params.demandVarianceMultiplier}
                onChange={(e) => updateParam("demandVarianceMultiplier", parseFloat(e.target.value) || 1)}
                min={0.1}
                max={3}
              />
              <p className="text-xs text-muted-foreground">
                1.0 = variance calibree. Augmenter pour plus d&apos;incertitude.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Solar Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Disponibilite solaire</CardTitle>
            <CardDescription>
              Parametres de la loi Beta: h_PV ~ Beta(α, β)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="solarAlpha">Alpha (α)</Label>
              <Input
                id="solarAlpha"
                type="number"
                step="0.01"
                value={params.solarAlpha}
                onChange={(e) => updateParam("solarAlpha", parseFloat(e.target.value) || 5.76)}
                min={0.1}
                max={20}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.solarAlpha}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="solarBeta">Beta (β)</Label>
              <Input
                id="solarBeta"
                type="number"
                step="0.01"
                value={params.solarBeta}
                onChange={(e) => updateParam("solarBeta", parseFloat(e.target.value) || 3.84)}
                min={0.1}
                max={20}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.solarBeta}</p>
            </div>
          </CardContent>
        </Card>

        {/* Wind Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Disponibilite eolienne</CardTitle>
            <CardDescription>
              Parametres de la loi normale tronquee: h_Wind ~ N[0,1](μ, σ²)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="windMean">Moyenne (μ)</Label>
              <Input
                id="windMean"
                type="number"
                step="0.001"
                value={params.windMean}
                onChange={(e) => updateParam("windMean", parseFloat(e.target.value) || 0.296)}
                min={0}
                max={1}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.windMean}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="windStd">Ecart-type (σ)</Label>
              <Input
                id="windStd"
                type="number"
                step="0.001"
                value={params.windStd}
                onChange={(e) => updateParam("windStd", parseFloat(e.target.value) || 0.035)}
                min={0.001}
                max={0.5}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.windStd}</p>
            </div>
          </CardContent>
        </Card>

        {/* CAPEX PV Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>CAPEX solaire</CardTitle>
            <CardDescription>
              Mouvement brownien geometrique: dC = C(μ dt + σ dW)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capexInitial">Valeur initiale (€/kW)</Label>
              <Input
                id="capexInitial"
                type="number"
                value={params.capexPvInitial}
                onChange={(e) => updateParam("capexPvInitial", parseFloat(e.target.value) || 800)}
                min={100}
                max={2000}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.capexPvInitial}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="capexMu">Tendance (μ)</Label>
              <Input
                id="capexMu"
                type="number"
                step="0.01"
                value={params.capexPvMu}
                onChange={(e) => updateParam("capexPvMu", parseFloat(e.target.value) || -0.05)}
                min={-0.2}
                max={0.1}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.capexPvMu} (baisse)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="capexSigma">Volatilite (σ)</Label>
              <Input
                id="capexSigma"
                type="number"
                step="0.01"
                value={params.capexPvSigma}
                onChange={(e) => updateParam("capexPvSigma", parseFloat(e.target.value) || 0.10)}
                min={0.01}
                max={0.5}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.capexPvSigma}</p>
            </div>
          </CardContent>
        </Card>

        {/* Gas Price Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Prix du gaz</CardTitle>
            <CardDescription>
              Modele GARCH(1,1): σ²_t = ω + α·ε²_{'{t-1}'} + β·σ²_{'{t-1}'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gasInitial">Prix initial (€/MBtu)</Label>
              <Input
                id="gasInitial"
                type="number"
                step="0.1"
                value={params.gasPriceInitial}
                onChange={(e) => updateParam("gasPriceInitial", parseFloat(e.target.value) || 4.5)}
                min={0.5}
                max={20}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.gasPriceInitial}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gasMu">Tendance (μ)</Label>
              <Input
                id="gasMu"
                type="number"
                step="0.01"
                value={params.gasPriceMu}
                onChange={(e) => updateParam("gasPriceMu", parseFloat(e.target.value) || 0.02)}
                min={-0.1}
                max={0.2}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.gasPriceMu}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="garchOmega">Omega (ω)</Label>
              <Input
                id="garchOmega"
                type="number"
                step="0.0001"
                value={params.garchOmega}
                onChange={(e) => updateParam("garchOmega", parseFloat(e.target.value) || 0.0002)}
                min={0.0001}
                max={0.01}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.garchOmega}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="garchAlpha">Alpha GARCH (α)</Label>
              <Input
                id="garchAlpha"
                type="number"
                step="0.01"
                value={params.garchAlpha}
                onChange={(e) => updateParam("garchAlpha", parseFloat(e.target.value) || 0.10)}
                min={0.01}
                max={0.5}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.garchAlpha}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="garchBeta">Beta GARCH (β)</Label>
              <Input
                id="garchBeta"
                type="number"
                step="0.01"
                value={params.garchBeta}
                onChange={(e) => updateParam("garchBeta", parseFloat(e.target.value) || 0.85)}
                min={0.01}
                max={0.95}
              />
              <p className="text-xs text-muted-foreground">Defaut: {DEFAULT_PARAMS.garchBeta}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

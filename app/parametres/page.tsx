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

  const updateParamInt = (key: keyof typeof params, value: string, fallback: number, min: number, max: number) => {
    const parsed = parseInt(value)
    if (value === "" || isNaN(parsed)) {
      // Allow empty field while typing
      return
    }
    const clamped = Math.min(max, Math.max(min, parsed))
    setParams({ ...params, [key]: clamped })
  }

  const updateParamFloat = (key: keyof typeof params, value: string, fallback: number, min: number, max: number) => {
    const parsed = parseFloat(value)
    if (value === "" || isNaN(parsed)) {
      return
    }
    const clamped = Math.min(max, Math.max(min, parsed))
    setParams({ ...params, [key]: clamped })
  }

  const handleBlurInt = (key: keyof typeof params, value: string, fallback: number, min: number, max: number) => {
    const parsed = parseInt(value)
    if (value === "" || isNaN(parsed)) {
      setParams({ ...params, [key]: fallback })
    } else {
      const clamped = Math.min(max, Math.max(min, parsed))
      setParams({ ...params, [key]: clamped })
    }
  }

  const handleBlurFloat = (key: keyof typeof params, value: string, fallback: number, min: number, max: number) => {
    const parsed = parseFloat(value)
    if (value === "" || isNaN(parsed)) {
      setParams({ ...params, [key]: fallback })
    } else {
      const clamped = Math.min(max, Math.max(min, parsed))
      setParams({ ...params, [key]: clamped })
    }
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
                defaultValue={params.numScenarios}
                key={params.numScenarios}
                onChange={(e) => updateParamInt("numScenarios", e.target.value, 100, 10, 1000)}
                onBlur={(e) => handleBlurInt("numScenarios", e.target.value, 100, 10, 1000)}
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
                defaultValue={params.startYear}
                key={`start-${params.startYear}`}
                onChange={(e) => updateParamInt("startYear", e.target.value, 2024, 2020, 2030)}
                onBlur={(e) => handleBlurInt("startYear", e.target.value, 2024, 2020, 2030)}
                min={2020}
                max={2030}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endYear">Annee de fin</Label>
              <Input
                id="endYear"
                type="number"
                defaultValue={params.endYear}
                key={`end-${params.endYear}`}
                onChange={(e) => updateParamInt("endYear", e.target.value, 2050, 2030, 2100)}
                onBlur={(e) => handleBlurInt("endYear", e.target.value, 2050, 2030, 2100)}
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
                defaultValue={params.demandVarianceMultiplier}
                key={`demand-${params.demandVarianceMultiplier}`}
                onChange={(e) => updateParamFloat("demandVarianceMultiplier", e.target.value, 1, 0.1, 3)}
                onBlur={(e) => handleBlurFloat("demandVarianceMultiplier", e.target.value, 1, 0.1, 3)}
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
                defaultValue={params.solarAlpha}
                key={`solar-alpha-${params.solarAlpha}`}
                onChange={(e) => updateParamFloat("solarAlpha", e.target.value, 5.76, 0.1, 20)}
                onBlur={(e) => handleBlurFloat("solarAlpha", e.target.value, 5.76, 0.1, 20)}
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
                defaultValue={params.solarBeta}
                key={`solar-beta-${params.solarBeta}`}
                onChange={(e) => updateParamFloat("solarBeta", e.target.value, 3.84, 0.1, 20)}
                onBlur={(e) => handleBlurFloat("solarBeta", e.target.value, 3.84, 0.1, 20)}
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
                defaultValue={params.windMean}
                key={`wind-mean-${params.windMean}`}
                onChange={(e) => updateParamFloat("windMean", e.target.value, 0.296, 0, 1)}
                onBlur={(e) => handleBlurFloat("windMean", e.target.value, 0.296, 0, 1)}
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
                defaultValue={params.windStd}
                key={`wind-std-${params.windStd}`}
                onChange={(e) => updateParamFloat("windStd", e.target.value, 0.035, 0.001, 0.5)}
                onBlur={(e) => handleBlurFloat("windStd", e.target.value, 0.035, 0.001, 0.5)}
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
                defaultValue={params.capexPvInitial}
                key={`capex-init-${params.capexPvInitial}`}
                onChange={(e) => updateParamFloat("capexPvInitial", e.target.value, 800, 100, 2000)}
                onBlur={(e) => handleBlurFloat("capexPvInitial", e.target.value, 800, 100, 2000)}
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
                defaultValue={params.capexPvMu}
                key={`capex-mu-${params.capexPvMu}`}
                onChange={(e) => updateParamFloat("capexPvMu", e.target.value, -0.05, -0.2, 0.1)}
                onBlur={(e) => handleBlurFloat("capexPvMu", e.target.value, -0.05, -0.2, 0.1)}
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
                defaultValue={params.capexPvSigma}
                key={`capex-sigma-${params.capexPvSigma}`}
                onChange={(e) => updateParamFloat("capexPvSigma", e.target.value, 0.10, 0.01, 0.5)}
                onBlur={(e) => handleBlurFloat("capexPvSigma", e.target.value, 0.10, 0.01, 0.5)}
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
                defaultValue={params.gasPriceInitial}
                key={`gas-init-${params.gasPriceInitial}`}
                onChange={(e) => updateParamFloat("gasPriceInitial", e.target.value, 4.5, 0.5, 20)}
                onBlur={(e) => handleBlurFloat("gasPriceInitial", e.target.value, 4.5, 0.5, 20)}
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
                defaultValue={params.gasPriceMu}
                key={`gas-mu-${params.gasPriceMu}`}
                onChange={(e) => updateParamFloat("gasPriceMu", e.target.value, 0.02, -0.1, 0.2)}
                onBlur={(e) => handleBlurFloat("gasPriceMu", e.target.value, 0.02, -0.1, 0.2)}
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
                defaultValue={params.garchOmega}
                key={`garch-omega-${params.garchOmega}`}
                onChange={(e) => updateParamFloat("garchOmega", e.target.value, 0.0002, 0.0001, 0.01)}
                onBlur={(e) => handleBlurFloat("garchOmega", e.target.value, 0.0002, 0.0001, 0.01)}
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
                defaultValue={params.garchAlpha}
                key={`garch-alpha-${params.garchAlpha}`}
                onChange={(e) => updateParamFloat("garchAlpha", e.target.value, 0.10, 0.01, 0.5)}
                onBlur={(e) => handleBlurFloat("garchAlpha", e.target.value, 0.10, 0.01, 0.5)}
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
                defaultValue={params.garchBeta}
                key={`garch-beta-${params.garchBeta}`}
                onChange={(e) => updateParamFloat("garchBeta", e.target.value, 0.85, 0.01, 0.95)}
                onBlur={(e) => handleBlurFloat("garchBeta", e.target.value, 0.85, 0.01, 0.95)}
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

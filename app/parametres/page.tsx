"use client"

import { useState, useEffect } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { DEFAULT_PARAMS } from "@/lib/monte-carlo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RotateCcw } from "lucide-react"

// Composant Input avec etat local pour eviter la perte de focus
function ParamInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
}: {
  id: string
  label: string
  value: number
  onChange: (val: number) => void
  min: number
  max: number
  step?: number
  hint?: string
}) {
  const [localValue, setLocalValue] = useState(String(value))

  // Sync local value when external value changes (e.g., reset)
  useEffect(() => {
    setLocalValue(String(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }

  const handleBlur = () => {
    const parsed = step < 1 ? parseFloat(localValue) : parseInt(localValue)
    if (localValue === "" || isNaN(parsed)) {
      setLocalValue(String(value))
    } else {
      const clamped = Math.min(max, Math.max(min, parsed))
      setLocalValue(String(clamped))
      onChange(clamped)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step={step}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        max={max}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

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
            <ParamInput
              id="numScenarios"
              label="Nombre de scenarios (S)"
              value={params.numScenarios}
              onChange={(val) => updateParam("numScenarios", val)}
              min={10}
              max={1000}
              hint="Recommande: 100, 300 ou 500"
            />
            <ParamInput
              id="startYear"
              label="Annee de debut"
              value={params.startYear}
              onChange={(val) => updateParam("startYear", val)}
              min={2020}
              max={2030}
            />
            <ParamInput
              id="endYear"
              label="Annee de fin"
              value={params.endYear}
              onChange={(val) => updateParam("endYear", val)}
              min={2030}
              max={2100}
            />
          </CardContent>
        </Card>

        {/* Demand Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Demande energetique</CardTitle>
            <CardDescription>Parametres de la variance de la demande sectorielle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs">
              <ParamInput
                id="demandVariance"
                label="Multiplicateur de variance"
                value={params.demandVarianceMultiplier}
                onChange={(val) => updateParam("demandVarianceMultiplier", val)}
                min={0.1}
                max={3}
                step={0.1}
                hint="1.0 = variance calibree. Augmenter pour plus d'incertitude."
              />
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
            <ParamInput
              id="solarAlpha"
              label="Alpha (α)"
              value={params.solarAlpha}
              onChange={(val) => updateParam("solarAlpha", val)}
              min={0.1}
              max={20}
              step={0.01}
              hint={`Defaut: ${DEFAULT_PARAMS.solarAlpha}`}
            />
            <ParamInput
              id="solarBeta"
              label="Beta (β)"
              value={params.solarBeta}
              onChange={(val) => updateParam("solarBeta", val)}
              min={0.1}
              max={20}
              step={0.01}
              hint={`Defaut: ${DEFAULT_PARAMS.solarBeta}`}
            />
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
            <ParamInput
              id="windMean"
              label="Moyenne (μ)"
              value={params.windMean}
              onChange={(val) => updateParam("windMean", val)}
              min={0}
              max={1}
              step={0.001}
              hint={`Defaut: ${DEFAULT_PARAMS.windMean}`}
            />
            <ParamInput
              id="windStd"
              label="Ecart-type (σ)"
              value={params.windStd}
              onChange={(val) => updateParam("windStd", val)}
              min={0.001}
              max={0.5}
              step={0.001}
              hint={`Defaut: ${DEFAULT_PARAMS.windStd}`}
            />
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
            <ParamInput
              id="capexInitial"
              label="Valeur initiale (€/kW)"
              value={params.capexPvInitial}
              onChange={(val) => updateParam("capexPvInitial", val)}
              min={100}
              max={2000}
              hint={`Defaut: ${DEFAULT_PARAMS.capexPvInitial}`}
            />
            <ParamInput
              id="capexMu"
              label="Tendance (μ)"
              value={params.capexPvMu}
              onChange={(val) => updateParam("capexPvMu", val)}
              min={-0.2}
              max={0.1}
              step={0.01}
              hint={`Defaut: ${DEFAULT_PARAMS.capexPvMu} (baisse)`}
            />
            <ParamInput
              id="capexSigma"
              label="Volatilite (σ)"
              value={params.capexPvSigma}
              onChange={(val) => updateParam("capexPvSigma", val)}
              min={0.01}
              max={0.5}
              step={0.01}
              hint={`Defaut: ${DEFAULT_PARAMS.capexPvSigma}`}
            />
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
            <ParamInput
              id="gasInitial"
              label="Prix initial (€/MBtu)"
              value={params.gasPriceInitial}
              onChange={(val) => updateParam("gasPriceInitial", val)}
              min={0.5}
              max={20}
              step={0.1}
              hint={`Defaut: ${DEFAULT_PARAMS.gasPriceInitial}`}
            />
            <ParamInput
              id="gasMu"
              label="Tendance (μ)"
              value={params.gasPriceMu}
              onChange={(val) => updateParam("gasPriceMu", val)}
              min={-0.1}
              max={0.2}
              step={0.01}
              hint={`Defaut: ${DEFAULT_PARAMS.gasPriceMu}`}
            />
            <ParamInput
              id="garchOmega"
              label="Omega (ω)"
              value={params.garchOmega}
              onChange={(val) => updateParam("garchOmega", val)}
              min={0.0001}
              max={0.01}
              step={0.0001}
              hint={`Defaut: ${DEFAULT_PARAMS.garchOmega}`}
            />
            <ParamInput
              id="garchAlpha"
              label="Alpha GARCH (α)"
              value={params.garchAlpha}
              onChange={(val) => updateParam("garchAlpha", val)}
              min={0.01}
              max={0.5}
              step={0.01}
              hint={`Defaut: ${DEFAULT_PARAMS.garchAlpha}`}
            />
            <ParamInput
              id="garchBeta"
              label="Beta GARCH (β)"
              value={params.garchBeta}
              onChange={(val) => updateParam("garchBeta", val)}
              min={0.01}
              max={0.95}
              step={0.01}
              hint={`Defaut: ${DEFAULT_PARAMS.garchBeta}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

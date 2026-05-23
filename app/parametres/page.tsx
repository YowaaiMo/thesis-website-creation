"use client"

import { useState, useEffect } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { DEFAULT_PARAMS, DEFAULT_DETERMINISTIC_PARAMS } from "@/lib/monte-carlo"
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

        {/* Demand Polynomial Coefficients — section 4.2.2 / 6.2 */}
        <Card>
          <CardHeader>
            <CardTitle>Coefficients de tendance de la demande</CardTitle>
            <CardDescription>
              D̂_s,t = A·t² + B·t + C avec t = annee − 1980 — section 5.2
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-3">Residentiel (quadratique)</p>
              <div className="grid sm:grid-cols-4 gap-4">
                <ParamInput id="demandResA" label="A (t²)" value={params.demandResA} onChange={(v) => updateParam("demandResA", v)} min={-100} max={100} step={0.01} />
                <ParamInput id="demandResB" label="B (t)" value={params.demandResB} onChange={(v) => updateParam("demandResB", v)} min={-1000} max={1000} step={0.01} />
                <ParamInput id="demandResC" label="C (cte)" value={params.demandResC} onChange={(v) => updateParam("demandResC", v)} min={0} max={20000} step={0.01} />
                <ParamInput id="demandResStd" label="σ (ktep)" value={params.demandResStd} onChange={(v) => updateParam("demandResStd", v)} min={1} max={10000} step={1} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Industriel (quadratique)</p>
              <div className="grid sm:grid-cols-4 gap-4">
                <ParamInput id="demandIndA" label="A (t²)" value={params.demandIndA} onChange={(v) => updateParam("demandIndA", v)} min={-100} max={100} step={0.01} />
                <ParamInput id="demandIndB" label="B (t)" value={params.demandIndB} onChange={(v) => updateParam("demandIndB", v)} min={-1000} max={1000} step={0.01} />
                <ParamInput id="demandIndC" label="C (cte)" value={params.demandIndC} onChange={(v) => updateParam("demandIndC", v)} min={0} max={20000} step={0.01} />
                <ParamInput id="demandIndStd" label="σ (ktep)" value={params.demandIndStd} onChange={(v) => updateParam("demandIndStd", v)} min={1} max={10000} step={1} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Transport (quadratique)</p>
              <div className="grid sm:grid-cols-4 gap-4">
                <ParamInput id="demandTraA" label="A (t²)" value={params.demandTraA} onChange={(v) => updateParam("demandTraA", v)} min={-100} max={100} step={0.01} />
                <ParamInput id="demandTraB" label="B (t)" value={params.demandTraB} onChange={(v) => updateParam("demandTraB", v)} min={-1000} max={1000} step={0.01} />
                <ParamInput id="demandTraC" label="C (cte)" value={params.demandTraC} onChange={(v) => updateParam("demandTraC", v)} min={0} max={20000} step={0.01} />
                <ParamInput id="demandTraStd" label="σ (ktep)" value={params.demandTraStd} onChange={(v) => updateParam("demandTraStd", v)} min={1} max={10000} step={1} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Agriculture (lineaire, A=0)</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <ParamInput id="demandAgrB" label="B (t)" value={params.demandAgrB} onChange={(v) => updateParam("demandAgrB", v)} min={-500} max={500} step={0.01} />
                <ParamInput id="demandAgrC" label="C (cte)" value={params.demandAgrC} onChange={(v) => updateParam("demandAgrC", v)} min={-5000} max={5000} step={0.01} />
                <ParamInput id="demandAgrStd" label="σ (ktep)" value={params.demandAgrStd} onChange={(v) => updateParam("demandAgrStd", v)} min={1} max={2000} step={1} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Tertiaire (lineaire, A=0)</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <ParamInput id="demandTerB" label="B (t)" value={params.demandTerB} onChange={(v) => updateParam("demandTerB", v)} min={-500} max={500} step={0.01} />
                <ParamInput id="demandTerC" label="C (cte)" value={params.demandTerC} onChange={(v) => updateParam("demandTerC", v)} min={-5000} max={5000} step={0.01} />
                <ParamInput id="demandTerStd" label="σ (ktep)" value={params.demandTerStd} onChange={(v) => updateParam("demandTerStd", v)} min={1} max={2000} step={1} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fossil Operational Costs */}
        <Card>
          <CardHeader>
            <CardTitle>Couts operationnels fossiles</CardTitle>
            <CardDescription>
              Distributions normales N(μ, (5%·μ)²) en DA/tep — section 5.8
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <ParamInput
              id="oilOpCostMean"
              label="Petrole brut μ (DA/tep)"
              value={params.oilOpCostMean}
              onChange={(val) => updateParam("oilOpCostMean", val)}
              min={10000}
              max={100000}
              hint={`Defaut: ${DEFAULT_PARAMS.oilOpCostMean} · σ = 5%`}
            />
            <ParamInput
              id="gplOpCostMean"
              label="GPL μ (DA/tep)"
              value={params.gplOpCostMean}
              onChange={(val) => updateParam("gplOpCostMean", val)}
              min={10000}
              max={100000}
              hint={`Defaut: ${DEFAULT_PARAMS.gplOpCostMean} · σ = 5%`}
            />
            <ParamInput
              id="condensatOpCostMean"
              label="Condensat μ (DA/tep)"
              value={params.condensatOpCostMean}
              onChange={(val) => updateParam("condensatOpCostMean", val)}
              min={10000}
              max={100000}
              hint={`Defaut: ${DEFAULT_PARAMS.condensatOpCostMean} · σ = 5%`}
            />
          </CardContent>
        </Card>

        {/* Deterministic Parameters (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Parametres deterministes</CardTitle>
            <CardDescription>
              Contraintes fixes du modele d&apos;optimisation — section 4.8 / 5.10
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              <DetParam label="ηc (rendement charge)" value="0.92" />
              <DetParam label="ηd (rendement decharge)" value="0.92" />
              <DetParam label="ENDC (cible CO₂)" value="171.9 MtCO2eq" />
              <DetParam label="Taux d'actualisation δ" value="2%" />
              <DetParam label="Production fossile initiale" value="120 000 ktep" />
              <DetParam label="Big-M" value="200 000 ktep" />
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Cibles EnR (%)</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <DetParam label="α 2024" value={`${(DEFAULT_DETERMINISTIC_PARAMS.renewableTarget2024 * 100).toFixed(0)}%`} />
              <DetParam label="α 2030" value={`${(DEFAULT_DETERMINISTIC_PARAMS.renewableTarget2030 * 100).toFixed(0)}%`} />
              <DetParam label="α 2050" value={`${(DEFAULT_DETERMINISTIC_PARAMS.renewableTarget2050 * 100).toFixed(0)}%`} />
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Facteurs d&apos;emission (tCO₂/tep)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <DetParam label="Gaz" value={`${DEFAULT_DETERMINISTIC_PARAMS.emissionFactorGas}`} />
              <DetParam label="Petrole" value={`${DEFAULT_DETERMINISTIC_PARAMS.emissionFactorOil}`} />
              <DetParam label="GPL" value={`${DEFAULT_DETERMINISTIC_PARAMS.emissionFactorGPL}`} />
              <DetParam label="Condensat" value={`${DEFAULT_DETERMINISTIC_PARAMS.emissionFactorCondensat}`} />
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Couts techniques (USD/MWh)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <DetParam label="Gaz" value={`${DEFAULT_DETERMINISTIC_PARAMS.techCostGas}`} />
              <DetParam label="Petrole" value={`${DEFAULT_DETERMINISTIC_PARAMS.techCostOil}`} />
              <DetParam label="GPL" value={`${DEFAULT_DETERMINISTIC_PARAMS.techCostGPL}`} />
              <DetParam label="Condensat" value={`${DEFAULT_DETERMINISTIC_PARAMS.techCostCondensat}`} />
              <DetParam label="PV" value={`${DEFAULT_DETERMINISTIC_PARAMS.techCostPV}`} />
              <DetParam label="Eolien" value={`${DEFAULT_DETERMINISTIC_PARAMS.techCostWind}`} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DetParam({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-secondary/30 border border-border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

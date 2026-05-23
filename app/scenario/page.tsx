"use client"

import { useState, useRef } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MethodSelector } from "@/components/method-selector"
import { PageInfo } from "@/components/page-info"
import { FlipCard } from "@/components/flip-card"
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
  const { result, lhsResult } = useSimulation()
  const [method, setMethod] = useState<"mc" | "lhs">("mc")
  const activeResult = method === "mc" ? result : lhsResult
  const [selectedScenario, setSelectedScenario] = useState(0)

  if (!result && !lhsResult) {
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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Scenario individuel</h1>
        <p className="text-muted-foreground">
          Explorez un scenario particulier ω ∈ {'{'}1, ..., {activeResult?.scenarios.length ?? (result?.scenarios.length ?? lhsResult?.scenarios.length ?? 0)}{'}'}
        </p>
      </div>

      <PageInfo title="Scenario individuel — Details">
        <p><strong className="text-foreground">Objectif :</strong> Explorer en détail la trajectoire complète d'un scénario individuel ω, incluant la décomposition sectorielle de la demande et l'évolution des coûts énergétiques.</p>
        <p><strong className="text-foreground">Sélection :</strong> Entrez un numéro de scénario (1 à {activeResult?.scenarios.length ?? (result?.scenarios.length ?? lhsResult?.scenarios.length ?? "...")}). Les presets pointent vers les scénarios extrêmes identifiés automatiquement.</p>
        <p><strong className="text-foreground">Graphes affichés :</strong></p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-foreground">Demande totale :</strong> trajectoire du scénario ω vs moyenne de tous les scénarios</li>
          <li><strong className="text-foreground">Demande par secteur :</strong> décomposition Résidentiel / Industriel / Transport / Agriculture / Tertiaire</li>
          <li><strong className="text-foreground">Disponibilité renouvelable :</strong> facteurs de capacité solaire et éolien pour ce scénario</li>
          <li><strong className="text-foreground">Coûts énergétiques :</strong> CAPEX PV (axe gauche, €/kW) et prix du gaz (axe droit, €/MBtu) sur deux axes indépendants</li>
        </ul>
        <p><strong className="text-foreground">MC vs LHS :</strong> Le numéro de scénario n'est pas directement comparable entre les deux méthodes (le scénario #5 MC ≠ scénario #5 LHS). Utilisez les presets pour accéder aux mêmes types de cas extrêmes dans chaque méthode.</p>
      </PageInfo>

      {/* Method selector */}
      <MethodSelector method={method} setMethod={m => { setMethod(m); setSelectedScenario(0) }} hasMC={!!result} hasLHS={!!lhsResult} />

      {!activeResult ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Aucun resultat LHS — lancez une simulation LHS d&apos;abord.
              </p>
              <Button asChild>
                <Link href="/generation">Lancer une simulation LHS</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScenarioContent
          activeResult={activeResult}
          selectedScenario={selectedScenario}
          setSelectedScenario={setSelectedScenario}
        />
      )}
    </div>
  )
}

function ScenarioContent({
  activeResult,
  selectedScenario,
  setSelectedScenario,
}: {
  activeResult: NonNullable<ReturnType<typeof useSimulation>["result"]>
  selectedScenario: number
  setSelectedScenario: (n: number) => void
}) {
  const S = activeResult.scenarios.length
  const clamp = (v: number) => Math.min(S - 1, Math.max(0, v))
  const safeIdx = clamp(selectedScenario)
  const scenario = activeResult.scenarios[safeIdx]
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
    mean: activeResult.statistics.demand.mean[i],
  }))

  // Prepare data for availability
  const availabilityData = years.map((year, i) => ({
    year,
    solar: scenario.solarAvailability[i] * 100,
    wind: scenario.windAvailability[i] * 100,
  }))

  // Prepare data for costs — two real axes, no artificial scaling
  const costData = years.map((year, i) => ({
    year,
    capexPv: scenario.capexPv[i],
    gasPrice: scenario.gasPrice[i],
  }))

  return (
    <>
      {/* Scenario Selector */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Selection du scenario</CardTitle>
          <CardDescription>
            Choisissez un scenario (1 a {S}) pour visualiser sa trajectoire complete
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-6 mb-4">
            <ScenarioInput
              label="Scenario ω ="
              value={safeIdx}
              max={S - 1}
              onChange={v => setSelectedScenario(clamp(v))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedScenario(activeResult.extremeScenarios.pessimistic)}
            >
              Pessimiste
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedScenario(activeResult.extremeScenarios.maxDemand)}
            >
              Max Demande
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedScenario(activeResult.extremeScenarios.minDemand)}
            >
              Min Demande
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Demande totale</CardTitle>
                <CardDescription>Scenario {safeIdx + 1} vs Moyenne</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={totalDemandData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                      <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--card-foreground)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Scenario" isAnimationActive={false} />
                      <Line type="monotone" dataKey="mean" stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Moyenne" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Demande totale — Ce scénario</h3>
              <p>La courbe bleue est la demande totale du scénario ω = {safeIdx + 1}, résultat de la sommation des cinq secteurs avec leurs résidus stochastiques.</p>
              <p>La courbe grise pointillée est la <strong className="text-foreground">moyenne de tous les scénarios</strong>. Un scénario au-dessus indique des résidus positifs (croissance plus forte que la tendance), en dessous des résidus négatifs.</p>
              <p><strong className="text-foreground">Corrélation inter-secteurs :</strong> Les résidus des secteurs sont corrélés (matrice Cholesky). Un choc positif sur la demande résidentielle a tendance à être accompagné d'un choc négatif sur l'industrie (ρ = −0.662).</p>
            </>
          }
        />

        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Demande par secteur</CardTitle>
                <CardDescription>Decomposition sectorielle du scenario {safeIdx + 1}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sectorDemandData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                      <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--card-foreground)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="residential" stroke="var(--chart-1)" strokeWidth={1.5} dot={false} name="Residentiel" isAnimationActive={false} />
                      <Line type="monotone" dataKey="industrial" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} name="Industriel" isAnimationActive={false} />
                      <Line type="monotone" dataKey="transport" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} name="Transport" isAnimationActive={false} />
                      <Line type="monotone" dataKey="agriculture" stroke="var(--chart-4)" strokeWidth={1.5} dot={false} name="Agriculture" isAnimationActive={false} />
                      <Line type="monotone" dataKey="tertiary" stroke="var(--chart-5)" strokeWidth={1.5} dot={false} name="Tertiaire" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Decomposition sectorielle — Modele</h3>
              <p>Chaque secteur suit : D_s(t, ω) = f_s(t) + ε_s(ω), où f_s(t) est la tendance polynomiale en t = année − 1980 et ε_s est un résidu gaussien corrélé.</p>
              <p><strong className="text-foreground">Secteurs dominants :</strong> Résidentiel et Industriel représentent généralement les deux plus gros postes. Le Transport croît rapidement avec l'urbanisation.</p>
              <p><strong className="text-foreground">Agriculture et Tertiaire :</strong> Secteurs à demande plus faible mais à forte croissance en début de période. L'Agriculture peut atteindre zéro si t est suffisamment petit (contrainte max(0, ...)).</p>
              <p><strong className="text-foreground">Lecture inter-scénarios :</strong> Comparer deux scénarios sur ce graphe permet d'identifier quel secteur est à l'origine des différences de demande totale.</p>
            </>
          }
        />

        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Disponibilite renouvelable</CardTitle>
                <CardDescription>Facteurs de capacite solaire et eolien (%)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={availabilityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                      <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--card-foreground)' }} formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
                      <Legend />
                      <Line type="monotone" dataKey="solar" stroke="var(--chart-3)" strokeWidth={2} dot={false} name="Solaire h_PV" isAnimationActive={false} />
                      <Line type="monotone" dataKey="wind" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Eolien h_Wind" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Disponibilites renouvelables — Interpretation</h3>
              <p><strong className="text-foreground">Solaire h_PV</strong> (vert) : valeurs annuelles tirées d'une loi Beta(5.76, 3.84). Espérance ≈ 60%. Les fluctuations d'une année à l'autre représentent la variabilité naturelle de l'irradiation.</p>
              <p><strong className="text-foreground">Eolien h_Wind</strong> (bleu) : valeurs tirées d'une normale tronquée N[0,1](0.296, 0.035²). L'éolien est plus régulier (σ = 3.5%) mais moins productif que le solaire en Algérie.</p>
              <p><strong className="text-foreground">Indépendance :</strong> Les deux facteurs sont tirés indépendamment — il n'y a pas de corrélation modélisée entre solaire et éolien dans ce scénario.</p>
              <p><strong className="text-foreground">Impact sur l'énergie produite :</strong> E_produite = Capacite_installee × h × 8760 heures. Un h_PV de 70% vs 50% représente 40% d'énergie solaire en plus pour la même capacité installée.</p>
            </>
          }
        />

        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Couts energetiques</CardTitle>
                <CardDescription>CAPEX PV (€/kW, axe gauche) et Prix du gaz (€/MBtu, axe droit)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={costData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                      <YAxis yAxisId="left" stroke="var(--chart-2)" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickFormatter={(value) => `${value.toFixed(0)}€`} label={{ value: "€/kW", angle: -90, position: "insideLeft", fill: "var(--chart-2)", fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" stroke="var(--chart-4)" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickFormatter={(value) => `${value.toFixed(1)}€`} label={{ value: "€/MBtu", angle: 90, position: "insideRight", fill: "var(--chart-4)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--card-foreground)' }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="capexPv" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="CAPEX PV (€/kW)" isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="gasPrice" stroke="var(--chart-4)" strokeWidth={2} dot={false} name="Prix Gaz (€/MBtu)" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Couts energetiques — Double axe</h3>
              <p><strong className="text-foreground">CAPEX PV</strong> (vert, axe gauche) : suit un GBM avec μ = −5%/an. La tendance baissière est visible sur la plupart des scénarios, mais la volatilité σ = 10%/an crée des trajectoires très différentes.</p>
              <p><strong className="text-foreground">Prix du gaz</strong> (orange, axe droit) : suit un GARCH(1,1). Les niveaux sont exprimés en €/MBtu (Million British Thermal Unit), unité standard des marchés gaziers. 1 MBtu ≈ 293 kWh.</p>
              <p><strong className="text-foreground">Parité solaire-gaz :</strong> La compétitivité du solaire peut s'approximer par le rapport LCOE_solaire / Prix_gaz. Ce ratio détermine le moment optimal pour investir en solaire vs maintenir des centrales à gaz.</p>
              <p><strong className="text-foreground">Double axe :</strong> Les deux variables ont des unités différentes (€/kW vs €/MBtu) — les deux axes indépendants évitent toute confusion d'échelle.</p>
            </>
          }
        />
      </div>

      {/* Summary Stats for this scenario */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resume du scenario {safeIdx + 1}</CardTitle>
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
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScenarioInput({ label, value, max, onChange }: {
  label: string; value: number; max: number; onChange: (v: number) => void
}) {
  const [local, setLocal] = useState(String(value + 1))
  const prev = useRef(value)
  if (prev.current !== value) { prev.current = value; setLocal(String(value + 1)) }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={1}
        max={max + 1}
        value={local}
        className="w-40"
        onChange={e => setLocal(e.target.value)}
        onBlur={() => {
          const n = parseInt(local)
          if (!isNaN(n)) { onChange(n - 1); setLocal(String(Math.min(max + 1, Math.max(1, n)))) }
          else setLocal(String(value + 1))
        }}
      />
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

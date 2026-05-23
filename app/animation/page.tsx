"use client"

import { useState, useEffect, useRef } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import Link from "next/link"
import { Play, Pause, RotateCcw, FastForward } from "lucide-react"
import { MethodSelector } from "@/components/method-selector"
import { PageInfo } from "@/components/page-info"
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export default function AnimationPage() {
  const { result, lhsResult, params } = useSimulation()
  const [method, setMethod] = useState<"mc" | "lhs">("mc")
  const activeResult = method === "mc" ? result : lhsResult
  const [currentYearIndex, setCurrentYearIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(500)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isPlaying && activeResult) {
      intervalRef.current = setInterval(() => {
        setCurrentYearIndex((prev) => {
          if (prev >= (activeResult?.scenarios[0].years.length ?? 1) - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, speed)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPlaying, speed, activeResult])

  if (!result && !lhsResult) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Animation temporelle</h1>
          <p className="text-muted-foreground">Visualisez l&apos;evolution des scenarios annee par annee.</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Aucune simulation n&apos;a encore ete lancee.</p>
            <Button asChild><Link href="/generation">Lancer une simulation</Link></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!activeResult) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Animation temporelle</h1>
        </div>
        <MethodSelector method={method} setMethod={m => { setMethod(m); setCurrentYearIndex(0); setIsPlaying(false) }} hasMC={!!result} hasLHS={!!lhsResult} />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Aucun resultat {method === "lhs" ? "LHS" : "Monte Carlo"} — lancez une simulation.</p>
            <Button asChild><Link href="/generation">Lancer une simulation</Link></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { statistics, scenarios } = activeResult
  const years = scenarios[0].years
  const currentYear = years[currentYearIndex]

  const togglePlay = () => setIsPlaying(!isPlaying)
  const reset = () => { setIsPlaying(false); setCurrentYearIndex(0) }

  // Slice data up to currentYearIndex so curves grow as play advances
  const visible = currentYearIndex + 1
  const demandData = years.slice(0, visible).map((y, i) => ({ year: y, mean: statistics.demand.mean[i],  q5: statistics.demand.q5[i],  q95: statistics.demand.q95[i] }))
  const solarData  = years.slice(0, visible).map((y, i) => ({ year: y, mean: statistics.solarAvailability.mean[i] * 100, q5: statistics.solarAvailability.q5[i] * 100, q95: statistics.solarAvailability.q95[i] * 100 }))
  const windData   = years.slice(0, visible).map((y, i) => ({ year: y, mean: statistics.windAvailability.mean[i] * 100, q5: statistics.windAvailability.q5[i] * 100, q95: statistics.windAvailability.q95[i] * 100 }))
  const capexData  = years.slice(0, visible).map((y, i) => ({ year: y, mean: statistics.capexPv.mean[i], q5: statistics.capexPv.q5[i], q95: statistics.capexPv.q95[i] }))
  const gasData    = years.slice(0, visible).map((y, i) => ({ year: y, mean: statistics.gasPrice.mean[i], q5: statistics.gasPrice.q5[i], q95: statistics.gasPrice.q95[i] }))

  return (
    <div className="max-w-6xl mx-auto">
      <PageInfo title="Animation temporelle — Mode d'emploi">
        <p><strong className="text-foreground">Objectif :</strong> Visualiser l'évolution temporelle des variables stochastiques année par année, de {params.startYear} à {params.endYear}.</p>
        <p><strong className="text-foreground">Comment lire :</strong> La courbe en couleur est la moyenne des {activeResult.scenarios.length} scénarios. La bande semi-transparente représente l'intervalle de confiance à 90 % (Q5–Q95). Le tracé s'étend progressivement avec le temps animé.</p>
        <p><strong className="text-foreground">Monte Carlo vs LHS :</strong> Le sélecteur en haut permet de basculer entre les résultats MC et LHS. Le LHS offre une couverture plus uniforme de l'espace des paramètres et converge plus vite (variance réduite à N fixé).</p>
        <p><strong className="text-foreground">Contrôles :</strong> Play/Pause lance l'animation. Le curseur permet de naviguer manuellement. Le bouton vitesse accélère la progression.</p>
        <p><strong className="text-foreground">Variables affichées :</strong></p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Demande totale (ktep) — somme des 5 secteurs avec résidus corrélés</li>
          <li>Disponibilité solaire h_PV — loi Beta(5.76, 3.84), stationnaire</li>
          <li>Disponibilité éolienne h_Wind — normale tronquée N[0,1](0.296, 0.035²)</li>
          <li>CAPEX PV — GBM avec μ = −5%/an, σ = 10%</li>
          <li>Prix du gaz — GARCH(1,1) avec persistance α+β = 0.95</li>
        </ul>
      </PageInfo>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Animation temporelle</h1>
        <p className="text-muted-foreground">
          Les courbes se tracent en temps reel de {params.startYear} a {params.endYear} — appuyez sur Play.
        </p>
      </div>

      <MethodSelector method={method} setMethod={m => { setMethod(m); setCurrentYearIndex(0); setIsPlaying(false) }} hasMC={!!result} hasLHS={!!lhsResult} />

      {/* Controls */}
      <Card className="mb-8">
        <CardHeader><CardTitle>Controles</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center gap-4">
            <span className="text-muted-foreground">Annee :</span>
            <span className="text-5xl font-bold text-primary">{currentYear}</span>
          </div>

          <div className="space-y-2">
            <Slider
              value={[currentYearIndex]}
              onValueChange={([value]) => { setCurrentYearIndex(value); setIsPlaying(false) }}
              min={0} max={years.length - 1} step={1} className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{params.startYear}</span>
              <span>{params.endYear}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button onClick={togglePlay} size="lg" className="w-32 gap-2">
              {isPlaying ? <><Pause className="h-4 w-4" />Pause</> : <><Play className="h-4 w-4" />Play</>}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setSpeed(Math.max(100, speed - 100))} disabled={speed <= 100}>
              <FastForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-center gap-4">
            <span className="text-sm text-muted-foreground">Vitesse :</span>
            <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={100} max={1000} step={100} className="w-48" />
            <span className="text-sm text-muted-foreground w-20">{speed} ms</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats snapshot */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Demande moyenne" value={(statistics.demand.mean[currentYearIndex] / 1000).toFixed(1)} unit="Mtep" q5={statistics.demand.q5[currentYearIndex] / 1000} q95={statistics.demand.q95[currentYearIndex] / 1000} />
        <StatCard label="Solaire moyen"   value={(statistics.solarAvailability.mean[currentYearIndex] * 100).toFixed(1)} unit="%" q5={statistics.solarAvailability.q5[currentYearIndex] * 100} q95={statistics.solarAvailability.q95[currentYearIndex] * 100} />
        <StatCard label="Eolien moyen"    value={(statistics.windAvailability.mean[currentYearIndex] * 100).toFixed(1)} unit="%" q5={statistics.windAvailability.q5[currentYearIndex] * 100} q95={statistics.windAvailability.q95[currentYearIndex] * 100} />
        <StatCard label="CAPEX PV"        value={statistics.capexPv.mean[currentYearIndex].toFixed(0)} unit="€/kW" q5={statistics.capexPv.q5[currentYearIndex]} q95={statistics.capexPv.q95[currentYearIndex]} />
        <StatCard label="Prix gaz"        value={statistics.gasPrice.mean[currentYearIndex].toFixed(2)} unit="€/MBtu" q5={statistics.gasPrice.q5[currentYearIndex]} q95={statistics.gasPrice.q95[currentYearIndex]} />
      </div>

      {/* Time-series charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <TrajectoryChart
          title="Demande energetique totale"
          description="Moyenne ± IC 90% (ktep)"
          data={demandData}
          startYear={params.startYear} endYear={params.endYear}
          color="var(--chart-1)"
          unit="ktep"
          decimals={0}
        />
        <TrajectoryChart
          title="Disponibilite solaire h_PV"
          description="Moyenne ± IC 90% (%)"
          data={solarData}
          startYear={params.startYear} endYear={params.endYear}
          color="var(--chart-3)"
          unit="%"
          decimals={1}
        />
        <TrajectoryChart
          title="Disponibilite eolienne h_Wind"
          description="Moyenne ± IC 90% (%)"
          data={windData}
          startYear={params.startYear} endYear={params.endYear}
          color="var(--chart-5)"
          unit="%"
          decimals={2}
        />
        <TrajectoryChart
          title="CAPEX solaire (GBM)"
          description="Moyenne ± IC 90% (€/kW)"
          data={capexData}
          startYear={params.startYear} endYear={params.endYear}
          color="var(--chart-2)"
          unit="€/kW"
          decimals={0}
        />
        <TrajectoryChart
          title="Prix du gaz (GARCH 1,1)"
          description="Moyenne ± IC 90% (€/MBtu)"
          data={gasData}
          startYear={params.startYear} endYear={params.endYear}
          color="var(--chart-4)"
          unit="€/MBtu"
          decimals={2}
          fullWidth
        />
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, q5, q95 }: { label: string; value: string; unit: string; q5: number; q95: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-3xl font-bold">{value}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          IC 90% : [{q5.toFixed(1)} – {q95.toFixed(1)}]
        </p>
      </CardContent>
    </Card>
  )
}

function TrajectoryChart({
  title, description, data, startYear, endYear, color, unit, decimals, fullWidth,
}: {
  title: string
  description: string
  data: { year: number; mean: number; q5: number; q95: number }[]
  startYear: number
  endYear: number
  color: string
  unit: string
  decimals: number
  fullWidth?: boolean
}) {
  const chartData = data.map(d => ({ ...d, band: [d.q5, d.q95] as [number, number] }))
  const gradId = `grad-${color.replace(/[^a-z0-9]/gi, "")}`

  return (
    <Card className={fullWidth ? "lg:col-span-2" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              {/* Fixed domain keeps axis stable while data grows */}
              <XAxis
                dataKey="year"
                type="number"
                domain={[startYear, endYear]}
                tickCount={6}
                stroke="var(--muted-foreground)"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                width={50}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(decimals)}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)", fontSize: 12 }}
                formatter={(value: number | [number, number], name: string) => {
                  if (name === "band") return null
                  return [`${typeof value === "number" ? value.toFixed(decimals) : ""} ${unit}`, name === "mean" ? "Moyenne" : name]
                }}
                labelFormatter={(y: number) => `Année ${y}`}
              />
              {/* IC 90% band — no internal animation, data reveal IS the animation */}
              <Area
                type="monotone"
                dataKey="band"
                fill={`url(#${gradId})`}
                stroke="none"
                activeDot={false}
                legendType="none"
                isAnimationActive={false}
              />
              {/* Mean trajectory */}
              <Line
                type="monotone"
                dataKey="mean"
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: color }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

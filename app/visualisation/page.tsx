"use client"

import { useState, useEffect, useRef } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RotateCw } from "lucide-react"
import { MethodSelector } from "@/components/method-selector"
import { PageInfo } from "@/components/page-info"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Legend,
  ReferenceArea,
} from "recharts"

// ── Segmentation algorithm ────────────────────────────────────────────────────

interface Segment {
  x1: number      // start year
  x2: number      // end year
  slope: number   // mean annualised change (original units)
  slopePct: number // % change per year
  label: string
  explanation: string
  color: string
}

// Ordinary least-squares slope for a slice of values
function olsSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const xs = Array.from({ length: n }, (_, i) => i)
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  const num = xs.reduce((acc, x, i) => acc + (x - xMean) * (values[i] - yMean), 0)
  const den = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0)
  return den === 0 ? 0 : num / den
}

// Sum of squared residuals for a linear fit
function ssr(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const slope = olsSlope(values)
  const yMean = values.reduce((a, b) => a + b, 0) / n
  const intercept = yMean - slope * (n - 1) / 2
  return values.reduce((acc, v, i) => acc + (v - (intercept + slope * i)) ** 2, 0)
}

// Find the single best split point that minimises total SSR
function bestSplit(values: number[]): number {
  const n = values.length
  let best = Infinity, bestIdx = Math.floor(n / 2)
  for (let k = 3; k <= n - 3; k++) {
    const s = ssr(values.slice(0, k)) + ssr(values.slice(k))
    if (s < best) { best = s; bestIdx = k }
  }
  return bestIdx
}

function segmentLabel(slope: number, mean: number, variable: string): { label: string; explanation: string; color: string } {
  const pctPerYear = mean !== 0 ? (slope / mean) * 100 : 0
  const abs = Math.abs(pctPerYear)

  if (variable === "capex") {
    if (slope < -20) return { label: "Baisse rapide", explanation: "Economies d'echelle et effets d'apprentissage technologique accelerent la reduction des couts d'investissement PV.", color: "var(--chart-2)" }
    if (slope < 0)   return { label: "Baisse moderee", explanation: "Maturite progressive du marche solaire, la courbe d'apprentissage ralentit apres la phase de massification.", color: "var(--chart-3)" }
    return { label: "Stabilisation", explanation: "Le CAPEX atteint un plancher structurel lie aux couts des materiaux et de l'installation.", color: "var(--chart-5)" }
  }
  if (variable === "gas") {
    if (abs > 10)  return { label: "Forte volatilite", explanation: "La persistance GARCH (α+β = 0.95) amplifie les chocs de marche — episodes de tension geopolitique ou de desequilibre offre/demande.", color: "var(--chart-4)" }
    if (slope > 0) return { label: "Hausse tendancielle", explanation: "Rarefaction progressive des reserves, demande mondiale soutenue et transition energetique incomplete maintiennent une pression haussiere.", color: "var(--chart-4)" }
    return { label: "Detente des prix", explanation: "Developpement des EnR et diversification du mix energetique reduisent la dependance au gaz, pesant sur les prix.", color: "var(--chart-2)" }
  }
  if (variable === "solar" || variable === "wind") {
    return { label: "Distribution stationnaire", explanation: "La disponibilite renouvelable suit une loi stationnaire (Beta ou normale tronquee) — pas de tendance temporelle, la variabilite est inter-scenario.", color: "var(--chart-3)" }
  }
  // demand
  if (abs > 4)  return { label: "Forte croissance", explanation: "Croissance economique soutenue, urbanisation rapide et electrification des usages (transport, industrie) tirent la demande energetique.", color: "var(--chart-4)" }
  if (abs > 1.5) return { label: "Croissance moderee", explanation: "Effets des politiques d'efficacite energetique et premiere penetration des EnR commencent a inflechir la trajectoire de demande.", color: "var(--chart-1)" }
  if (abs > 0)   return { label: "Croissance lente", explanation: "Saturation partielle des usages et gains d'efficacite significatifs limitent la progression de la demande sur ce segment.", color: "var(--chart-3)" }
  return { label: "Stabilisation", explanation: "Equilibre entre nouveaux usages energetiques et gains d'efficacite — demande proche d'un plateau structurel.", color: "var(--chart-5)" }
}

function computeSegments(
  values: number[],
  years: number[],
  variable: string,
  nSegs: number = 3
): Segment[] {
  const n = values.length
  if (n < 6) return []

  // Find up to 2 split points for 3 segments
  const splits: number[] = []
  if (nSegs >= 2) {
    splits.push(bestSplit(values))
  }
  if (nSegs >= 3 && n > 8) {
    const sp1 = splits[0]
    const left  = bestSplit(values.slice(0, sp1))
    const right = bestSplit(values.slice(sp1))
    // Keep the split that improves SSR more
    const gainLeft  = ssr(values.slice(0, sp1)) - (ssr(values.slice(0, left)) + ssr(values.slice(left, sp1)))
    const gainRight = ssr(values.slice(sp1))    - (ssr(values.slice(sp1, sp1 + right)) + ssr(values.slice(sp1 + right)))
    if (gainLeft > gainRight) splits.unshift(left)
    else splits.push(sp1 + right)
  }
  splits.sort((a, b) => a - b)

  const boundaries = [0, ...splits, n]
  return boundaries.slice(0, -1).map((start, k) => {
    const end = boundaries[k + 1]
    const slice = values.slice(start, end)
    const slope = olsSlope(slice)
    const mean  = slice.reduce((a, b) => a + b, 0) / slice.length
    const { label, explanation, color } = segmentLabel(slope, mean, variable)
    return {
      x1: years[start],
      x2: years[end - 1],
      slope,
      slopePct: mean !== 0 ? (slope / mean) * 100 : 0,
      label,
      explanation,
      color,
    }
  })
}

// ── Animation hook ────────────────────────────────────────────────────────────

const ANIM_MS = 1100

function useDrawAnimation(totalPoints: number, trigger: unknown) {
  const [visible, setVisible] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!totalPoints) return
    if (timerRef.current) clearInterval(timerRef.current)
    setVisible(0)
    const step = Math.ceil(ANIM_MS / (totalPoints * 16))
    let cur = 0
    timerRef.current = setInterval(() => {
      cur += step
      if (cur >= totalPoints) { setVisible(totalPoints); clearInterval(timerRef.current!) }
      else setVisible(cur)
    }, 16)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, totalPoints])

  return Math.max(1, visible)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VisualisationPage() {
  const { result, lhsResult, params } = useSimulation()
  const [method, setMethod] = useState<"mc" | "lhs">("mc")
  const activeResult = method === "mc" ? result : lhsResult
  const [activeTab, setActiveTab] = useState("demand")
  const numYears = activeResult ? activeResult.scenarios[0].years.length : 0
  const visible = useDrawAnimation(numYears, activeTab + method + (activeResult ? "1" : "0"))

  if (!result && !lhsResult) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Visualisation globale</h1>
          <p className="text-muted-foreground">Visualisez l&apos;ensemble des scenarios generes.</p>
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
          <h1 className="text-3xl font-bold mb-2">Visualisation globale</h1>
        </div>
        <MethodSelector method={method} setMethod={setMethod} hasMC={!!result} hasLHS={!!lhsResult} />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Aucun resultat {method === "lhs" ? "LHS" : "Monte Carlo"} — lancez une simulation.</p>
            <Button asChild><Link href="/generation">Lancer une simulation</Link></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const years = activeResult.scenarios[0].years
  const v = visible
  const sx = params.startYear
  const ex = params.endYear

  const xAxisProps = {
    dataKey: "year", type: "number" as const, domain: [sx, ex] as [number, number],
    tickCount: 6, stroke: "var(--muted-foreground)", tick: { fill: "var(--muted-foreground)" },
  }
  const tooltipStyle = {
    contentStyle: { backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" },
  }

  // Sliced datasets
  const demandData = years.slice(0, v).map((year, i) => ({ year, mean: activeResult.statistics.demand.mean[i], q5: activeResult.statistics.demand.q5[i], q95: activeResult.statistics.demand.q95[i] }))
  const solarData  = years.slice(0, v).map((year, i) => ({ year, mean: activeResult.statistics.solarAvailability.mean[i] * 100, q5: activeResult.statistics.solarAvailability.q5[i] * 100, q95: activeResult.statistics.solarAvailability.q95[i] * 100 }))
  const windData   = years.slice(0, v).map((year, i) => ({ year, mean: activeResult.statistics.windAvailability.mean[i] * 100, q5: activeResult.statistics.windAvailability.q5[i] * 100, q95: activeResult.statistics.windAvailability.q95[i] * 100 }))
  const capexData  = years.slice(0, v).map((year, i) => ({ year, mean: activeResult.statistics.capexPv.mean[i], q5: activeResult.statistics.capexPv.q5[i], q95: activeResult.statistics.capexPv.q95[i] }))
  const gasData    = years.slice(0, v).map((year, i) => ({ year, mean: activeResult.statistics.gasPrice.mean[i], q5: activeResult.statistics.gasPrice.q5[i], q95: activeResult.statistics.gasPrice.q95[i] }))

  // Segmentation — computed on full series (not sliced)
  const segDemand = computeSegments(activeResult.statistics.demand.mean, years, "demand")
  const segSolar  = computeSegments(activeResult.statistics.solarAvailability.mean.map(x => x * 100), years, "solar", 1)
  const segWind   = computeSegments(activeResult.statistics.windAvailability.mean.map(x => x * 100), years, "wind", 1)
  const segCapex  = computeSegments(activeResult.statistics.capexPv.mean, years, "capex")
  const segGas    = computeSegments(activeResult.statistics.gasPrice.mean, years, "gas")

  // Demand cloud
  const sampleSize = Math.min(50, activeResult.scenarios.length)
  const sampledIndices = Array.from({ length: sampleSize }, (_, i) => Math.floor(i * activeResult.scenarios.length / sampleSize))
  const demandCloud = years.slice(0, v).map((year, i) => {
    const row: Record<string, number> = { year, mean: activeResult.statistics.demand.mean[i] }
    sampledIndices.forEach((idx, j) => { row[`s${j}`] = activeResult.scenarios[idx].demand.total[i] })
    return row
  })

  const handleTabChange = (val: string) => setActiveTab(val)

  return (
    <div className="max-w-6xl mx-auto">
      <PageInfo title="Visualisation globale — Guide">
        <p><strong className="text-foreground">Animation de tracé :</strong> Chaque fois que vous changez d'onglet, le graphe se redessine avec une animation de 1.1 secondes — les données apparaissent progressivement de gauche à droite.</p>
        <p><strong className="text-foreground">Onglets disponibles :</strong></p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-foreground">Demande :</strong> nuage de {sampleSize} trajectoires individuelles + moyenne</li>
          <li><strong className="text-foreground">Solaire / Eolien :</strong> moyenne avec bande Q5–Q95 et gradient de confiance</li>
          <li><strong className="text-foreground">CAPEX PV :</strong> trajectoire GBM avec incertitude croissante</li>
          <li><strong className="text-foreground">Prix Gaz :</strong> processus GARCH(1,1) avec clustering de volatilité</li>
        </ul>
        <p><strong className="text-foreground">Zones colorées (segmentation OLS) :</strong> L'algorithme identifie automatiquement 2–3 régimes dans chaque trajectoire en minimisant la somme des carrés des résidus (SSR) par rapport à une droite de régression par segment. Chaque zone colorée correspond à un régime distinct avec sa pente et son interprétation économique.</p>
        <p><strong className="text-foreground">MC vs LHS :</strong> Comparez les deux méthodes avec le sélecteur. Avec LHS, la bande Q5–Q95 sera généralement plus étroite à même nombre de scénarios — la stratification réduit la variance des estimateurs de quantiles.</p>
      </PageInfo>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Visualisation globale</h1>
        <p className="text-muted-foreground">
          Scenarios {method.toUpperCase()} avec moyenne, intervalles Q5–Q95 et segmentation automatique de la trajectoire
        </p>
      </div>

      <MethodSelector method={method} setMethod={m => { setMethod(m) }} hasMC={!!result} hasLHS={!!lhsResult} />

      <Tabs defaultValue="demand" onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
          <TabsTrigger value="demand">Demande</TabsTrigger>
          <TabsTrigger value="solar">Solaire</TabsTrigger>
          <TabsTrigger value="wind">Eolien</TabsTrigger>
          <TabsTrigger value="capex">CAPEX PV</TabsTrigger>
          <TabsTrigger value="gas">Prix Gaz</TabsTrigger>
        </TabsList>

        {/* ── DEMANDE ── */}
        <TabsContent value="demand">
          <ChartCard
            title="Demande energetique totale"
            description={`Nuage de ${activeResult.scenarios.length} trajectoires (ktep) avec moyenne et segments`}
            segments={segDemand}
            backContent={
              <>
                <h3 className="font-semibold text-foreground text-base mb-2">Demande energetique — Lecture du nuage</h3>
                <p>Chaque ligne bleue fine représente la trajectoire d'un scénario individuel. L'ensemble forme le <strong className="text-foreground">cône d'incertitude</strong> de la demande — sa largeur croissante traduit l'accumulation des chocs stochastiques dans le temps.</p>
                <p><strong className="text-foreground">Courbe épaisse (moyenne) :</strong> estimateur de E[D_t]. Elle suit la tendance polynomiale calibrée sur données historiques.</p>
                <p><strong className="text-foreground">Zones colorées (OLS piecewise) :</strong> L'algorithme de segmentation divise la trajectoire en 2–3 régimes en minimisant la SSR. Chaque zone a sa propre pente et son interprétation économique affichées ci-dessous le graphe.</p>
                <p><strong className="text-foreground">Décomposition :</strong> D_total = D_résidentiel + D_industriel + D_transport + D_agriculture + D_tertiaire, chacun avec résidus gaussiens corrélés par décomposition de Cholesky.</p>
              </>
            }
          >
            <ComposedChart data={demandCloud}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis {...xAxisProps} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(0)} ktep`, ""]} />
              {segDemand.map((seg, k) => (
                <ReferenceArea key={k} x1={seg.x1} x2={seg.x2} fill={seg.color} fillOpacity={0.07} />
              ))}
              {sampledIndices.map((_, j) => (
                <Line key={j} type="monotone" dataKey={`s${j}`} stroke="var(--chart-1)" strokeWidth={0.5} strokeOpacity={0.2} dot={false} isAnimationActive={false} legendType="none" />
              ))}
              <Line type="monotone" dataKey="mean" stroke="var(--chart-2)" strokeWidth={3} dot={false} name="Moyenne" isAnimationActive={false} />
            </ComposedChart>
          </ChartCard>
        </TabsContent>

        {/* ── SOLAIRE ── */}
        <TabsContent value="solar">
          <ChartCard title="Disponibilite solaire h_PV" description="Facteur de capacite solaire (%) — Beta(5.76, 3.84)" segments={segSolar}
            backContent={
              <>
                <h3 className="font-semibold text-foreground text-base mb-2">Disponibilite solaire — Loi Beta</h3>
                <p>h_PV ~ Beta(α = 5.76, β = 3.84). La loi Beta est naturellement bornée sur [0, 1], propriété essentielle pour un facteur de capacité (impossible d'avoir &gt;100% ou &lt;0%).</p>
                <p><strong className="text-foreground">Paramètres calibrés :</strong> E[h_PV] = 5.76/(5.76+3.84) ≈ 0.60 (60%), σ ≈ 0.05 (5%). Ces valeurs correspondent aux mesures d'irradiation globale horizontale (GHI) des stations météo algériennes.</p>
                <p><strong className="text-foreground">Distribution stationnaire :</strong> Pas de tendance temporelle — la bande Q5–Q95 reste constante. La variabilité est purement inter-scénarios, représentant la variabilité naturelle inter-annuelle.</p>
                <p><strong className="text-foreground">Segmentation :</strong> Sur une loi stationnaire, la segmentation OLS identifie un seul régime (pas de rupture de pente). C'est le comportement attendu.</p>
              </>
            }
          >
            <ComposedChart data={solarData}>
              <defs>
                <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--chart-3)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis {...xAxisProps} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, ""]} />
              <Legend />
              {segSolar.map((seg, k) => <ReferenceArea key={k} x1={seg.x1} x2={seg.x2} fill={seg.color} fillOpacity={0.07} />)}
              <Area type="monotone" dataKey="q95" fill="url(#gSolar)" stroke="var(--chart-3)" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" name="Q95" isAnimationActive={false} />
              <Area type="monotone" dataKey="q5"  fill="var(--background)" stroke="var(--chart-3)" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" name="Q5" isAnimationActive={false} />
              <Line type="monotone" dataKey="mean" stroke="var(--chart-3)" strokeWidth={2.5} dot={false} name="Moyenne" isAnimationActive={false} />
            </ComposedChart>
          </ChartCard>
        </TabsContent>

        {/* ── EOLIEN ── */}
        <TabsContent value="wind">
          <ChartCard title="Disponibilite eolienne h_Wind" description="Facteur de capacite eolien (%) — N[0,1](0.296, 0.035²)" segments={segWind}
            backContent={
              <>
                <h3 className="font-semibold text-foreground text-base mb-2">Disponibilite eolienne — Normale tronquee</h3>
                <p>h_Wind ~ N_tronq[0,1](μ = 0.296, σ = 0.035). La troncature sur [0, 1] est appliquée par rejet des tirages hors-bornes. À μ = 0.296, la probabilité de troncature est très faible.</p>
                <p><strong className="text-foreground">Comparaison solaire/éolien :</strong> Le facteur de capacité éolien (~30%) est significativement inférieur au solaire (~60%) pour l'Algérie. Cependant, l'éolien produit de nuit et en hiver quand le solaire est faible — complémentarité des ressources.</p>
                <p><strong className="text-foreground">Variance plus faible :</strong> σ = 3.5% pour l'éolien vs ~5% pour le solaire — la ressource éolienne est plus régulière en Algérie, notamment dans les régions sahariennes.</p>
              </>
            }
          >
            <ComposedChart data={windData}>
              <defs>
                <linearGradient id="gWind" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--chart-5)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-5)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis {...xAxisProps} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }} tickFormatter={v => `${v}%`} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, ""]} />
              <Legend />
              {segWind.map((seg, k) => <ReferenceArea key={k} x1={seg.x1} x2={seg.x2} fill={seg.color} fillOpacity={0.07} />)}
              <Area type="monotone" dataKey="q95" fill="url(#gWind)" stroke="var(--chart-5)" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" name="Q95" isAnimationActive={false} />
              <Area type="monotone" dataKey="q5"  fill="var(--background)" stroke="var(--chart-5)" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" name="Q5" isAnimationActive={false} />
              <Line type="monotone" dataKey="mean" stroke="var(--chart-5)" strokeWidth={2.5} dot={false} name="Moyenne" isAnimationActive={false} />
            </ComposedChart>
          </ChartCard>
        </TabsContent>

        {/* ── CAPEX ── */}
        <TabsContent value="capex">
          <ChartCard title="CAPEX solaire (GBM)" description="Cout d'investissement PV (€/kW) — c₀ = 800, μ = −5%/an, σ = 10%" segments={segCapex}
            backContent={
              <>
                <h3 className="font-semibold text-foreground text-base mb-2">CAPEX PV — Mouvement Brownien Geometrique</h3>
                <p>Équation : dc/c = μ dt + σ dW_t, solution : c_t = c₀ · exp((μ − σ²/2)t + σ√t · Z), Z ~ N(0,1).</p>
                <p><strong className="text-foreground">Paramètres :</strong> c₀ = 800 €/kW (valeur initiale 2024), μ = −0.05 (baisse de 5%/an en tendance), σ = 0.10 (volatilité de 10%/an).</p>
                <p><strong className="text-foreground">Variance croissante :</strong> La bande Q5–Q95 s'élargit dans le temps — c'est une propriété du GBM. L'incertitude sur le CAPEX en 2050 est bien plus grande qu'en 2030.</p>
                <p><strong className="text-foreground">Learning rate :</strong> La tendance μ = −5%/an est cohérente avec un learning rate de ~20% par doublement de capacité installée mondiale (donnée IRENA/IEA).</p>
                <p><strong className="text-foreground">Segmentation :</strong> Les segments OLS capturent les phases d'accélération et de ralentissement de la baisse des coûts — phases de "choc technologique" vs "maturité de marché".</p>
              </>
            }
          >
            <ComposedChart data={capexData}>
              <defs>
                <linearGradient id="gCapex" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--chart-2)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis {...xAxisProps} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }} tickFormatter={v => `${v}€`} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(0)} €/kW`, ""]} />
              <Legend />
              {segCapex.map((seg, k) => <ReferenceArea key={k} x1={seg.x1} x2={seg.x2} fill={seg.color} fillOpacity={0.07} />)}
              <Area type="monotone" dataKey="q95" fill="url(#gCapex)" stroke="var(--chart-2)" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" name="Q95" isAnimationActive={false} />
              <Area type="monotone" dataKey="q5"  fill="var(--background)" stroke="var(--chart-2)" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" name="Q5" isAnimationActive={false} />
              <Line type="monotone" dataKey="mean" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} name="Moyenne" isAnimationActive={false} />
            </ComposedChart>
          </ChartCard>
        </TabsContent>

        {/* ── GAZ ── */}
        <TabsContent value="gas">
          <ChartCard title="Prix du gaz (GARCH 1,1)" description="Evolution du prix (€/MBtu) — α+β = 0.95, forte persistance" segments={segGas}
            backContent={
              <>
                <h3 className="font-semibold text-foreground text-base mb-2">Prix du gaz — GARCH(1,1)</h3>
                <p>Modèle à variance conditionnelle : r_t = μ + ε_t, ε_t = σ_t · Z_t, σ²_t = ω + α·ε²(t-1) + β·σ²(t-1).</p>
                <p><strong className="text-foreground">Paramètres :</strong> ω = 0.0002, α = 0.10, β = 0.85. Persistance α+β = 0.95 (proche de l'unité — "integrated GARCH").</p>
                <p><strong className="text-foreground">Clustering de volatilité :</strong> Les épisodes de forte volatilité se regroupent et persistent. Un choc en 2030 peut maintenir une variance élevée jusqu'en 2035+. C'est ce que capture le paramètre β élevé.</p>
                <p><strong className="text-foreground">Variance inconditionnelle :</strong> σ²∞ = ω/(1−α−β) = 0.0002/(1−0.95) = 0.004. L'écart-type inconditionnel est ≈ 6% par an.</p>
                <p><strong className="text-foreground">Segmentation :</strong> Les segments OLS sur la moyenne identifient les périodes de hausse tendancielle (pression géopolitique) vs de détente (transition énergétique). La variabilité autour de ces tendances est capturée par les bandes Q5–Q95.</p>
              </>
            }
          >
            <ComposedChart data={gasData}>
              <defs>
                <linearGradient id="gGas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--chart-4)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis {...xAxisProps} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }} tickFormatter={v => `${v}€`} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)} €/MBtu`, ""]} />
              <Legend />
              {segGas.map((seg, k) => <ReferenceArea key={k} x1={seg.x1} x2={seg.x2} fill={seg.color} fillOpacity={0.07} />)}
              <Area type="monotone" dataKey="q95" fill="url(#gGas)" stroke="var(--chart-4)" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" name="Q95" isAnimationActive={false} />
              <Area type="monotone" dataKey="q5"  fill="var(--background)" stroke="var(--chart-4)" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" name="Q5" isAnimationActive={false} />
              <Line type="monotone" dataKey="mean" stroke="var(--chart-4)" strokeWidth={2.5} dot={false} name="Moyenne" isAnimationActive={false} />
            </ComposedChart>
          </ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── ChartCard wraps chart + segment legend + flip ─────────────────────────────

function ChartCard({ title, description, segments, backContent, children }: {
  title: string
  description: string
  segments: Segment[]
  backContent?: React.ReactNode
  children: React.ReactNode
}) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setFlipped(f => !f)}
        className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-secondary/90 border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <RotateCw className="h-3 w-3" />
        {flipped ? "Graphe" : "Explication"}
      </button>

      <div style={{ perspective: "1200px" }}>
        <div
          className="transition-transform duration-500"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* Front — in flow, defines height */}
          <div style={{ backfaceVisibility: "hidden" }}>
            <Card>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[460px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {children as React.ReactElement}
                  </ResponsiveContainer>
                </div>

                {segments.length > 0 && (
                  <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {segments.map((seg, k) => (
                      <div key={k} className="rounded-lg border border-border p-3" style={{ borderLeftColor: seg.color, borderLeftWidth: 3 }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold" style={{ color: seg.color }}>{seg.label}</span>
                          <span className="text-xs text-muted-foreground">{seg.x1}–{seg.x2}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{seg.explanation}</p>
                        <p className="text-xs font-mono mt-1 text-muted-foreground">
                          Pente moy. : {seg.slope > 0 ? "+" : ""}{seg.slope.toFixed(2)} u/an
                          {" "}({seg.slopePct > 0 ? "+" : ""}{seg.slopePct.toFixed(1)}%/an)
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Back — absolutely covers same area */}
          <div
            className="absolute inset-0 overflow-y-auto rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground leading-relaxed space-y-3"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            {backContent}
          </div>
        </div>
      </div>
    </div>
  )
}

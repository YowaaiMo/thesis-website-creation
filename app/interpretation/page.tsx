"use client"

import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, GitCompare } from "lucide-react"
import type { SimulationResult } from "@/lib/monte-carlo"

// ── helpers ──────────────────────────────────────────────────────────────────

function pct(v: number, digits = 1) { return `${v.toFixed(digits)}%` }
function fmt(v: number, d = 0)      { return v.toFixed(d) }
function cagr(v0: number, vN: number, years: number) {
  return ((Math.pow(vN / v0, 1 / years) - 1) * 100)
}

// ── text builders ─────────────────────────────────────────────────────────────

function interpretDemand(r: SimulationResult, startYear: number, endYear: number) {
  const T = endYear - startYear
  const mean0 = r.statistics.demand.mean[0]
  const meanN = r.statistics.demand.mean[r.statistics.demand.mean.length - 1]
  const stdN  = r.statistics.demand.std[r.statistics.demand.std.length - 1]
  const q5N   = r.statistics.demand.q5[r.statistics.demand.q5.length - 1]
  const q95N  = r.statistics.demand.q95[r.statistics.demand.q95.length - 1]
  const cv    = (stdN / meanN) * 100
  const g     = cagr(mean0, meanN, T)

  const trendLabel = g > 3 ? "forte croissance" : g > 1 ? "croissance moderee" : "croissance faible"

  return {
    icon: TrendingUp,
    color: "text-chart-1",
    title: "Demande energetique totale",
    bullets: [
      `Tendance : ${trendLabel} de ${pct(g)} par an en moyenne sur ${T} ans.`,
      `En ${endYear}, la demande moyenne est de ${fmt(meanN, 0)} ktep (contre ${fmt(mean0, 0)} ktep en ${startYear}).`,
      `Intervalle de confiance a 90% en ${endYear} : [${fmt(q5N, 0)} — ${fmt(q95N, 0)}] ktep (amplitude ${fmt(q95N - q5N, 0)} ktep).`,
      `Coefficient de variation en ${endYear} : ${pct(cv)} — ${cv > 10 ? "dispersion notable, planification avec marges recommandee" : "dispersion maitrisee"}.`,
      `Ecart min/max en ${endYear} : ${fmt(r.statistics.demand.min[r.statistics.demand.min.length-1], 0)} — ${fmt(r.statistics.demand.max[r.statistics.demand.max.length-1], 0)} ktep.`,
    ]
  }
}

function interpretSolar(r: SimulationResult) {
  const mu  = r.statistics.solarAvailability.mean[0] * 100
  const std = r.statistics.solarAvailability.std[0]  * 100
  const cv  = std / mu * 100
  return {
    icon: TrendingUp,
    color: "text-chart-3",
    title: "Disponibilite solaire h_PV ~ Beta(5.76, 3.84)",
    bullets: [
      `Facteur de capacite moyen : ${pct(mu)} — conforme au gisement solaire algerien exceptionnel.`,
      `Ecart-type inter-annuel : ${pct(std, 2)} (CV = ${pct(cv, 1)}).`,
      `La loi Beta garantit h_PV ∈ [0, 1] sans troncature artificielle.`,
      `Avec α = 5.76 et β = 3.84, la distribution est legerement asymetrique vers les hautes valeurs d'ensoleillement.`,
      `Implication : une partie des scenarios connaitra des annees excellentes (h_PV > 75%), justifiant un surdimensionnement modere.`,
    ]
  }
}

function interpretWind(r: SimulationResult) {
  const mu  = r.statistics.windAvailability.mean[0] * 100
  const std = r.statistics.windAvailability.std[0]  * 100
  return {
    icon: Info,
    color: "text-chart-5",
    title: "Disponibilite eolienne h_Wind ~ N[0,1](0.296, 0.035²)",
    bullets: [
      `Facteur de capacite moyen : ${pct(mu)} — ressource moderee mais stable.`,
      `Ecart-type : ${pct(std, 2)} (faible dispersion inter-annuelle).`,
      `La normale tronquee a [0,1] empeche toute valeur physiquement impossible.`,
      `La faible variabilite relative (CV ≈ ${pct(std / mu * 100, 1)}) indique une ressource plus predictible que le solaire.`,
      `Les deux ressources renouvelables sont considerees independantes dans le modele stochastique.`,
    ]
  }
}

function interpretCapex(r: SimulationResult, startYear: number, endYear: number) {
  const T   = endYear - startYear
  const c0  = r.statistics.capexPv.mean[0]
  const cN  = r.statistics.capexPv.mean[r.statistics.capexPv.mean.length - 1]
  const cq5 = r.statistics.capexPv.q5[r.statistics.capexPv.q5.length - 1]
  const cq95 = r.statistics.capexPv.q95[r.statistics.capexPv.q95.length - 1]
  const g   = cagr(c0, cN, T)
  return {
    icon: TrendingDown,
    color: "text-chart-2",
    title: "CAPEX solaire (GBM) : c₀ = 800 €/kW, μ = −5%/an, σ = 10%",
    bullets: [
      `Cout initial : ${fmt(c0, 0)} €/kW en ${startYear}.`,
      `Cout moyen en ${endYear} : ${fmt(cN, 0)} €/kW — soit une baisse de ${pct(Math.abs(g))} par an en moyenne.`,
      `Intervalle de confiance a 90% en ${endYear} : [${fmt(cq5, 0)} — ${fmt(cq95, 0)}] €/kW.`,
      `Le mouvement brownien geometrique garantit des couts toujours positifs.`,
      `La forte dispersion (± ${fmt(cq95 - cN, 0)} €/kW au-dessus de la moyenne) illustre l'incertitude technologique : scenarios de rupture rapide vs. retard d'apprentissage.`,
      `Implication : les projets d'investissement PV doivent etre robustes aux variations de CAPEX.`,
    ]
  }
}

function interpretGas(r: SimulationResult, endYear: number) {
  const p0  = r.statistics.gasPrice.mean[0]
  const pN  = r.statistics.gasPrice.mean[r.statistics.gasPrice.mean.length - 1]
  const pq95 = r.statistics.gasPrice.q95[r.statistics.gasPrice.q95.length - 1]
  const stdN = r.statistics.gasPrice.std[r.statistics.gasPrice.std.length - 1]
  const cv   = stdN / pN * 100
  return {
    icon: AlertTriangle,
    color: "text-chart-4",
    title: "Prix du gaz (GARCH 1,1) : P₀ = 4.5 €/MBtu, α+β = 0.95",
    bullets: [
      `Prix moyen en ${endYear} : ${fmt(pN, 2)} €/MBtu (contre ${fmt(p0, 2)} en depart).`,
      `Q95 en ${endYear} : ${fmt(pq95, 2)} €/MBtu — un scenario sur vingt depasse ce seuil.`,
      `CV en ${endYear} : ${pct(cv)} — forte incertitude inherente aux marches energetiques.`,
      `La persistance α + β = 0.95 signifie que les chocs de prix ont des effets durables (memoire longue).`,
      `Le clustering de volatilite GARCH capture les episodes de tension geopolitique observes historiquement.`,
      `Risque : dans les scenarios adverses, le cout operationnel du gaz peut multiplier par ${fmt(pq95 / p0, 1)} le prix initial.`,
    ]
  }
}

function interpretExtremes(r: SimulationResult, endYear: number) {
  const { extremeScenarios, scenarios, statistics } = r
  const pess = scenarios[extremeScenarios.pessimistic]
  const li   = pess.demand.total.length - 1

  const demandRatio = (pess.demand.total[li] / statistics.demand.mean[li] - 1) * 100
  const gasRatio    = (pess.gasPrice[li]     / statistics.gasPrice.mean[li] - 1) * 100
  const capexRatio  = (pess.capexPv[li]      / statistics.capexPv.mean[li]  - 1) * 100
  const solarRatio  = (pess.solarAvailability.reduce((a,b)=>a+b,0)/pess.solarAvailability.length /
                       statistics.solarAvailability.mean.reduce((a,b)=>a+b,0)/statistics.solarAvailability.mean.length - 1) * 100

  return {
    icon: AlertTriangle,
    color: "text-destructive",
    title: `Scenario pessimiste (Scenario #${extremeScenarios.pessimistic + 1})`,
    bullets: [
      `Demande en ${endYear} : ${fmt(pess.demand.total[li], 0)} ktep (${demandRatio > 0 ? "+" : ""}${pct(demandRatio)} vs. moyenne).`,
      `Prix du gaz en ${endYear} : ${fmt(pess.gasPrice[li], 2)} €/MBtu (${gasRatio > 0 ? "+" : ""}${pct(gasRatio)} vs. moyenne).`,
      `CAPEX PV en ${endYear} : ${fmt(pess.capexPv[li], 0)} €/kW (${capexRatio > 0 ? "+" : ""}${pct(capexRatio)} vs. moyenne).`,
      `Disponibilite solaire moyenne : ${pct(pess.solarAvailability.reduce((a,b)=>a+b,0)/pess.solarAvailability.length*100)} (${solarRatio > 0 ? "+" : ""}${pct(solarRatio)} vs. moyenne).`,
      `Ce scenario combine une demande elevee, un gaz cher et un faible ensoleillement — il sert de reference pour le dimensionnement robuste du systeme.`,
    ]
  }
}

// Variability growth detection — section 8.2
function interpretVariability(r: SimulationResult, startYear: number, endYear: number) {
  const years = endYear - startYear
  const demStd0  = r.statistics.demand.std[0]
  const demStdN  = r.statistics.demand.std[r.statistics.demand.std.length - 1]
  const demMean0 = r.statistics.demand.mean[0]
  const demMeanN = r.statistics.demand.mean[r.statistics.demand.mean.length - 1]
  const cv0 = demStd0 / demMean0 * 100
  const cvN = demStdN / demMeanN * 100

  const capStd0 = r.statistics.capexPv.std[0]
  const capStdN = r.statistics.capexPv.std[r.statistics.capexPv.std.length - 1]
  const capMean0 = r.statistics.capexPv.mean[0]
  const capMeanN = r.statistics.capexPv.mean[r.statistics.capexPv.mean.length - 1]
  const capCv0 = capStd0 / capMean0 * 100
  const capCvN = capStdN / capMeanN * 100

  const gasStd0 = r.statistics.gasPrice.std[0]
  const gasStdN = r.statistics.gasPrice.std[r.statistics.gasPrice.std.length - 1]
  const gasMean0 = r.statistics.gasPrice.mean[0]
  const gasMeanN = r.statistics.gasPrice.mean[r.statistics.gasPrice.mean.length - 1]
  const gasCv0 = gasStd0 / gasMean0 * 100
  const gasCvN = gasStdN / gasMeanN * 100

  const bullets: string[] = [
    `Demande : CV passe de ${pct(cv0)} en ${startYear} a ${pct(cvN)} en ${endYear} — ${cvN > cv0 * 1.5 ? "forte amplification de l'incertitude sur l'horizon" : cvN > cv0 * 1.1 ? "legere croissance de la dispersion relative" : "dispersion relative stable"}.`,
    `CAPEX PV : CV de ${pct(capCv0, 1)} a ${pct(capCvN, 1)} sur ${years} ans — ${capCvN > capCv0 ? "l'incertitude technologique s'accumule avec le GBM (effet σ√t)" : "la trajectoire GBM converge"}.`,
    `Prix du gaz : CV de ${pct(gasCv0, 1)} a ${pct(gasCvN, 1)} — ${gasCvN > gasCv0 * 2 ? "explosion de l'incertitude (persistance GARCH elevee)" : "incertitude moderee malgre la memoire longue"}.`,
  ]

  // Check mid-period variability spike
  const midIdx = Math.floor(r.statistics.demand.std.length / 2)
  const maxStd = Math.max(...r.statistics.demand.std)
  const maxStdIdx = r.statistics.demand.std.indexOf(maxStd)
  if (maxStdIdx !== r.statistics.demand.std.length - 1 && maxStd > demStdN * 1.1) {
    bullets.push(`Pic de variabilite de la demande autour de ${startYear + maxStdIdx} (ecart-type = ${fmt(maxStd, 0)} ktep) — l'incertitude se concentre en milieu d'horizon.`)
  }

  bullets.push(
    `Synthese : la variabilite croissante sur l'horizon ${startYear}–${endYear} justifie une approche de planification robuste plutot que deterministe.`
  )

  return {
    icon: TrendingUp,
    color: "text-chart-3",
    title: "Analyse de la variabilite et de la dispersion temporelle",
    bullets,
  }
}

// Pettitt-style CUSUM change-point detection (section 8.3 / 9.3)
function detectBreakpoint(values: number[], years: number[]) {
  if (values.length < 5) return null
  const overallMean = values.reduce((a, b) => a + b, 0) / values.length
  let cumsum = 0
  const cumsums: number[] = []
  for (const v of values) { cumsum += v - overallMean; cumsums.push(cumsum) }
  let maxScore = 0, bestIdx = -1
  for (let i = 1; i < cumsums.length - 1; i++) {
    if (Math.abs(cumsums[i]) > maxScore) { maxScore = Math.abs(cumsums[i]); bestIdx = i }
  }
  if (bestIdx < 0) return null
  const beforeSlice = values.slice(0, bestIdx + 1)
  const afterSlice  = values.slice(bestIdx + 1)
  const beforeMean  = beforeSlice.reduce((a, b) => a + b, 0) / beforeSlice.length
  const afterMean   = afterSlice.reduce((a, b)  => a + b, 0) / afterSlice.length
  if (Math.abs(afterMean - beforeMean) / Math.abs(beforeMean) < 0.03) return null
  return { year: years[bestIdx], beforeMean, afterMean }
}

function interpretBreakpoints(r: SimulationResult, startYear: number, endYear: number) {
  const years   = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)
  const demand  = r.statistics.demand.mean
  const capex   = r.statistics.capexPv.mean
  const gas     = r.statistics.gasPrice.mean

  const bpDemand = detectBreakpoint(demand, years)
  const bpCapex  = detectBreakpoint(capex,  years)
  const bpGas    = detectBreakpoint(gas,    years)

  const bullets: string[] = []

  if (bpDemand) {
    const dir = bpDemand.afterMean > bpDemand.beforeMean ? "acceleration" : "deceleration"
    bullets.push(
      `Demande : rupture de tendance detectee vers ${bpDemand.year} — ${dir} de la croissance.` +
      ` Moyenne avant : ${fmt(bpDemand.beforeMean, 0)} ktep ; apres : ${fmt(bpDemand.afterMean, 0)} ktep` +
      ` (${bpDemand.afterMean > bpDemand.beforeMean ? "+" : ""}${pct((bpDemand.afterMean/bpDemand.beforeMean - 1)*100)}).`
    )
  } else {
    bullets.push("Demande : pas de rupture majeure detectee — croissance reguliere sur tout l'horizon.")
  }

  if (bpCapex) {
    const dir = bpCapex.afterMean < bpCapex.beforeMean ? "acceleration de la baisse" : "ralentissement de la baisse"
    bullets.push(
      `CAPEX PV : point de rupture vers ${bpCapex.year} — ${dir}.` +
      ` Cout moyen avant : ${fmt(bpCapex.beforeMean, 0)} €/kW ; apres : ${fmt(bpCapex.afterMean, 0)} €/kW.`
    )
  } else {
    bullets.push("CAPEX PV : trajectoire de baisse continue et reguliere — pas de rupture detectee.")
  }

  if (bpGas) {
    bullets.push(
      `Prix du gaz : changement de regime vers ${bpGas.year}.` +
      ` Prix moyen avant : ${fmt(bpGas.beforeMean, 2)} €/MBtu ; apres : ${fmt(bpGas.afterMean, 2)} €/MBtu.`
    )
  } else {
    bullets.push("Prix du gaz : volatilite uniforme sur l'horizon — pas de changement de regime detecte.")
  }

  // Slope comparison (first half vs second half)
  const mid = Math.floor(demand.length / 2)
  const slope1 = cagr(demand[0], demand[mid], mid)
  const slope2 = cagr(demand[mid], demand[demand.length - 1], demand.length - 1 - mid)
  if (Math.abs(slope2 - slope1) > 0.5) {
    bullets.push(
      `Comparaison des pentes : TCAM demande 1ère moitié = ${pct(slope1)} / an, 2ème moitié = ${pct(slope2)} / an — ${slope2 > slope1 ? "le rythme s'accélère" : "le rythme ralentit"} en fin de période.`
    )
  }

  return {
    icon: Info,
    color: "text-chart-5",
    title: "Detection de ruptures et changements de regime",
    bullets,
  }
}

function interpretMcLhs(r: SimulationResult, lhs: SimulationResult | null) {
  if (!lhs) return null
  const lastI = r.statistics.demand.mean.length - 1
  const mcMu  = r.statistics.demand.mean[lastI]
  const lhsMu = lhs.statistics.demand.mean[lastI]
  const mcS   = r.statistics.demand.std[lastI]
  const lhsS  = lhs.statistics.demand.std[lastI]
  const relDiff = Math.abs(mcMu - lhsMu) / mcS * 100
  const sigRatio = lhsS / mcS

  return {
    icon: GitCompare,
    color: "text-primary",
    title: "Convergence MC vs LHS",
    bullets: [
      `Ecart relatif sur la moyenne de la demande : ${pct(relDiff)} des σ_MC — ${relDiff < 5 ? "excellente convergence" : relDiff < 15 ? "convergence acceptable" : "ecart notable, augmenter S"}.`,
      `Ratio σ LHS / σ MC : ${sigRatio.toFixed(3)} — ${sigRatio < 1 ? `LHS est ${pct((1-sigRatio)*100)} plus efficace` : "MC et LHS divergent legerement sur cet estimateur"}.`,
      `Avec S = ${r.scenarios.length} scenarios, les deux methodes convergent vers les memes quantiles a 90%.`,
      `Le LHS garantit une couverture uniforme de chaque distribution marginale, ce qui le rend superieur au MC pour des budgets de scenarios limites.`,
      `Pour l'optimisation stochastique, les scenarios LHS sont recommandes si S ≤ 200 ; le MC pur pour S ≥ 500.`,
    ]
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InterpretationPage() {
  const { result, lhsResult, params } = useSimulation()

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Interpretation automatique</h1>
          <p className="text-muted-foreground">
            Analyse textuelle automatique des resultats de simulation.
          </p>
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

  const sections = [
    interpretDemand(result, params.startYear, params.endYear),
    interpretSolar(result),
    interpretWind(result),
    interpretCapex(result, params.startYear, params.endYear),
    interpretGas(result, params.endYear),
    interpretVariability(result, params.startYear, params.endYear),
    interpretBreakpoints(result, params.startYear, params.endYear),
    interpretExtremes(result, params.endYear),
  ]

  const mcLhsSection = interpretMcLhs(result, lhsResult)
  if (mcLhsSection) sections.push(mcLhsSection)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Interpretation automatique</h1>
        <p className="text-muted-foreground">
          Analyse textuelle des {result.scenarios.length} scenarios generes ({params.startYear}–{params.endYear}).
          {lhsResult && " Les resultats LHS sont inclus dans la comparaison."}
        </p>
      </div>

      {/* Context banner */}
      <Card className="mb-8 border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <p className="text-sm leading-relaxed">
            <strong>Contexte :</strong> Planification energetique stochastique de l&apos;Algerie 2024–2050.
            Le modele simule 8 variables incertaines (demande sectorielle, disponibilite solaire/eolienne,
            CAPEX PV, prix du gaz, couts operationnels fossiles) a l&apos;aide de {result.scenarios.length} scenarios.
            Les interpretations ci-dessous sont generees automatiquement a partir des statistiques calculees.
          </p>
        </CardContent>
      </Card>

      {/* Interpretation sections */}
      <div className="space-y-6">
        {sections.map((section, idx) => {
          const Icon = section.icon
          return (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${section.color}`} />
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                      <span dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recommendations */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-chart-2" />
            Recommandations pour la planification
          </CardTitle>
          <CardDescription>Synthese des enseignements de la simulation stochastique</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3 text-chart-4">Risques principaux identifies</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-chart-4 shrink-0" />
                  Forte incertitude sur la demande en 2050 (intervalle Q5–Q95 large).
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-chart-4 shrink-0" />
                  Volatilite elevee du prix du gaz (GARCH α+β = 0.95).
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-chart-4 shrink-0" />
                  Incertitude sur le rythme de baisse du CAPEX PV.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-chart-4 shrink-0" />
                  Scenario pessimiste : conjonction defavorable de plusieurs facteurs.
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3 text-chart-2">Recommandations</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-chart-2 shrink-0" />
                  Dimensionner les capacites sur le quantile Q90 de la demande.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-chart-2 shrink-0" />
                  Diversifier le mix energetique pour reduire l&apos;exposition au prix du gaz.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-chart-2 shrink-0" />
                  Privilegier les scenarios LHS pour l&apos;entree de l&apos;optimisation (meilleure couverture).
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-chart-2 shrink-0" />
                  Repeter la simulation avec S ≥ 500 pour stabiliser les quantiles extremes.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/mc-lhs">Comparaison MC vs LHS detaillee</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/export">Exporter les resultats</Link>
        </Button>
      </div>
    </div>
  )
}

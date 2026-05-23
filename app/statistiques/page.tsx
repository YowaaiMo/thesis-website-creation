"use client"

import { useState } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MethodSelector } from "@/components/method-selector"
import { PageInfo } from "@/components/page-info"
import { FlipCard } from "@/components/flip-card"

export default function StatistiquesPage() {
  const { result, lhsResult, params } = useSimulation()
  const [method, setMethod] = useState<"mc" | "lhs">("mc")
  const activeResult = method === "mc" ? result : lhsResult

  if (!result && !lhsResult) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Resume statistique</h1>
          <p className="text-muted-foreground">Statistiques descriptives des scenarios generes.</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Aucune simulation n&apos;a encore ete lancee.</p>
              <Button asChild><Link href="/generation">Lancer une simulation</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!activeResult) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Resume statistique</h1>
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

  const { statistics } = activeResult
  const lastIdx = statistics.demand.mean.length - 1
  const methodLabel = method === "mc" ? "Monte Carlo" : "LHS"

  return (
    <div className="max-w-6xl mx-auto">
      <PageInfo title="Resume statistique — Methodologie">
        <p><strong className="text-foreground">Que montre cette page ?</strong> Les statistiques descriptives calculées sur l'ensemble des scénarios simulés pour chaque variable stochastique du modèle.</p>
        <p><strong className="text-foreground">Monte Carlo (MC) :</strong> Tirages indépendants — chaque scénario ω est généré de façon aléatoire. La convergence des estimateurs est en O(1/√S) où S est le nombre de scénarios.</p>
        <p><strong className="text-foreground">Latin Hypercube Sampling (LHS) :</strong> Stratification de l'espace [0,1]ˢ en S intervalles égaux. Les quantiles uk = (k + U)/S garantissent une couverture uniforme. La variance des estimateurs converge plus vite qu'en MC à S fixé.</p>
        <p><strong className="text-foreground">Indicateurs :</strong></p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-foreground">Moyenne</strong> — estimateur de l'espérance E[X]</li>
          <li><strong className="text-foreground">Écart-type</strong> — mesure la dispersion inter-scénarios</li>
          <li><strong className="text-foreground">Min / Max</strong> — enveloppe de tous les scénarios</li>
          <li><strong className="text-foreground">Q5% / Q95%</strong> — intervalle de confiance à 90 %, bornes de l'espace de planification robuste</li>
        </ul>
        <p><strong className="text-foreground">Comparaison MC/LHS :</strong> Avec le même nombre de scénarios, le LHS produit généralement des Q5/Q95 plus stables et un écart-type légèrement plus faible, car la stratification évite les zones sous- ou sur-représentées.</p>
      </PageInfo>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Resume statistique</h1>
        <p className="text-muted-foreground">
          Statistiques descriptives — {activeResult.scenarios.length} scenarios {methodLabel}
          {" "}({params.startYear}–{params.endYear})
        </p>
      </div>

      <MethodSelector method={method} setMethod={setMethod} hasMC={!!result} hasLHS={!!lhsResult} />

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard title="Scenarios" value={activeResult.scenarios.length.toString()} subtitle={`${(activeResult.computationTime / 1000).toFixed(2)}s de calcul`} />
        <SummaryCard title="Horizon" value={`${params.endYear - params.startYear + 1} ans`} subtitle={`${params.startYear} - ${params.endYear}`} />
        <SummaryCard title="Points de donnees" value={(activeResult.scenarios.length * (params.endYear - params.startYear + 1)).toLocaleString()} subtitle="par variable" />
        <SummaryCard title="Variables" value="7" subtitle="variables stochastiques" />
      </div>

      {/* Statistics Tables */}
      <div className="space-y-6">
        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Demande totale (ktep)</CardTitle>
                <CardDescription>Statistiques de la demande energetique totale</CardDescription>
              </CardHeader>
              <CardContent>
                <StatsTable stats={statistics.demand} startYear={params.startYear} />
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Demande energetique — Modele</h3>
              <p>La demande totale est la somme de cinq secteurs (Residentiel, Industriel, Transport, Agriculture, Tertiaire), chacun modelise par une tendance polynomiale en t = annee − 1980 plus un residu gaussien correle.</p>
              <p>La matrice de correlation des residus est estimee par OLS sur donnees historiques algeriennes. La decomposition de Cholesky L assure la coherence des tirages correles : ε = L·z avec z ~ N(0,I).</p>
              <p><strong className="text-foreground">Interpretation des quantiles :</strong> Q5 = scenarios de faible demande (opportunite d'alleger les capacites), Q95 = scenarios de forte demande (dimensionnement robuste).</p>
            </>
          }
        />

        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Disponibilite solaire (%)</CardTitle>
                <CardDescription>Facteur de capacite PV h_PV</CardDescription>
              </CardHeader>
              <CardContent>
                <StatsTable stats={statistics.solarAvailability} startYear={params.startYear} multiplier={100} decimals={1} />
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Disponibilite solaire — Loi Beta</h3>
              <p>La disponibilite solaire h_PV suit une loi Beta(α = 5.76, β = 3.84), calibree sur les donnees d'irradiation algeriennes. La loi Beta est bornee sur [0, 1], ce qui est physiquement coherent pour un facteur de capacite.</p>
              <p><strong className="text-foreground">Parametres :</strong> Esperance = α/(α+β) ≈ 0.60 (60%), variance σ² = αβ/[(α+β)²(α+β+1)] ≈ 0.002.</p>
              <p>La stationnarite de la loi explique la faible variation de la moyenne et de l'ecart-type dans le temps — la variabilite est purement inter-scenario, non temporelle.</p>
            </>
          }
        />

        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Disponibilite eolienne (%)</CardTitle>
                <CardDescription>Facteur de capacite h_Wind</CardDescription>
              </CardHeader>
              <CardContent>
                <StatsTable stats={statistics.windAvailability} startYear={params.startYear} multiplier={100} decimals={1} />
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Disponibilite eolienne — Normale tronquee</h3>
              <p>h_Wind suit une loi normale tronquee sur [0, 1] avec μ = 0.296 (29.6%) et σ = 0.035. La troncature assure que le facteur reste dans l'intervalle physiquement admissible.</p>
              <p><strong className="text-foreground">Implications :</strong> L'ecart-type relativement faible (σ = 3.5%) traduit la regularite du vent en Algerie — la ressource eolienne est previsible mais limitee par rapport au solaire.</p>
              <p>Comme pour le solaire, la loi est stationnaire : la distribution ne change pas d'une annee a l'autre, seul le tirage aleatoire varie.</p>
            </>
          }
        />

        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>CAPEX solaire (€/kW)</CardTitle>
                <CardDescription>Cout d&apos;investissement PV</CardDescription>
              </CardHeader>
              <CardContent>
                <StatsTable stats={statistics.capexPv} startYear={params.startYear} decimals={0} />
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">CAPEX PV — Mouvement Brownien Geometrique</h3>
              <p>Le CAPEX PV est modelise par un GBM (Geometric Brownian Motion) : dc/c = μ dt + σ dW, avec μ = −0.05 (baisse tendancielle de 5%/an) et σ = 0.10 (volatilite de 10%/an).</p>
              <p><strong className="text-foreground">Valeur initiale :</strong> c₀ = 800 €/kW en 2024, coherent avec les projections IEA pour les marches emergents.</p>
              <p>Le GBM garantit des valeurs strictement positives. La baisse tendancielle capture la courbe d'apprentissage technologique (learning rate ≈ 20% par doublement de capacite installee mondiale).</p>
              <p><strong className="text-foreground">Ecart-type croissant :</strong> La variance augmente avec le temps (propriete du GBM), traduisant l'incertitude croissante sur le rythme d'adoption.</p>
            </>
          }
        />

        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Prix du gaz (€/MBtu)</CardTitle>
                <CardDescription>Prix du gaz naturel</CardDescription>
              </CardHeader>
              <CardContent>
                <StatsTable stats={statistics.gasPrice} startYear={params.startYear} decimals={2} />
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Prix du gaz — GARCH(1,1)</h3>
              <p>Le prix du gaz suit un processus GARCH(1,1) : σ²_t = ω + α·ε²(t-1) + β·σ²(t-1), avec ω = 0.0002, α = 0.10, β = 0.85.</p>
              <p><strong className="text-foreground">Persistance :</strong> α + β = 0.95, ce qui signifie que les chocs de volatilite sont tres persistants — un episode de prix eleve dure plusieurs annees avant de se resorber.</p>
              <p>Ce modele capture les clusters de volatilite observes sur les marches gaziers (crises geopolitiques, ruptures d'approvisionnement), qui sont sous-estimes par les modeles a volatilite constante.</p>
              <p><strong className="text-foreground">Implication pour la planification :</strong> Q95 en fin d'horizon represente le scenario de prix tres eleve — le dimensionnement doit rester viable meme dans ce contexte.</p>
            </>
          }
        />
      </div>

      {/* Final Year Summary */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Resume pour {params.endYear}</CardTitle>
          <CardDescription>Statistiques de l&apos;annee finale de l&apos;horizon — methode {methodLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">Variable</th>
                  <th className="text-right py-3 px-4">Moyenne</th>
                  <th className="text-right py-3 px-4">Ecart-type</th>
                  <th className="text-right py-3 px-4">Min</th>
                  <th className="text-right py-3 px-4">Max</th>
                  <th className="text-right py-3 px-4">Q5%</th>
                  <th className="text-right py-3 px-4">Q95%</th>
                </tr>
              </thead>
              <tbody>
                <FinalYearRow label="Demande totale (ktep)" stats={statistics.demand} lastIdx={lastIdx} decimals={0} />
                <FinalYearRow label="Solaire (%)" stats={statistics.solarAvailability} lastIdx={lastIdx} multiplier={100} decimals={1} />
                <FinalYearRow label="Eolien (%)" stats={statistics.windAvailability} lastIdx={lastIdx} multiplier={100} decimals={1} />
                <FinalYearRow label="CAPEX PV (€/kW)" stats={statistics.capexPv} lastIdx={lastIdx} decimals={0} />
                <FinalYearRow label="Prix Gaz (€/MBtu)" stats={statistics.gasPrice} lastIdx={lastIdx} decimals={2} />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

interface VariableStats {
  mean: number[]
  std: number[]
  min: number[]
  max: number[]
  q5: number[]
  q95: number[]
}

function StatsTable({
  stats,
  startYear,
  multiplier = 1,
  decimals = 0,
}: {
  stats: VariableStats
  startYear: number
  multiplier?: number
  decimals?: number
}) {
  const years = stats.mean.map((_, i) => startYear + i)
  const selectedIndices = [0, 5, 10, 15, 20, 26].filter(i => i < stats.mean.length)
  const formatValue = (val: number) => (val * multiplier).toFixed(decimals)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3">Annee</th>
            <th className="text-right py-2 px-3">Moyenne</th>
            <th className="text-right py-2 px-3">Ecart-type</th>
            <th className="text-right py-2 px-3">Min</th>
            <th className="text-right py-2 px-3">Max</th>
            <th className="text-right py-2 px-3">Q5%</th>
            <th className="text-right py-2 px-3">Q95%</th>
          </tr>
        </thead>
        <tbody>
          {selectedIndices.map(idx => (
            <tr key={idx} className="border-b border-border/50">
              <td className="py-2 px-3 font-medium">{years[idx]}</td>
              <td className="text-right py-2 px-3 font-mono">{formatValue(stats.mean[idx])}</td>
              <td className="text-right py-2 px-3 font-mono text-muted-foreground">{formatValue(stats.std[idx])}</td>
              <td className="text-right py-2 px-3 font-mono text-muted-foreground">{formatValue(stats.min[idx])}</td>
              <td className="text-right py-2 px-3 font-mono text-muted-foreground">{formatValue(stats.max[idx])}</td>
              <td className="text-right py-2 px-3 font-mono">{formatValue(stats.q5[idx])}</td>
              <td className="text-right py-2 px-3 font-mono">{formatValue(stats.q95[idx])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FinalYearRow({
  label,
  stats,
  lastIdx,
  multiplier = 1,
  decimals = 0,
}: {
  label: string
  stats: VariableStats
  lastIdx: number
  multiplier?: number
  decimals?: number
}) {
  const format = (val: number) => (val * multiplier).toFixed(decimals)
  return (
    <tr className="border-b border-border/50">
      <td className="py-3 px-4 font-medium">{label}</td>
      <td className="text-right py-3 px-4 font-mono">{format(stats.mean[lastIdx])}</td>
      <td className="text-right py-3 px-4 font-mono text-muted-foreground">{format(stats.std[lastIdx])}</td>
      <td className="text-right py-3 px-4 font-mono text-muted-foreground">{format(stats.min[lastIdx])}</td>
      <td className="text-right py-3 px-4 font-mono text-muted-foreground">{format(stats.max[lastIdx])}</td>
      <td className="text-right py-3 px-4 font-mono">{format(stats.q5[lastIdx])}</td>
      <td className="text-right py-3 px-4 font-mono">{format(stats.q95[lastIdx])}</td>
    </tr>
  )
}

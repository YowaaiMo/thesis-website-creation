"use client"

import { useState, useRef } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { MethodSelector } from "@/components/method-selector"
import { PageInfo } from "@/components/page-info"
import { FlipCard } from "@/components/flip-card"

export default function ComparaisonPage() {
  const { result, lhsResult } = useSimulation()
  const [method, setMethod] = useState<"mc" | "lhs">("mc")
  const activeResult = method === "mc" ? result : lhsResult
  const [scenario1, setScenario1] = useState(0)
  const [scenario2, setScenario2] = useState(1)

  if (!result && !lhsResult) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Comparaison de scenarios</h1>
          <p className="text-muted-foreground">Comparez deux scenarios cote a cote.</p>
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
          <h1 className="text-3xl font-bold mb-2">Comparaison de scenarios</h1>
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

  const S = activeResult.scenarios.length
  const s1 = activeResult.scenarios[Math.min(scenario1, S - 1)]
  const s2 = activeResult.scenarios[Math.min(scenario2, S - 1)]
  const years = s1.years

  const clamp = (v: number) => Math.min(S - 1, Math.max(0, v))

  const labelFor = (idx: number) => {
    const tags: string[] = []
    if (idx === activeResult.extremeScenarios.pessimistic) tags.push("Pessimiste")
    if (idx === activeResult.extremeScenarios.maxDemand)   tags.push("Max Demande")
    if (idx === activeResult.extremeScenarios.minDemand)   tags.push("Min Demande")
    if (idx === activeResult.extremeScenarios.maxGasPrice) tags.push("Max Gaz")
    if (idx === activeResult.extremeScenarios.minCapexPv)  tags.push("Min CAPEX")
    return tags.length ? `#${idx + 1} — ${tags.join(", ")}` : `#${idx + 1}`
  }

  const setPreset = (preset: string) => {
    switch (preset) {
      case "pessimist-optimist":
        setScenario1(activeResult.extremeScenarios.pessimistic)
        setScenario2(activeResult.extremeScenarios.minDemand)
        break
      case "max-min-demand":
        setScenario1(activeResult.extremeScenarios.maxDemand)
        setScenario2(activeResult.extremeScenarios.minDemand)
        break
      case "max-gas":
        setScenario1(activeResult.extremeScenarios.maxGasPrice)
        setScenario2(0)
        break
    }
  }

  const demandData = years.map((year, i) => ({
    year,
    scenario1: s1.demand.total[i],
    scenario2: s2.demand.total[i],
    mean: activeResult.statistics.demand.mean[i],
  }))
  const solarData = years.map((year, i) => ({
    year,
    scenario1: s1.solarAvailability[i] * 100,
    scenario2: s2.solarAvailability[i] * 100,
  }))
  const capexData = years.map((year, i) => ({
    year,
    scenario1: s1.capexPv[i],
    scenario2: s2.capexPv[i],
  }))
  const gasData = years.map((year, i) => ({
    year,
    scenario1: s1.gasPrice[i],
    scenario2: s2.gasPrice[i],
  }))

  const tooltipStyle = {
    contentStyle: { backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" },
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageInfo title="Comparaison de scenarios">
        <p><strong className="text-foreground">Objectif :</strong> Comparer deux scénarios ω₁ et ω₂ issus du même tirage (MC ou LHS) pour analyser les écarts de trajectoire et identifier les facteurs discriminants.</p>
        <p><strong className="text-foreground">Sélection :</strong> Entrez le numéro de chaque scénario (1 à {S}) ou utilisez les presets pour comparer automatiquement les cas extrêmes identifiés par l'algorithme de détection.</p>
        <p><strong className="text-foreground">Presets disponibles :</strong></p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-foreground">Pessimiste vs Optimiste :</strong> scénario de demande maximale + gaz cher vs scénario de demande minimale</li>
          <li><strong className="text-foreground">Max vs Min Demande :</strong> trajectoires extrêmes pour la demande énergétique</li>
          <li><strong className="text-foreground">Max Prix Gaz vs Référence :</strong> impact de la volatilité gazière</li>
        </ul>
        <p><strong className="text-foreground">Différence (%) :</strong> calculée comme (Sc1 − Sc2) / |Sc2|. Rouge = Sc1 &gt; Sc2, Vert = Sc1 &lt; Sc2.</p>
        <p><strong className="text-foreground">MC vs LHS :</strong> Les deux méthodes peuvent produire des scénarios extrêmes différents (numérotation distincte). Le LHS garantit une meilleure répartition dans l'espace des paramètres, donc des extrêmes plus représentatifs de la vraie distribution.</p>
      </PageInfo>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Comparaison de scenarios</h1>
        <p className="text-muted-foreground">
          Comparez deux scenarios pour analyser les differences de trajectoires.
        </p>
      </div>

      <MethodSelector method={method} setMethod={m => { setMethod(m); setScenario1(0); setScenario2(1) }} hasMC={!!result} hasLHS={!!lhsResult} />

      {/* Scenario Selectors */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Selection des scenarios</CardTitle>
          <CardDescription>Entrez un numero de scenario (1 a {S}) ou choisissez un preset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-6 mb-4">
            <ScenarioInput
              label={`Scenario 1 (bleu) — ${labelFor(scenario1)}`}
              value={scenario1}
              max={S - 1}
              onChange={v => setScenario1(clamp(v))}
            />
            <ScenarioInput
              label={`Scenario 2 (vert) — ${labelFor(scenario2)}`}
              value={scenario2}
              max={S - 1}
              onChange={v => setScenario2(clamp(v))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreset("pessimist-optimist")}>
              Pessimiste vs Optimiste
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset("max-min-demand")}>
              Max vs Min Demande
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset("max-gas")}>
              Max Prix Gaz vs Reference
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Demande totale</CardTitle>
                <CardDescription>Trajectoires de demande (ktep)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={demandData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip {...tooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="scenario1" stroke="var(--chart-1)" strokeWidth={2} dot={false} name={`Scenario ${scenario1 + 1}`} isAnimationActive={false} />
                      <Line type="monotone" dataKey="scenario2" stroke="var(--chart-2)" strokeWidth={2} dot={false} name={`Scenario ${scenario2 + 1}`} isAnimationActive={false} />
                      <Line type="monotone" dataKey="mean" stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Moyenne" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Demande — Lecture du graphe</h3>
              <p>Chaque courbe représente la trajectoire de la <strong className="text-foreground">demande totale</strong> (somme des 5 secteurs) pour un scénario donné, en ktep (milliers de tonnes équivalent pétrole).</p>
              <p>La courbe en pointillés est la <strong className="text-foreground">moyenne de tous les scénarios</strong> — elle sert de référence centrale. Un scénario au-dessus de la moyenne traduit des résidus de demande plus élevés (tirages défavorables).</p>
              <p><strong className="text-foreground">Divergence :</strong> L'écart entre les deux trajectoires augmente généralement avec le temps en raison de l'accumulation des chocs stochastiques annuels.</p>
            </>
          }
        />

        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Disponibilite solaire</CardTitle>
                <CardDescription>Facteurs de capacite PV (%)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={solarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, ""]} />
                      <Legend />
                      <Line type="monotone" dataKey="scenario1" stroke="var(--chart-1)" strokeWidth={2} dot={false} name={`Scenario ${scenario1 + 1}`} isAnimationActive={false} />
                      <Line type="monotone" dataKey="scenario2" stroke="var(--chart-2)" strokeWidth={2} dot={false} name={`Scenario ${scenario2 + 1}`} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Disponibilite solaire — Loi Beta</h3>
              <p>La disponibilite solaire h_PV est tirée indépendamment chaque année depuis une loi <strong className="text-foreground">Beta(5.76, 3.84)</strong>. Deux scénarios peuvent donc avoir des profils très différents.</p>
              <p>Un scénario avec h_PV élevé (proche de 80%) est <strong className="text-foreground">favorable</strong> pour le déploiement solaire : plus d'heures de production par kW installé, donc un coût actualisé de l'énergie (LCOE) plus bas.</p>
              <p>Les fluctuations d'une année à l'autre (sans tendance) sont typiques d'une loi stationnaire — elles représentent la variabilité naturelle de l'ensoleillement algérien.</p>
            </>
          }
        />

        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>CAPEX solaire</CardTitle>
                <CardDescription>Couts d&apos;investissement PV (€/kW)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={capexData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={v => `${v}€`} />
                      <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(0)} €/kW`, ""]} />
                      <Legend />
                      <Line type="monotone" dataKey="scenario1" stroke="var(--chart-1)" strokeWidth={2} dot={false} name={`Scenario ${scenario1 + 1}`} isAnimationActive={false} />
                      <Line type="monotone" dataKey="scenario2" stroke="var(--chart-2)" strokeWidth={2} dot={false} name={`Scenario ${scenario2 + 1}`} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">CAPEX PV — GBM</h3>
              <p>Le CAPEX suit un <strong className="text-foreground">Mouvement Brownien Géométrique</strong> (GBM) : les deux trajectoires partagent la même tendance baissière (μ = −5%/an) mais divergent par les chocs de volatilité (σ = 10%/an).</p>
              <p>Un scénario avec CAPEX bas en 2050 est <strong className="text-foreground">favorable</strong> : les investissements solaires sont moins coûteux, ce qui accélère la rentabilité et réduit le besoin en subventions.</p>
              <p>La différence cumulative entre deux trajectoires GBM suit une distribution log-normale, qui peut être significative sur un horizon de 26 ans.</p>
            </>
          }
        />

        <FlipCard
          front={
            <Card>
              <CardHeader>
                <CardTitle>Prix du gaz</CardTitle>
                <CardDescription>Trajectoires de prix (€/MBtu)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gasData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={v => `${v.toFixed(1)}€`} />
                      <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)} €/MBtu`, ""]} />
                      <Legend />
                      <Line type="monotone" dataKey="scenario1" stroke="var(--chart-1)" strokeWidth={2} dot={false} name={`Scenario ${scenario1 + 1}`} isAnimationActive={false} />
                      <Line type="monotone" dataKey="scenario2" stroke="var(--chart-2)" strokeWidth={2} dot={false} name={`Scenario ${scenario2 + 1}`} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          }
          back={
            <>
              <h3 className="font-semibold text-foreground text-base mb-2">Prix du gaz — GARCH(1,1)</h3>
              <p>Le prix du gaz suit un <strong className="text-foreground">GARCH(1,1)</strong> avec persistance α+β = 0.95. Les chocs de volatilité se propagent sur plusieurs années — un scénario avec un pic de prix en 2030 maintient une variance élevée jusqu'en 2040+.</p>
              <p>Un écart important de prix entre deux scénarios a des implications directes pour la compétitivité du gaz face au solaire : un prix du gaz élevé accélère la rentabilité des énergies renouvelables (point de parité atteint plus tôt).</p>
              <p><strong className="text-foreground">Clusters de volatilité :</strong> Si les deux courbes divergent sur une courte période, c'est le signe d'un choc de variance amplifié par la persistance GARCH.</p>
            </>
          }
        />
      </div>

      {/* Summary Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resume comparatif</CardTitle>
          <CardDescription>Valeurs cles pour les deux scenarios {method.toUpperCase()} (horizon {years[years.length - 1]})</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">Variable</th>
                  <th className="text-right py-3 px-4 text-chart-1">Scenario {scenario1 + 1}</th>
                  <th className="text-right py-3 px-4 text-chart-2">Scenario {scenario2 + 1}</th>
                  <th className="text-right py-3 px-4">Difference</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Demande 2050 (ktep)"   value1={s1.demand.total.at(-1)!}    value2={s2.demand.total.at(-1)!}    format={v => v.toFixed(0)} />
                <ComparisonRow label="Solaire moyen (%)"     value1={s1.solarAvailability.reduce((a,b)=>a+b,0)/s1.solarAvailability.length*100} value2={s2.solarAvailability.reduce((a,b)=>a+b,0)/s2.solarAvailability.length*100} format={v => v.toFixed(1)} />
                <ComparisonRow label="CAPEX PV 2050 (€/kW)"  value1={s1.capexPv.at(-1)!}         value2={s2.capexPv.at(-1)!}         format={v => v.toFixed(0)} />
                <ComparisonRow label="Prix Gaz 2050 (€/MBtu)" value1={s1.gasPrice.at(-1)!}       value2={s2.gasPrice.at(-1)!}        format={v => v.toFixed(2)} />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScenarioInput({ label, value, max, onChange }: {
  label: string; value: number; max: number; onChange: (v: number) => void
}) {
  const [local, setLocal] = useState(String(value + 1))
  // Sync when external preset changes
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

function ComparisonRow({ label, value1, value2, format }: {
  label: string; value1: number; value2: number; format: (v: number) => string
}) {
  const diff = value1 - value2
  const pct = value2 !== 0 ? ((diff / Math.abs(value2)) * 100).toFixed(1) : "—"
  return (
    <tr className="border-b border-border/50">
      <td className="py-3 px-4">{label}</td>
      <td className="text-right py-3 px-4 font-mono">{format(value1)}</td>
      <td className="text-right py-3 px-4 font-mono">{format(value2)}</td>
      <td className="text-right py-3 px-4 font-mono">
        <span className={diff > 0 ? "text-chart-4" : diff < 0 ? "text-chart-2" : ""}>
          {diff > 0 ? "+" : ""}{format(diff)} ({pct}%)
        </span>
      </td>
    </tr>
  )
}

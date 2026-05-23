"use client"

import { useSimulation } from "@/lib/simulation-context"
import { buildComparison, type MethodComparison } from "@/lib/monte-carlo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts"

export default function McLhsPage() {
  const { result, lhsResult } = useSimulation()

  if (!result && !lhsResult) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Comparaison MC vs LHS</h1>
          <p className="text-muted-foreground">Comparez les deux methodes d&apos;echantillonnage.</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Aucune simulation n&apos;a ete lancee.</p>
            <Button asChild><Link href="/generation">Lancer MC + LHS</Link></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!result || !lhsResult) {
    const missing = !result ? "Monte Carlo" : "LHS"
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Comparaison MC vs LHS</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              La simulation <strong>{missing}</strong> n&apos;a pas encore ete lancee.
              Utilisez &quot;Generer MC + LHS&quot; pour lancer les deux simultanement.
            </p>
            <Button asChild><Link href="/generation">Page de generation</Link></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const comparisons = [
    buildComparison(result, lhsResult, "demand",            "Demande totale",         "ktep"),
    buildComparison(result, lhsResult, "solarAvailability", "Disponibilite solaire",  "%"),
    buildComparison(result, lhsResult, "windAvailability",  "Disponibilite eolienne", "%"),
    buildComparison(result, lhsResult, "capexPv",           "CAPEX PV",               "€/kW"),
    buildComparison(result, lhsResult, "gasPrice",          "Prix du gaz",            "€/MBtu"),
  ]

  const solarMultiplier = (v: number) => v * 100
  const windMultiplier  = (v: number) => v * 100
  const multipliers: Record<string, (v: number) => number> = {
    "Disponibilite solaire":  solarMultiplier,
    "Disponibilite eolienne": windMultiplier,
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Comparaison MC vs LHS</h1>
        <p className="text-muted-foreground">
          Analyse comparative des deux methodes d&apos;echantillonnage sur {result.scenarios.length} scenarios.
        </p>
      </div>

      {/* Summary table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Resume statistique en {result.scenarios[0].years[result.scenarios[0].years.length - 1]}</CardTitle>
          <CardDescription>
            Ecart relatif |MC – LHS| / σ_MC — un faible ecart indique une bonne convergence des deux methodes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">Variable</th>
                  <th className="text-right py-3 px-4 text-chart-1">Moyenne MC</th>
                  <th className="text-right py-3 px-4 text-chart-2">Moyenne LHS</th>
                  <th className="text-right py-3 px-4 text-chart-1">σ MC</th>
                  <th className="text-right py-3 px-4 text-chart-2">σ LHS</th>
                  <th className="text-right py-3 px-4">Ecart relatif μ</th>
                  <th className="text-right py-3 px-4">Ratio σ</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((c) => {
                  const mult = multipliers[c.variable] ?? ((v: number) => v)
                  const lastI = c.years.length - 1
                  const mcMu  = mult(c.mcMean[lastI])
                  const lhsMu = mult(c.lhsMean[lastI])
                  const mcS   = mult(c.mcStd[lastI])
                  const lhsS  = mult(c.lhsStd[lastI])
                  const relDiff = mcS > 0 ? (Math.abs(mcMu - lhsMu) / mcS * 100).toFixed(1) : "—"
                  const sigRatio = mcS > 0 ? (lhsS / mcS).toFixed(3) : "—"
                  const dec = c.unit === "€/MBtu" ? 2 : c.unit === "%" ? 1 : 0
                  return (
                    <tr key={c.variable} className="border-b border-border/50">
                      <td className="py-3 px-4 font-medium">{c.variable}</td>
                      <td className="text-right py-3 px-4 font-mono text-chart-1">{mcMu.toFixed(dec)} {c.unit}</td>
                      <td className="text-right py-3 px-4 font-mono text-chart-2">{lhsMu.toFixed(dec)} {c.unit}</td>
                      <td className="text-right py-3 px-4 font-mono text-muted-foreground">{mcS.toFixed(dec)}</td>
                      <td className="text-right py-3 px-4 font-mono text-muted-foreground">{lhsS.toFixed(dec)}</td>
                      <td className="text-right py-3 px-4 font-mono">
                        <span className={parseFloat(relDiff) < 10 ? "text-chart-2" : "text-chart-4"}>
                          {relDiff}%
                        </span>
                      </td>
                      <td className="text-right py-3 px-4 font-mono">
                        <span className={parseFloat(sigRatio) < 1 ? "text-chart-2" : "text-muted-foreground"}>
                          {sigRatio}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Ratio σ LHS/σ MC &lt; 1 indique que LHS reduit la variance d&apos;estimation — avantage theorique du LHS.
          </p>
        </CardContent>
      </Card>

      {/* Per-variable charts */}
      <Tabs defaultValue="demand" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="demand">Demande</TabsTrigger>
          <TabsTrigger value="solar">Solaire</TabsTrigger>
          <TabsTrigger value="wind">Eolien</TabsTrigger>
          <TabsTrigger value="capex">CAPEX PV</TabsTrigger>
          <TabsTrigger value="gas">Prix Gaz</TabsTrigger>
        </TabsList>

        {comparisons.map((comp) => {
          const tabKey = {
            "Demande totale":         "demand",
            "Disponibilite solaire":  "solar",
            "Disponibilite eolienne": "wind",
            "CAPEX PV":               "capex",
            "Prix du gaz":            "gas",
          }[comp.variable] ?? comp.variable

          const mult = multipliers[comp.variable] ?? ((v: number) => v)
          const chartData = comp.years.map((year, i) => ({
            year,
            mcMean:  mult(comp.mcMean[i]),
            lhsMean: mult(comp.lhsMean[i]),
            mcQ5:    mult(comp.mcQ5[i]),
            mcQ95:   mult(comp.mcQ95[i]),
            lhsQ5:   mult(comp.lhsQ5[i]),
            lhsQ95:  mult(comp.lhsQ95[i]),
          }))

          return (
            <TabsContent key={tabKey} value={tabKey}>
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Means comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle>Moyenne — {comp.variable}</CardTitle>
                    <CardDescription>Comparaison des moyennes MC vs LHS ({comp.unit})</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="year" stroke="var(--muted-foreground)"
                                 tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                          <YAxis stroke="var(--muted-foreground)"
                                 tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                          <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" }} />
                          <Legend />
                          <Line type="monotone" dataKey="mcMean"  stroke="var(--chart-1)" strokeWidth={2} dot={false} name="MC — Moyenne" />
                          <Line type="monotone" dataKey="lhsMean" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="LHS — Moyenne" strokeDasharray="5 3" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Q5/Q95 comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle>Intervalles Q5–Q95 — {comp.variable}</CardTitle>
                    <CardDescription>Comparaison des intervalles de confiance a 90%</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="year" stroke="var(--muted-foreground)"
                                 tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                          <YAxis stroke="var(--muted-foreground)"
                                 tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                          <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" }} />
                          <Legend />
                          <Line type="monotone" dataKey="mcQ5"   stroke="var(--chart-1)" strokeWidth={1} strokeDasharray="3 3" dot={false} name="MC Q5" />
                          <Line type="monotone" dataKey="mcQ95"  stroke="var(--chart-1)" strokeWidth={1} strokeDasharray="3 3" dot={false} name="MC Q95" />
                          <Line type="monotone" dataKey="lhsQ5"  stroke="var(--chart-2)" strokeWidth={1} strokeDasharray="5 3" dot={false} name="LHS Q5" />
                          <Line type="monotone" dataKey="lhsQ95" stroke="var(--chart-2)" strokeWidth={1} strokeDasharray="5 3" dot={false} name="LHS Q95" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Std deviation comparison */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Ecart-type — {comp.variable}</CardTitle>
                  <CardDescription>
                    Un ecart-type LHS inferieur indique une meilleure efficacite d&apos;estimation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.map((d, i) => ({
                        year: d.year,
                        mcStd:  mult(comp.mcStd[i]),
                        lhsStd: mult(comp.lhsStd[i]),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="year" stroke="var(--muted-foreground)"
                               tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                        <YAxis stroke="var(--muted-foreground)"
                               tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" }} />
                        <Legend />
                        <Line type="monotone" dataKey="mcStd"  stroke="var(--chart-1)" strokeWidth={2} dot={false} name="σ MC" />
                        <Line type="monotone" dataKey="lhsStd" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="σ LHS" strokeDasharray="5 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Theoretical explanation */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Principe du LHS</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            Le <strong>Latin Hypercube Sampling</strong> divise l&apos;espace de probabilite [0,1] en S strates egales.
            Pour le scenario k (k=1,...,S), le point est tire de la strate [(k−1)/S, k/S] :
          </p>
          <div className="bg-secondary/30 rounded-lg p-3 font-mono text-xs">
            uk = (k − 1 + Uk) / S &nbsp; avec &nbsp; Uk ~ U(0,1)<br />
            zt = Φ⁻¹(uk) &nbsp; (inverse de la CDF normale standard)
          </div>
          <p>
            <strong>Avantage :</strong> chaque scenario est garanti de couvrir une portion distincte
            de la distribution. La variance d&apos;estimation est reduite par rapport au MC pur, surtout
            pour un faible nombre de scenarios S.
          </p>
          <p>
            <strong>Pour les distributions correlees</strong> (demande sectorielle), la transformation de
            Cholesky est appliquee apres generation des z LHS independants, preservant la structure de
            correlation tout en maintenant la propriete de stratification marginale.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

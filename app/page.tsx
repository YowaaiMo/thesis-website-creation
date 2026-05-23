"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Database, LineChart, BarChart3, Download, Layers, FileText } from "lucide-react"

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
          Monte Carlo &amp; Latin Hypercube Sampling
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-4 text-balance">
          Plateforme interactive de generation de scenarios stochastiques
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl text-pretty">
          Outil de planification energetique stochastique applique a l&apos;Algerie a l&apos;horizon 2050.
          Generez, visualisez et analysez des scenarios par <strong>Monte Carlo (MC)</strong> et
          par <strong>Latin Hypercube Sampling (LHS)</strong> pour la prise de decision sous incertitude.
        </p>
      </div>

      {/* Method comparison cards */}
      <div className="grid md:grid-cols-2 gap-4 mb-12">
        <Card className="border-chart-1/40 bg-chart-1/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-chart-1">Monte Carlo (MC)</CardTitle>
            <CardDescription>Tirage aleatoire pur</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Chaque scenario tire independamment de la distribution cible.</p>
            <code className="block bg-secondary/40 rounded px-2 py-1 text-xs mt-2">
              zt ~ N(0,1) &nbsp;independant
            </code>
            <p className="text-xs mt-2">Convergence en O(1/√S) — recommande pour S ≥ 500.</p>
          </CardContent>
        </Card>

        <Card className="border-chart-2/40 bg-chart-2/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-chart-2">Latin Hypercube Sampling (LHS)</CardTitle>
            <CardDescription>Echantillonnage stratifie</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>L&apos;espace [0,1] est divise en S strates, chacune echantillonnee exactement une fois.</p>
            <code className="block bg-secondary/40 rounded px-2 py-1 text-xs mt-2">
              uk = (k + U) / S &nbsp;; &nbsp;zt = Φ⁻¹(uk)
            </code>
            <p className="text-xs mt-2">Meilleure couverture — recommande pour S &lt; 300.</p>
          </CardContent>
        </Card>
      </div>

      {/* Process Flow */}
      <Card className="mb-12 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl">Chaine de traitement</CardTitle>
          <CardDescription>Du donnees brutes aux scenarios exploitables</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <ProcessStep icon={Database} label="Donnees historiques" />
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <ProcessStep icon={BarChart3} label="Lois probabilistes" />
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <ProcessStep icon={Layers} label="Scenarios MC / LHS" />
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <ProcessStep icon={LineChart} label="Analyse &amp; Comparaison" />
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <ProcessStep icon={Download} label="Export / Optimisation" />
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <FeatureCard
          title="Generation MC + LHS"
          description="Generez jusqu&apos;a 500 scenarios par Monte Carlo et/ou Latin Hypercube Sampling, avec graine reproductible."
        />
        <FeatureCard
          title="Comparaison MC vs LHS"
          description="Comparez les deux methodes sur les moyennes, ecarts-types, Q5–Q95 et convergence."
        />
        <FeatureCard
          title="Visualisation interactive"
          description="Explorez les trajectoires simulees avec des graphiques interactifs, nuages de scenarios et histogrammes."
        />
        <FeatureCard
          title="Analyse statistique"
          description="Calculez automatiquement les statistiques cles : moyenne, variance, quantiles 5%–95%."
        />
        <FeatureCard
          title="Interpretation automatique"
          description="Obtenez une analyse textuelle des tendances, volatilites et scenarios extremes."
        />
        <FeatureCard
          title="Export des donnees"
          description="Exportez vos scenarios en CSV, JSON ou statistiques agregees pour l&apos;optimisation."
        />
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/generation">
            Commencer la simulation
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/mc-lhs">
            <Layers className="mr-2 h-4 w-4" />
            Comparaison MC vs LHS
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/parametres">Configurer les parametres</Link>
        </Button>
      </div>

      {/* Variables Section */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold mb-2">Variables stochastiques generees</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Chaque variable suit une loi calibree sur les donnees historiques algeriennes.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <VariableCard
            variable="D_{s,t}(ω)"
            name="Demande sectorielle"
            description="Tendance polynomiale + erreur normale correlee (Cholesky) — 5 secteurs"
          />
          <VariableCard
            variable="h_{PV,t}(ω)"
            name="Disponibilite solaire"
            description="Beta(5.76, 3.84) — μ = 60%, borne [0,1]"
          />
          <VariableCard
            variable="h_{Wind,t}(ω)"
            name="Disponibilite eolienne"
            description="Normale tronquee N[0,1](0.296, 0.035²)"
          />
          <VariableCard
            variable="c^{inv}_{PV,t}(ω)"
            name="CAPEX solaire"
            description="GBM : c₀ = 800 €/kW, μ = −5%/an, σ = 10%"
          />
          <VariableCard
            variable="P^{gaz}_t(ω)"
            name="Prix du gaz"
            description="GARCH(1,1) : α+β = 0.95, forte persistance"
          />
          <VariableCard
            variable="c̃^{op}_{i,t}(ω)"
            name="Cout operationnel"
            description="Gaz = c_tech + P_gaz ; autres fossiles : N(c̄, σ²)"
          />
        </div>
      </div>

      {/* Interpretation shortcut */}
      <div className="mt-12 p-6 rounded-xl border border-border bg-secondary/20 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold mb-1">Interpretation automatique des resultats</h3>
          <p className="text-sm text-muted-foreground">
            Apres la simulation, obtenez une analyse textuelle complete : tendances, volatilites,
            scenario pessimiste et convergence MC vs LHS.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/interpretation">
            <FileText className="mr-2 h-4 w-4" />
            Voir l&apos;interpretation
          </Link>
        </Button>
      </div>
    </div>
  )
}

function ProcessStep({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>, label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/50">
      <Icon className="h-8 w-8 text-primary" />
      <span className="text-sm font-medium text-center">{label}</span>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string, description: string }) {
  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function VariableCard({ variable, name, description }: { variable: string, name: string, description: string }) {
  return (
    <div className="p-4 rounded-lg bg-secondary/30 border border-border">
      <code className="text-sm font-mono text-primary">{variable}</code>
      <h3 className="font-medium mt-2">{name}</h3>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  )
}

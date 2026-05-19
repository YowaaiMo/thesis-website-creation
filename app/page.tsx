"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Database, LineChart, BarChart3, Download } from "lucide-react"

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
          Simulation Monte Carlo
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-4 text-balance">
          Plateforme interactive de generation de scenarios Monte Carlo
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl text-pretty">
          Outil de planification energetique stochastique applique a l&apos;Algerie a l&apos;horizon 2050.
          Generez, visualisez et analysez des scenarios pour la prise de decision sous incertitude.
        </p>
      </div>

      {/* Process Flow */}
      <Card className="mb-12 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl">Chaine de traitement</CardTitle>
          <CardDescription>
            Du donnees brutes aux scenarios exploitables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <ProcessStep icon={Database} label="Donnees historiques" />
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <ProcessStep icon={BarChart3} label="Lois probabilistes" />
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <ProcessStep icon={LineChart} label="Scenarios Monte Carlo" />
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <ProcessStep icon={Download} label="Optimisation" />
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <FeatureCard
          title="Generation automatique"
          description="Generez jusqu&apos;a 500 scenarios couvrant l&apos;ensemble des incertitudes du systeme energetique."
        />
        <FeatureCard
          title="Visualisation interactive"
          description="Explorez les trajectoires simulees avec des graphiques interactifs et des nuages de scenarios."
        />
        <FeatureCard
          title="Analyse statistique"
          description="Calculez automatiquement les statistiques cles : moyenne, variance, quantiles."
        />
        <FeatureCard
          title="Scenarios extremes"
          description="Identifiez les scenarios pessimistes et optimistes pour une planification robuste."
        />
        <FeatureCard
          title="Analyse de sensibilite"
          description="Testez l&apos;impact des variations de parametres sur les resultats."
        />
        <FeatureCard
          title="Export des donnees"
          description="Exportez vos scenarios en CSV, Excel ou JSON pour l&apos;optimisation."
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
          <Link href="/parametres">
            Configurer les parametres
          </Link>
        </Button>
      </div>

      {/* Variables Section */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold mb-6">Variables generees</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <VariableCard
            variable="D_{s,t}(ω)"
            name="Demande sectorielle"
            description="Demande par secteur : Residentiel, Industriel, Transport, Agriculture, Tertiaire"
          />
          <VariableCard
            variable="h_{PV,t}(ω)"
            name="Disponibilite solaire"
            description="Facteur de capacite solaire photovoltaique"
          />
          <VariableCard
            variable="h_{Wind,t}(ω)"
            name="Disponibilite eolienne"
            description="Facteur de capacite eolienne"
          />
          <VariableCard
            variable="c^{inv}_{PV,t}(ω)"
            name="CAPEX solaire"
            description="Cout d&apos;investissement PV"
          />
          <VariableCard
            variable="P^{gaz}_t(ω)"
            name="Prix du gaz"
            description="Prix du gaz naturel"
          />
          <VariableCard
            variable="c̃^{op}_{i,t}(ω)"
            name="Cout operationnel"
            description="Cout operationnel complet"
          />
        </div>
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

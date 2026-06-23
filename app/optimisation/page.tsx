"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Play, TrendingUp, Network, Scissors, ScatterChart, Trophy, TableProperties,
  ArrowRight, Zap, Info
} from "lucide-react"

const modules = [
  {
    href: "/optimisation/resolution",
    icon: Play,
    title: "Resolution L-Shaped",
    desc: "Configurer et lancer le solveur L-Shaped stochastique bi-objectif.",
    color: "chart-1",
  },
  {
    href: "/optimisation/iterations",
    icon: TrendingUp,
    title: "Convergence",
    desc: "Suivre LB(k), UB(k) et l'ecart relatif Gap(k) iteration par iteration.",
    color: "chart-2",
  },
  {
    href: "/optimisation/sous-problemes",
    icon: Network,
    title: "Sous-problemes",
    desc: "Inspecter les plans de dispatche optimaux et les deficits par scenario.",
    color: "chart-3",
  },
  {
    href: "/optimisation/coupes",
    icon: Scissors,
    title: "Coupes generees",
    desc: "Visualiser les coupes d'optimalite (multicoupe) ajoutees au probleme maitre.",
    color: "chart-4",
  },
  {
    href: "/optimisation/pareto",
    icon: ScatterChart,
    title: "Front de Pareto",
    desc: "Construire le front de Pareto cost vs GES via la methode ε-contrainte.",
    color: "chart-5",
  },
  {
    href: "/optimisation/resultats",
    icon: Trophy,
    title: "Resultats optimaux",
    desc: "Afficher les capacites installees et productions optimales par technologie.",
    color: "chart-1",
  },
  {
    href: "/optimisation/rapport",
    icon: TableProperties,
    title: "Rapport final",
    desc: "Synthese complete : tableaux, graphiques et export multi-format.",
    color: "chart-2",
  },
]

export default function OptimisationPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-chart-4/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-chart-4" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Optimisation L-Shaped</h1>
            <p className="text-muted-foreground text-sm">Decomposition de Benders stochastique — planification energetique Algerie 2024–2050</p>
          </div>
        </div>
      </div>

      {/* Method overview */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card className="border-chart-4/30 bg-chart-4/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-chart-4">Methode L-Shaped (Benders)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Decomposition bi-niveaux du probleme stochastique :</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Probleme maitre</strong> : decisions d'investissement x<sub>i,t</sub></li>
              <li><strong>Sous-problemes</strong> : dispatche operationnel y<sup>ω</sup><sub>i,t</sub> par scenario</li>
              <li><strong>Coupes d'optimalite</strong> : linearisation de Q(x,ω) → θ<sub>ω</sub></li>
            </ul>
            <code className="block bg-secondary/30 rounded p-2 text-xs mt-2">
              θ<sub>ω</sub> ≥ α<sup>k</sup><sub>ω</sub> + (β<sup>k</sup><sub>ω</sub>)<sup>T</sup>x
            </code>
          </CardContent>
        </Card>

        <Card className="border-chart-5/30 bg-chart-5/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-chart-5">Bi-objectif (ε-contrainte)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Construction du front de Pareto :</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Z<sub>1</sub> = coût total actualisé (M€)</li>
              <li>Z<sub>2</sub> = émissions GES cumulées (MtCO₂)</li>
              <li>N points : min Z<sub>1</sub> s.c. Z<sub>2</sub> ≤ ε<sub>j</sub></li>
            </ul>
            <code className="block bg-secondary/30 rounded p-2 text-xs mt-2">
              Gap<sub>k</sub> = (UB<sub>k</sub> − LB<sub>k</sub>) / max(1,|UB<sub>k</sub>|)
            </code>
          </CardContent>
        </Card>
      </div>

      {/* Problem dimensions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Dimensions du modele</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Technologies |I|", value: "7", sub: "PV, Eolien, Gaz, Pétrole, GPL, Cond, Bat" },
              { label: "Periodes |T|", value: "5", sub: "2024, 2030, 2036, 2042, 2048" },
              { label: "Scenarios |Ω|", value: "5–20", sub: "issus de la simulation LHS" },
              { label: "Convergence ε", value: "0.5%", sub: "Gap relatif LB vs UB" },
            ].map(d => (
              <div key={d.label} className="p-3 bg-secondary/30 rounded-lg">
                <p className="text-xs text-muted-foreground">{d.label}</p>
                <p className="text-2xl font-bold text-primary">{d.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{d.sub}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Module grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => {
          const Icon = m.icon
          return (
            <Card
              key={m.href}
              className={`border-${m.color}/30 hover:border-${m.color}/60 transition-colors group`}
            >
              <CardHeader className="pb-2">
                <div className={`h-8 w-8 rounded-lg bg-${m.color}/15 flex items-center justify-center mb-2`}>
                  <Icon className={`h-4 w-4 text-${m.color}`} />
                </div>
                <CardTitle className="text-sm">{m.title}</CardTitle>
                <CardDescription className="text-xs">{m.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm" variant="ghost" className={`gap-1 text-${m.color} hover:bg-${m.color}/10 px-0`}>
                  <Link href={m.href}>
                    Acceder <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Info */}
      <div className="mt-8 p-4 rounded-lg bg-secondary/20 border border-border flex gap-3">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          Commencez par <strong>Resolution</strong> pour configurer et lancer le solveur.
          Les scenarios sont extraits automatiquement de votre simulation LHS (ou generes par defaut).
          Le front de Pareto est accessible apres une premiere resolution.
        </p>
      </div>
    </div>
  )
}

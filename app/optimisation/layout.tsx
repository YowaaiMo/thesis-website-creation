"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { id: 1, label: "Paramètres",        short: "Param.",    href: "/optimisation/resolution" },
  { id: 2, label: "Scénarios",         short: "Scén.",     href: "/optimisation/scenarios" },
  { id: 3, label: "Problème maître",   short: "Maître",    href: "/optimisation/maitre" },
  { id: 4, label: "Sous-problèmes",    short: "S.-prob.",  href: "/optimisation/sous-problemes" },
  { id: 5, label: "Duales & Coupes",   short: "Coupes",    href: "/optimisation/coupes" },
  { id: 6, label: "Convergence",       short: "Conv.",     href: "/optimisation/iterations" },
  { id: 7, label: "Solution optimale", short: "Solution",  href: "/optimisation/resultats" },
  { id: 8, label: "Analyse énergie",   short: "Analyse",   href: "/optimisation/analyse" },
  { id: 9, label: "Pareto",            short: "Pareto",    href: "/optimisation/pareto" },
  { id: 10, label: "Rapport",          short: "Rapport",   href: "/optimisation/rapport" },
]

export default function OptimisationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      {/* Header */}
      <div className="mb-1">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">
          Modèle L-Shaped — Planification énergétique Algérie 2024–2050
        </p>

        {/* Tab bar */}
        <div className="overflow-x-auto pb-0">
          <div className="flex gap-0.5 border-b border-border min-w-max">
            {TABS.map(tab => {
              const isActive =
                pathname === tab.href ||
                (tab.href === "/optimisation/resolution" && pathname === "/optimisation")
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2 -mb-px",
                    isActive
                      ? "border-chart-4 text-chart-4 bg-chart-4/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <span className={cn(
                    "h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                    isActive
                      ? "bg-chart-4 text-white"
                      : "bg-secondary/70 text-muted-foreground"
                  )}>
                    {tab.id}
                  </span>
                  <span className="hidden lg:inline">{tab.label}</span>
                  <span className="lg:hidden">{tab.short}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="pt-6">
        {children}
      </div>
    </div>
  )
}

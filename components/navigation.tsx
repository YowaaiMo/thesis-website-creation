"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Home,
  Settings,
  Play,
  BarChart3,
  LineChart,
  GitCompare,
  AlertTriangle,
  Calculator,
  SlidersHorizontal,
  CheckCircle,
  BookOpen,
  Download,
  Timer,
  Sun,
  Moon,
  Layers,
  FileText,
  Zap,
  ChevronDown,
  ChevronRight,
  Network,
  TrendingUp,
  ScatterChart,
  TableProperties,
  Scissors,
  Trophy,
} from "lucide-react"

const mcNavItems = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/parametres", label: "Parametres", icon: Settings },
  { href: "/generation", label: "Generation MC / LHS", icon: Play },
  { href: "/visualisation", label: "Visualisation", icon: BarChart3 },
  { href: "/scenario", label: "Scenario individuel", icon: LineChart },
  { href: "/mc-lhs", label: "Comparaison MC vs LHS", icon: Layers },
  { href: "/comparaison", label: "Comparaison scenarios", icon: GitCompare },
  { href: "/extremes", label: "Scenarios extremes", icon: AlertTriangle },
  { href: "/statistiques", label: "Statistiques", icon: Calculator },
  { href: "/interpretation", label: "Interpretation auto.", icon: FileText },
  { href: "/sensibilite", label: "Sensibilite", icon: SlidersHorizontal },
  { href: "/validation", label: "Validation", icon: CheckCircle },
  { href: "/lois", label: "Lois probabilistes", icon: BookOpen },
  { href: "/export", label: "Export", icon: Download },
  { href: "/animation", label: "Animation", icon: Timer },
]

const optimNavItems = [
  { href: "/optimisation", label: "Apercu L-Shaped", icon: Zap },
  { href: "/optimisation/resolution", label: "Resolution", icon: Play },
  { href: "/optimisation/iterations", label: "Convergence", icon: TrendingUp },
  { href: "/optimisation/sous-problemes", label: "Sous-problemes", icon: Network },
  { href: "/optimisation/coupes", label: "Coupes generees", icon: Scissors },
  { href: "/optimisation/pareto", label: "Front de Pareto", icon: ScatterChart },
  { href: "/optimisation/resultats", label: "Resultats optimaux", icon: Trophy },
  { href: "/optimisation/rapport", label: "Rapport final", icon: TableProperties },
]

export function Navigation() {
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(true)
  const [optimOpen, setOptimOpen] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  // Auto-expand optimisation section when on an optimisation page
  useEffect(() => {
    if (pathname.startsWith('/optimisation')) setOptimOpen(true)
  }, [pathname])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border p-4 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-sidebar-foreground">MC &amp; LHS</h1>
        <p className="text-xs text-muted-foreground">Planification energetique</p>
      </div>

      {/* MC / LHS items */}
      <div className="space-y-1">
        {mcNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              suppressHydrationWarning
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Optimisation section */}
      <div className="mt-4 pt-4 border-t border-sidebar-border">
        <button
          onClick={() => setOptimOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm font-semibold text-chart-4 hover:bg-chart-4/10 transition-colors"
        >
          <Zap className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Optimisation L-Shaped</span>
          {optimOpen
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronRight className="h-3 w-3" />}
        </button>

        {optimOpen && (
          <div className="mt-1 ml-2 space-y-1">
            {optimNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  suppressHydrationWarning
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-chart-4/20 text-chart-4 font-medium"
                      : "text-sidebar-foreground/60 hover:bg-chart-4/10 hover:text-chart-4"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-sidebar-border">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground mb-4"
        >
          {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          <span>{isDark ? "Mode clair" : "Mode nuit"}</span>
        </button>
        <p className="text-xs text-muted-foreground">BELKACEM Djamila Racha</p>
        <p className="text-xs text-muted-foreground mt-1">PFE 2026</p>
      </div>
    </nav>
  )
}

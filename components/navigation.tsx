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
  FileText
} from "lucide-react"

const navItems = [
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

export function Navigation() {
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border p-4 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-sidebar-foreground">MC &amp; LHS</h1>
        <p className="text-xs text-muted-foreground">Planification energetique</p>
      </div>
      
      <div className="space-y-1">
        {navItems.map((item) => {
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
      
      <div className="mt-8 pt-4 border-t border-sidebar-border">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground mb-4"
        >
          {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          <span>{isDark ? "Mode clair" : "Mode nuit"}</span>
        </button>
        <p className="text-xs text-muted-foreground">
          BELKACEM Djamila Racha
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PFE 2026
        </p>
      </div>
    </nav>
  )
}

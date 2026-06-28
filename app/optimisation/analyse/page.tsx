"use client"

import { useLShaped } from "@/lib/lshaped-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts"
import {
  TECHNOLOGIES, DEFAULT_PERIODS, DEFAULT_PERIOD_SPANS, EMISSION_FACTOR,
} from "@/lib/lshaped/types"
import Link from "next/link"

const TECH_COLORS: Record<string, string> = {
  PV: "#fbbf24", Wind: "#06b6d4", Gaz: "#3b82f6",
  Pétrole: "#dc2626", GPL: "#16a34a", Condensat: "#f59e0b", Batterie: "#8b5cf6",
}

const PERIOD_YRS = DEFAULT_PERIODS as readonly number[]
const SPANS = DEFAULT_PERIOD_SPANS as readonly number[]

// Linear interpolation: 5 period values → 27 annual values (2024–2050)
function lerp(vals: number[], year: number): number {
  let p = 4
  for (let j = 0; j < 4; j++) {
    if (year >= PERIOD_YRS[j] && year < PERIOD_YRS[j + 1]) { p = j; break }
  }
  if (p < 4) {
    const t = (year - PERIOD_YRS[p]) / SPANS[p]
    return (1 - t) * vals[p] + t * vals[p + 1]
  }
  return vals[4]
}

const YEARS = Array.from({ length: 27 }, (_, i) => 2024 + i)

export default function AnalysePage() {
  const { result } = useLShaped()

  if (!result) return (
    <div className="max-w-5xl mx-auto">
      <div className="p-6 rounded-lg border border-yellow-500/40 bg-yellow-500/5 flex gap-3">
        <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
        <p className="text-sm">
          Aucun résultat disponible. Lancez la résolution depuis{" "}
          <Link href="/optimisation/resolution" className="underline text-chart-4">l'onglet 1</Link>.
        </p>
      </div>
    </div>
  )

  const { finalSolution, scenarios, config } = result
  const lastIter = result.iterations[result.iterations.length - 1]
  const nScenarios = scenarios.length

  // Expected production per tech per period (weighted over scenarios)
  const avgProd: number[][] = TECHNOLOGIES.map((_, i) =>
    DEFAULT_PERIODS.map((__, t) =>
      lastIter.subproblems.reduce((s, sr, w) => s + scenarios[w].prob * (sr.periods[t]?.production[i] ?? 0), 0)
    )
  )

  // Expected deficit per period
  const avgDeficit: number[] = DEFAULT_PERIODS.map((_, t) =>
    lastIter.subproblems.reduce((s, sr, w) => s + scenarios[w].prob * (sr.periods[t]?.deficit ?? 0), 0)
  )

  // REN_t = (y_PV + y_Wind) / Σ_i y_i  (batterie EXCLUE du numérateur)
  const renPerPeriod = DEFAULT_PERIODS.map((_, t) => {
    const ren = (avgProd[0]?.[t] ?? 0) + (avgProd[1]?.[t] ?? 0)
    const total = TECHNOLOGIES.reduce((s, _, i) => s + (avgProd[i]?.[t] ?? 0), 0)
    return total > 0 ? ren / total * 100 : 0
  })

  // EM_t = Σ_i e_i · y_{i,t}  (MtCO₂/an)
  const emPerPeriod = DEFAULT_PERIODS.map((_, t) =>
    TECHNOLOGIES.reduce((s, tech, i) => s + EMISSION_FACTOR[tech] * (avgProd[i]?.[t] ?? 0), 0)
  )

  // Capacity per period for chart
  const capPerPeriod = TECHNOLOGIES.map((_, i) =>
    DEFAULT_PERIODS.map((__, t) => finalSolution.cumX[i]?.[t] ?? 0)
  )

  // Annual data (27 years)
  const annualData = YEARS.map(y => {
    const row: Record<string, number> = { year: y }
    // Capacities
    TECHNOLOGIES.forEach((tech, i) => {
      row[`cap_${tech}`] = lerp(capPerPeriod[i], y)
    })
    // Productions
    TECHNOLOGIES.forEach((tech, i) => {
      row[`prod_${tech}`] = lerp(avgProd[i], y)
    })
    // REN_t
    const renP = lerp(renPerPeriod, y)
    row["REN_t"] = renP
    // EM_t
    row["EM_t"] = lerp(emPerPeriod, y)
    // Deficit
    row["deficit"] = lerp(avgDeficit, y)
    return row
  })

  // Auto-commentary
  function autoCommentary(): string {
    const renStart = renPerPeriod[0]
    const renEnd = renPerPeriod[4]
    const emEnd = emPerPeriod[4]
    const firstYearOver60 = YEARS.find(y => lerp(renPerPeriod, y) >= 60)
    const pvFinal = finalSolution.cumX[0]?.[4] ?? 0
    const pvInitial = finalSolution.cumX[0]?.[0] ?? 0
    const pvGrowth = pvInitial > 0 ? (pvFinal - pvInitial) / pvInitial * 100 : 0
    const hasDeficit = avgDeficit.some(d => d > 1)
    // True if emissions decrease at every representative period (strict monotonicity)
    const emMonotone = emPerPeriod.every((v, i) => i === 0 || v <= emPerPeriod[i - 1] + 1e-6)

    const parts = [
      `Part renouvelables (PV + Éolien) : ${renStart.toFixed(1)} % en 2024, ${renEnd.toFixed(1)} % en 2050.`,
      firstYearOver60
        ? `Les EnR dépassent 60 % à partir de ${firstYearOver60}.`
        : `La part renouvelable de ${renEnd.toFixed(1)} % en 2050 reflète une progression significative (PV +${pvGrowth.toFixed(0)} % en capacité installée), limitée par les coûts d'investissement et la nécessité de maintenir la sécurité d'approvisionnement via les ressources en place.`,
      pvGrowth > 0 && !!firstYearOver60 ? `Le PV progresse de +${pvGrowth.toFixed(0)} % en capacité.` : "",
      `Émissions EM_t en 2050 ≈ ${emEnd.toFixed(3)} MtCO₂/an.`,
      !emMonotone
        ? `L'évolution des émissions sur l'horizon n'est pas strictement monotone : la croissance de la demande peut temporairement dépasser le rythme de déploiement des EnR, entraînant une hausse transitoire avant que les nouvelles capacités n'entrent en service.`
        : "",
      hasDeficit
        ? `Un déficit résiduel E[u_t] subsiste sur certaines périodes (voir Figure 6.13). Ce résultat est économiquement rationnel : face aux scénarios de forte demande, le modèle arbitre entre investir dans des capacités peu sollicitées et accepter une pénalité λ_D = ${config.lambdaD} M€/ktep. Le déficit reflète un compromis coût-fiabilité du modèle, non une impossibilité physique.`
        : `Aucun déficit significatif sur l'horizon.`,
    ].filter(Boolean)
    return parts.join(" ")
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Onglet 8 — Analyse énergétique approfondie</h1>
        <p className="text-sm text-muted-foreground">
          Interpolation annuelle 2024–2050 (27 années) · REN_t = (y_PV + y_Wind) / Σ y_i (batterie exclue) · EM_t = Σ eᵢ · y_i
        </p>
      </div>

      {/* Auto-commentary */}
      <Card className="border-chart-4/30 bg-chart-4/5">
        <CardContent className="py-4">
          <p className="text-sm text-foreground">{autoCommentary()}</p>
        </CardContent>
      </Card>

      {/* Figure 6.8 — Capacités annuelles */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {"Figure 6.8 — Évolution des capacités x_{i,t} (2024–2050)"}
          </CardTitle>
          <CardDescription>Interpolation linéaire des 5 périodes représentatives · 27 points annuels</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(undefined, { maximumFractionDigits: 0 }), name.replace("cap_", "")]} />
              <Legend formatter={name => name.replace("cap_", "")} />
              {TECHNOLOGIES.map(t => (
                <Line key={t} type="monotone" dataKey={`cap_${t}`} name={`cap_${t}`}
                  stroke={TECH_COLORS[t]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Figure 6.9 / 6.10 — Mix énergétique (aires empilées) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {"Figure 6.9 — Production E[y_{i,t}] et Figure 6.10 — Mix énergétique (aires empilées)"}
          </CardTitle>
          <CardDescription>Production espérée pondérée sur les {nScenarios} scénarios</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(undefined, { maximumFractionDigits: 0 }), name.replace("prod_", "")]} />
              <Legend formatter={name => name.replace("prod_", "")} />
              {TECHNOLOGIES.map(t => (
                <Area key={t} type="monotone" dataKey={`prod_${t}`} name={`prod_${t}`}
                  stroke={TECH_COLORS[t]} fill={TECH_COLORS[t]} fillOpacity={0.35}
                  stackId="prod" dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Figure 6.11 — REN_t */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Figure 6.11 — Part renouvelables REN_t (%)
          </CardTitle>
          <CardDescription>
            {"REN_t = (y_PV,t + y_Wind,t) / Σᵢ y_{i,t} — Batterie non comptée dans le numérateur"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)} %`]} />
              <Line type="monotone" dataKey="REN_t" name="REN_t (%)" stroke="#22c55e" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Figure 6.12 — EM_t */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {"Figure 6.12 — Émissions EM_t = Σᵢ eᵢ · E[y_{i,t}]"}
          </CardTitle>
          <CardDescription>MtCO₂/an · Facteurs eᵢ : Gaz = 0.00235 · Pétrole = 0.00307 · GPL = 0.00265 · Condensat = 0.00295</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v.toFixed(2)} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(4)} MtCO₂/an`]} />
              <Line type="monotone" dataKey="EM_t" name="EM_t (MtCO₂/an)" stroke="#f97316" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Figure 6.13 — Déficit annuel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Figure 6.13 — Déficit énergétique E[u_t] (ktep/an)
          </CardTitle>
          <CardDescription>Espérance du déficit sur les {nScenarios} scénarios — sécurité d'approvisionnement</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ktep/an`]} />
              <Line type="monotone" dataKey="deficit" name="E[u_t]" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

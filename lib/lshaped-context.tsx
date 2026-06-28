"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { useSimulation } from "@/lib/simulation-context"
import {
  DEFAULT_CONFIG,
  type LShapedConfig,
  type LShapedResult,
  type LShapedScenario,
  type ParetoPoint,
} from "@/lib/lshaped/types"
import { buildScenariosFromLHS } from "@/lib/lshaped/scenarios"
import { runLShaped, runPareto } from "@/lib/lshaped/solver"

// buildDefaultScenarios is intentionally NOT imported here.
// The L-Shaped solver must use ONLY LHS scenarios.
// There is a single source of scenarios in the application:
//   GenerationPage (LHS) → SimulationContext (lhsResult) → L-Shaped solver
// If lhsResult is null, the solver must not run.

interface LShapedContextType {
  config: LShapedConfig
  setConfig: (c: LShapedConfig) => void
  scenarios: LShapedScenario[]
  result: LShapedResult | null
  paretoPoints: ParetoPoint[]
  isRunning: boolean
  isRunningPareto: boolean
  lhsAvailable: boolean  // true iff lhsResult is present — gate for the solver
  progress: { k: number; LB: number; UB: number; gap: number } | null
  paretoProgress: { pt: number; total: number } | null
  runSolver: (overrideConfig?: LShapedConfig) => void
  runParetoFront: (ghgMin: number, ghgMax: number, nPoints: number) => void
  resetResult: () => void
}

const LShapedContext = createContext<LShapedContextType | undefined>(undefined)

export function LShapedProvider({ children }: { children: ReactNode }) {
  const { lhsResult } = useSimulation()

  const [config, setConfig] = useState<LShapedConfig>(DEFAULT_CONFIG)
  const [scenarios, setScenarios] = useState<LShapedScenario[]>([])
  const [result, setResult] = useState<LShapedResult | null>(null)
  const [paretoPoints, setParetoPoints] = useState<ParetoPoint[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isRunningPareto, setIsRunningPareto] = useState(false)
  const [progress, setProgress] = useState<{ k: number; LB: number; UB: number; gap: number } | null>(null)
  const [paretoProgress, setParetoProgress] = useState<{ pt: number; total: number } | null>(null)

  const lhsAvailable = lhsResult !== null && lhsResult !== undefined

  // Single scenario source: LHS only.
  // Returns null if no LHS result is available — callers must check.
  const buildScenariosFromLHSOrNull = useCallback((n: number): LShapedScenario[] | null => {
    if (!lhsResult) return null
    return buildScenariosFromLHS(lhsResult, n)
  }, [lhsResult])

  const runSolver = useCallback((overrideConfig?: LShapedConfig) => {
    // Hard gate: refuse to run without LHS scenarios
    if (!lhsResult) return

    const effectiveConfig = overrideConfig ?? config
    setIsRunning(true)
    setProgress(null)
    setResult(null)

    setTimeout(() => {
      try {
        const sc = buildScenariosFromLHSOrNull(effectiveConfig.nScenarios)
        if (!sc) {
          setIsRunning(false)
          return
        }
        setScenarios(sc)

        const res = runLShaped(sc, effectiveConfig, (k, LB, UB, gap) => {
          setProgress({ k, LB, UB, gap })
        })
        setResult(res)
      } finally {
        setIsRunning(false)
        setProgress(null)
      }
    }, 30)
  }, [config, buildScenariosFromLHSOrNull, lhsResult])

  const runParetoFront = useCallback((ghgMin: number, ghgMax: number, nPoints: number) => {
    // Hard gate: refuse to run without LHS scenarios
    if (!lhsResult) return

    setIsRunningPareto(true)
    setParetoProgress(null)
    setParetoPoints([])

    setTimeout(() => {
      try {
        // Prefer already-built scenarios; otherwise rebuild from LHS
        const sc = scenarios.length > 0
          ? scenarios
          : buildScenariosFromLHSOrNull(config.nScenarios)
        if (!sc) {
          setIsRunningPareto(false)
          return
        }
        const pts = runPareto(sc, config, ghgMin, ghgMax, nPoints, (pt, total) => {
          setParetoProgress({ pt, total })
        })
        setParetoPoints(pts)
      } finally {
        setIsRunningPareto(false)
        setParetoProgress(null)
      }
    }, 30)
  }, [config, scenarios, buildScenariosFromLHSOrNull, lhsResult])

  const resetResult = useCallback(() => {
    setResult(null)
    setParetoPoints([])
    setScenarios([])
    setProgress(null)
    setParetoProgress(null)
  }, [])

  return (
    <LShapedContext.Provider value={{
      config, setConfig,
      scenarios,
      result,
      paretoPoints,
      isRunning,
      isRunningPareto,
      lhsAvailable,
      progress,
      paretoProgress,
      runSolver,
      runParetoFront,
      resetResult,
    }}>
      {children}
    </LShapedContext.Provider>
  )
}

export function useLShaped() {
  const ctx = useContext(LShapedContext)
  if (!ctx) throw new Error("useLShaped must be used within LShapedProvider")
  return ctx
}

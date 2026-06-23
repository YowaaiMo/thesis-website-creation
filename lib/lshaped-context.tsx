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
import { buildScenariosFromLHS, buildDefaultScenarios } from "@/lib/lshaped/scenarios"
import { runLShaped, runPareto } from "@/lib/lshaped/solver"

interface LShapedContextType {
  config: LShapedConfig
  setConfig: (c: LShapedConfig) => void
  scenarios: LShapedScenario[]
  result: LShapedResult | null
  paretoPoints: ParetoPoint[]
  isRunning: boolean
  isRunningPareto: boolean
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

  const buildScenarios = useCallback((n: number) => {
    return lhsResult
      ? buildScenariosFromLHS(lhsResult, n)
      : buildDefaultScenarios(n)
  }, [lhsResult])

  const runSolver = useCallback((overrideConfig?: LShapedConfig) => {
    const effectiveConfig = overrideConfig ?? config
    setIsRunning(true)
    setProgress(null)
    setResult(null)

    // Use setTimeout to allow React to render before heavy computation
    setTimeout(() => {
      try {
        const sc = buildScenarios(effectiveConfig.nScenarios)
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
  }, [config, buildScenarios])

  const runParetoFront = useCallback((ghgMin: number, ghgMax: number, nPoints: number) => {
    setIsRunningPareto(true)
    setParetoProgress(null)
    setParetoPoints([])

    setTimeout(() => {
      try {
        const sc = scenarios.length > 0 ? scenarios : buildScenarios(config.nScenarios)
        const pts = runPareto(sc, config, ghgMin, ghgMax, nPoints, (pt, total) => {
          setParetoProgress({ pt, total })
        })
        setParetoPoints(pts)
      } finally {
        setIsRunningPareto(false)
        setParetoProgress(null)
      }
    }, 30)
  }, [config, scenarios, buildScenarios])

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

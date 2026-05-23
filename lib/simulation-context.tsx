"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import {
  runSimulation,
  runLHSSimulation,
  setSimulationSeed,
  type SimulationParams,
  type SimulationResult,
  DEFAULT_PARAMS
} from "@/lib/monte-carlo"

interface SimulationContextType {
  params: SimulationParams
  setParams: (params: SimulationParams) => void
  seed: number | null
  setSeed: (seed: number | null) => void
  result: SimulationResult | null
  lhsResult: SimulationResult | null
  isRunning: boolean
  isRunningLHS: boolean
  runMonteCarlo: () => void
  runLHS: () => void
  runBoth: () => void
  resetParams: () => void
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS)
  const [seed, setSeed] = useState<number | null>(null)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [lhsResult, setLhsResult] = useState<SimulationResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isRunningLHS, setIsRunningLHS] = useState(false)

  const runMonteCarlo = useCallback(() => {
    setIsRunning(true)
    setTimeout(() => {
      setSimulationSeed(seed)
      const simulationResult = runSimulation(params)
      setSimulationSeed(null)
      setResult(simulationResult)
      setIsRunning(false)
    }, 50)
  }, [params, seed])

  const runLHS = useCallback(() => {
    setIsRunningLHS(true)
    setTimeout(() => {
      setSimulationSeed(seed)
      const lhs = runLHSSimulation(params)
      setSimulationSeed(null)
      setLhsResult(lhs)
      setIsRunningLHS(false)
    }, 50)
  }, [params, seed])

  const runBoth = useCallback(() => {
    setIsRunning(true)
    setIsRunningLHS(true)
    setTimeout(() => {
      setSimulationSeed(seed)
      const mc = runSimulation(params)
      setResult(mc)
      setIsRunning(false)
      setTimeout(() => {
        setSimulationSeed(seed)
        const lhs = runLHSSimulation(params)
        setSimulationSeed(null)
        setLhsResult(lhs)
        setIsRunningLHS(false)
      }, 50)
    }, 50)
  }, [params, seed])

  const resetParams = useCallback(() => {
    setParams(DEFAULT_PARAMS)
  }, [])

  return (
    <SimulationContext.Provider value={{
      params,
      setParams,
      seed,
      setSeed,
      result,
      lhsResult,
      isRunning,
      isRunningLHS,
      runMonteCarlo,
      runLHS,
      runBoth,
      resetParams
    }}>
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation() {
  const context = useContext(SimulationContext)
  if (context === undefined) {
    throw new Error("useSimulation must be used within a SimulationProvider")
  }
  return context
}

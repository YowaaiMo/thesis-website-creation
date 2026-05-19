"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { 
  runSimulation, 
  type SimulationParams, 
  type SimulationResult, 
  DEFAULT_PARAMS 
} from "@/lib/monte-carlo"

interface SimulationContextType {
  params: SimulationParams
  setParams: (params: SimulationParams) => void
  result: SimulationResult | null
  isRunning: boolean
  runMonteCarlo: () => void
  resetParams: () => void
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const runMonteCarlo = useCallback(() => {
    setIsRunning(true)
    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      const simulationResult = runSimulation(params)
      setResult(simulationResult)
      setIsRunning(false)
    }, 50)
  }, [params])

  const resetParams = useCallback(() => {
    setParams(DEFAULT_PARAMS)
  }, [])

  return (
    <SimulationContext.Provider value={{
      params,
      setParams,
      result,
      isRunning,
      runMonteCarlo,
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

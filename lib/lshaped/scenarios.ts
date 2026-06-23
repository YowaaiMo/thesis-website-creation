// Generate L-Shaped scenarios from existing LHS simulation or defaults
import type { Scenario, SimulationResult } from '@/lib/monte-carlo'
import type { LShapedScenario } from './types'
import { DEFAULT_PERIODS, BASE_OP_COST } from './types'

// Year indices in the 27-year simulation (2024=0 … 2050=26)
const PERIOD_YEAR_INDICES = DEFAULT_PERIODS.map(y => y - 2024)

// Demand trend polynomial D̂_s(t) used to fill gaps
function trendDemand(t_stat: number): number {
  const res = 2.97 * t_stat ** 2 + 218.55 * t_stat + 3614.88
  const ind = 7.37 * t_stat ** 2 - 108.43 * t_stat + 4045.29
  const tra = 8.92 * t_stat ** 2 - 51.88 * t_stat + 3291.95
  const agr = 40.77 * t_stat - 1003.81
  const ter = 142.29 * t_stat - 801.03
  return Math.max(0, res) + Math.max(0, ind) + Math.max(0, tra) + Math.max(0, agr) + Math.max(0, ter)
}

export function buildScenariosFromLHS(
  lhsResult: SimulationResult,
  nScenarios: number
): LShapedScenario[] {
  const { scenarios } = lhsResult
  const n = Math.min(nScenarios, scenarios.length)
  const selected = scenarios.slice(0, n)
  const prob = 1 / n

  return selected.map((sc: Scenario, idx: number): LShapedScenario => ({
    id: idx + 1,
    prob,
    periods: PERIOD_YEAR_INDICES.map((yearIdx, pIdx) => {
      const year = DEFAULT_PERIODS[pIdx]
      const t_stat = year - 1980
      const demand = sc.demand.total[yearIdx] ?? trendDemand(t_stat)
      const hPV = Math.max(0.05, Math.min(1, sc.solarAvailability[yearIdx] ?? 0.6))
      const hWind = Math.max(0.05, Math.min(1, sc.windAvailability[yearIdx] ?? 0.3))

      // Gas op cost: stochastic, derived from gas price relative to base
      const gasBase = BASE_OP_COST['Gaz']
      const gasFactor = sc.operationalCostGas[yearIdx]
        ? sc.operationalCostGas[yearIdx] / 38_000   // normalize from DA/tep to ratio
        : 1
      const gasOpCost = gasBase * Math.max(0.5, Math.min(3, gasFactor))

      const oilFactor = sc.operationalCostOil[yearIdx]
        ? sc.operationalCostOil[yearIdx] / 48_846
        : 1
      const gplFactor = sc.operationalCostGPL[yearIdx]
        ? sc.operationalCostGPL[yearIdx] / 44_194
        : 1
      const condFactor = sc.operationalCostCondensat[yearIdx]
        ? sc.operationalCostCondensat[yearIdx] / 46_520
        : 1

      return {
        year,
        demand,
        hPV,
        hWind,
        gasOpCost,
        oilOpCost: BASE_OP_COST['Pétrole'] * Math.max(0.5, Math.min(3, oilFactor)),
        gplOpCost: BASE_OP_COST['GPL'] * Math.max(0.5, Math.min(3, gplFactor)),
        condOpCost: BASE_OP_COST['Condensat'] * Math.max(0.5, Math.min(3, condFactor)),
      }
    }),
  }))
}

// Simple seeded random (mulberry32)
function mk32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Box-Muller normal
function normal(rng: () => number): number {
  let u = 0, v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function buildDefaultScenarios(nScenarios: number, seed = 42): LShapedScenario[] {
  const rng = mk32(seed)
  const prob = 1 / nScenarios

  return Array.from({ length: nScenarios }, (_, idx) => ({
    id: idx + 1,
    prob,
    periods: DEFAULT_PERIODS.map((year, pIdx) => {
      const t_stat = year - 1980
      const baseDemand = trendDemand(t_stat)
      const demand = baseDemand * (1 + 0.08 * normal(rng))

      // Beta-like solar (mean 0.6, std 0.1)
      const hPV = Math.max(0.2, Math.min(0.95, 0.6 + 0.1 * normal(rng)))

      // Wind truncated normal (mean 0.3, std 0.05)
      const hWind = Math.max(0.1, Math.min(0.6, 0.3 + 0.05 * normal(rng)))

      // Gas price GARCH-like (base + noise)
      const gasMult = Math.max(0.6, 1 + 0.15 * normal(rng))
      const fossMult = () => Math.max(0.6, 1 + 0.12 * normal(rng))

      return {
        year,
        demand,
        hPV,
        hWind,
        gasOpCost: BASE_OP_COST['Gaz'] * gasMult,
        oilOpCost: BASE_OP_COST['Pétrole'] * fossMult(),
        gplOpCost: BASE_OP_COST['GPL'] * fossMult(),
        condOpCost: BASE_OP_COST['Condensat'] * fossMult(),
      }
    }),
  }))
}

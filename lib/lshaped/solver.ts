// Main L-Shaped iteration loop and Pareto front solver

import {
  N_TECH,
  TECHNOLOGIES,
  DEFAULT_PERIODS,
  DEFAULT_PERIOD_SPANS,
  INITIAL_CAPACITY,
  CAPEX_BY_PERIOD,
  discountFactor,
  type LShapedScenario,
  type LShapedConfig,
  type Cut,
  type IterationRecord,
  type MasterSolution,
  type LShapedResult,
  type ParetoPoint,
} from './types'
import { solveSubproblem, solveSubproblemWithGHG } from './subproblem'
import { solveMaster, type MasterLP } from './master-lp'

// ──────────────────────────────────────────────────────────────────────────────
// Helper: build the initial cumulative capacity matrix (no investment yet)
function buildInitialCumX(nPeriods: number): number[][] {
  return Array.from({ length: N_TECH }, (_, i) => {
    const x0 = INITIAL_CAPACITY[TECHNOLOGIES[i]]
    return Array(nPeriods).fill(x0)
  })
}

// Feasible warm start: increase Gas capacity at each period to eliminate demand deficit.
// Without this, the first UB is dominated by deficit penalty → charts unusable.
function computeFeasibleWarmStart(
  scenarios: LShapedScenario[],
  initialCap: number[][],
  investCosts: number[][],
  nPeriods: number,
): { cumX: number[][]; investCost: number } {
  const FOSSIL_AV = 0.85
  const cumX = initialCap.map(row => [...row])

  for (let t = 0; t < nPeriods; t++) {
    const maxD = Math.max(...scenarios.map(sc => sc.periods[t].demand))
    // Conservative effective capacity of non-Gas technologies (ktep/year)
    const nonGas =
      0.60 * cumX[0][t] +   // PV avg availability
      0.30 * cumX[1][t] +   // Wind avg availability
      FOSSIL_AV * cumX[3][t] +
      FOSSIL_AV * cumX[4][t] +
      FOSSIL_AV * cumX[5][t] +
      0.15 * cumX[6][t]     // Battery
    const gasMin = Math.max(0, maxD - nonGas) / FOSSIL_AV
    if (gasMin > cumX[2][t]) cumX[2][t] = gasMin
  }

  // Compute investment cost: deltaX[Gas][t] = additional Gas beyond previous period
  let investCost = 0
  let prevGas = initialCap[2][0]
  for (let t = 0; t < nPeriods; t++) {
    const newInvest = Math.max(0, cumX[2][t] - prevGas)
    investCost += newInvest * investCosts[2][t]
    prevGas = cumX[2][t]
  }

  return { cumX, investCost }
}

// Helper: build invest-cost matrix (M€/ktep discounted per period)
function buildInvestCosts(nPeriods: number): number[][] {
  return Array.from({ length: N_TECH }, (_, i) =>
    Array.from({ length: nPeriods }, (__, t) => {
      const capex = CAPEX_BY_PERIOD[TECHNOLOGIES[i]][t]
      const disc = discountFactor(DEFAULT_PERIODS[t])
      const span = DEFAULT_PERIOD_SPANS[t]
      return capex * disc * span   // M€ per ktep of capacity added in this period
    })
  )
}

// Helper: build initial capacity matrix [nTech][nPeriods] = x_{i,0} for all t
function buildInitialCapMatrix(nPeriods: number): number[][] {
  return Array.from({ length: N_TECH }, (_, i) => {
    const x0 = INITIAL_CAPACITY[TECHNOLOGIES[i]]
    return Array(nPeriods).fill(x0)
  })
}

// ──────────────────────────────────────────────────────────────────────────────
export function runLShaped(
  scenarios: LShapedScenario[],
  config: LShapedConfig,
  onProgress?: (iter: number, LB: number, UB: number, gap: number) => void,
): LShapedResult {
  const nScenarios = scenarios.length
  const nPeriods = DEFAULT_PERIODS.length

  const investCosts = buildInvestCosts(nPeriods)
  const initialCap = buildInitialCapMatrix(nPeriods)

  const cuts: Cut[] = []
  const iterations: IterationRecord[] = []

  // Warm start: initial x̄ covers demand at every period (no deficit in first UB)
  const warmStart = computeFeasibleWarmStart(scenarios, initialCap, investCosts, nPeriods)
  let cumX = warmStart.cumX
  let masterResult: MasterSolution = {
    deltaX: Array.from({ length: N_TECH }, () => Array(nPeriods).fill(0)),
    cumX,
    theta: Array(nScenarios).fill(0),
    investCost: warmStart.investCost,  // account for warm-start capacity cost
    obj: 0,
  }

  let bestUB = Infinity
  let finalLB = 0

  for (let k = 1; k <= config.maxIter; k++) {
    const t0 = Date.now()

    // ── Solve all subproblems at current x̄ ──────────────────────────────────
    const subResults = scenarios.map((sc, w) =>
      solveSubproblem(w, sc, cumX, config.lambdaD)
    )

    // Stamp iteration number on cuts
    const newCuts = subResults.map(sr => ({ ...sr.cut, iteration: k }))
    cuts.push(...newCuts)

    // ── Compute Upper Bound ───────────────────────────────────────────────────
    const opCostSum = subResults.reduce(
      (s, sr, w) => s + scenarios[w].prob * sr.totalOpCost,
      0
    )
    const UB_k = masterResult.investCost + opCostSum
    if (UB_k < bestUB) bestUB = UB_k

    // ── Solve master LP ───────────────────────────────────────────────────────
    const lp: MasterLP = {
      nTech: N_TECH,
      nPeriods,
      nScenarios,
      investCosts,
      scenarioProbs: scenarios.map(s => s.prob),
      initialCap,
      cuts,
    }
    const masterLPResult = solveMaster(lp)
    const LB_k = masterLPResult.obj

    // ── Gap ──────────────────────────────────────────────────────────────────
    const gap = bestUB > 1e-9
      ? (bestUB - LB_k) / Math.max(1, Math.abs(bestUB))
      : 0

    // Update current solution
    cumX = masterLPResult.cumX
    masterResult = {
      deltaX: masterLPResult.deltaX,
      cumX: masterLPResult.cumX,
      theta: masterLPResult.theta,
      investCost: masterLPResult.investCost,
      obj: LB_k,
    }
    finalLB = LB_k

    iterations.push({
      k,
      LB: LB_k,
      UB: bestUB,
      gap,
      master: masterResult,
      subproblems: subResults,
      cuts: newCuts,
      timeMs: Date.now() - t0,
    })

    onProgress?.(k, LB_k, bestUB, gap)

    if (gap < config.tolerance && k >= 2) break
  }

  // Final subproblem evaluation at optimal x̄ to get true GHG / cost
  const finalSub = scenarios.map((sc, w) =>
    solveSubproblem(w, sc, cumX, config.lambdaD)
  )
  const totalGhg = finalSub.reduce((s, sr, w) => s + scenarios[w].prob * sr.totalGhg, 0)
  const totalCost = masterResult.investCost +
    finalSub.reduce((s, sr, w) => s + scenarios[w].prob * sr.totalOpCost, 0)

  const lastIter = iterations[iterations.length - 1]
  const finalGap = lastIter?.gap ?? 0
  const status = finalGap <= config.tolerance ? 'converged' : 'max_iter'

  return {
    config,
    scenarios,
    iterations,
    bestUB,
    finalLB,
    finalGap,
    status,
    totalCost,
    totalGhg,
    finalSolution: masterResult,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ε-constraint Pareto front
export function runPareto(
  scenarios: LShapedScenario[],
  config: LShapedConfig,
  ghgMin: number,
  ghgMax: number,
  nPoints: number,
  onProgress?: (pt: number, total: number) => void,
): ParetoPoint[] {
  const points: ParetoPoint[] = []
  const nScenarios = scenarios.length
  const nPeriods = DEFAULT_PERIODS.length
  const investCosts = buildInvestCosts(nPeriods)
  const initialCap = buildInitialCapMatrix(nPeriods)

  for (let pt = 0; pt < nPoints; pt++) {
    // Linearly spaced ε from ghgMax (unconstrained) to ghgMin (tightest)
    const epsilon = ghgMax - (pt / (nPoints - 1)) * (ghgMax - ghgMin)
    const perScenarioLimit = epsilon / nScenarios

    const cuts: Cut[] = []
    const ws = computeFeasibleWarmStart(scenarios, initialCap, investCosts, nPeriods)
    let cumX = ws.cumX
    let masterResult: MasterSolution = {
      deltaX: Array.from({ length: N_TECH }, () => Array(nPeriods).fill(0)),
      cumX,
      theta: Array(nScenarios).fill(0),
      investCost: ws.investCost,
      obj: 0,
    }

    let bestUB = Infinity

    for (let k = 1; k <= config.maxIter; k++) {
      const subResults = scenarios.map((sc, w) =>
        solveSubproblemWithGHG(w, sc, cumX, config.lambdaD, perScenarioLimit)
      )
      const newCuts = subResults.map(sr => ({ ...sr.cut, iteration: k }))
      cuts.push(...newCuts)

      const opCostSum = subResults.reduce((s, sr, w) => s + scenarios[w].prob * sr.totalOpCost, 0)
      const UB_k = masterResult.investCost + opCostSum
      if (UB_k < bestUB) bestUB = UB_k

      const lp: MasterLP = {
        nTech: N_TECH, nPeriods, nScenarios, investCosts,
        scenarioProbs: scenarios.map(s => s.prob),
        initialCap, cuts,
      }
      const mr = solveMaster(lp)
      const LB_k = mr.obj
      cumX = mr.cumX
      masterResult = { deltaX: mr.deltaX, cumX: mr.cumX, theta: mr.theta, investCost: mr.investCost, obj: LB_k }

      const gap = bestUB > 1 ? (bestUB - LB_k) / Math.abs(bestUB) : 0
      if (gap < config.tolerance && k >= 2) break
    }

    // Evaluate final GHG and cost
    const finalSub = scenarios.map((sc, w) =>
      solveSubproblemWithGHG(w, sc, cumX, config.lambdaD, perScenarioLimit)
    )
    const Z1 = masterResult.investCost +
      finalSub.reduce((s, sr, w) => s + scenarios[w].prob * sr.totalOpCost, 0)
    const Z2 = finalSub.reduce((s, sr, w) => s + scenarios[w].prob * sr.totalGhg, 0)

    points.push({ epsilon, Z1, Z2, solution: masterResult })
    onProgress?.(pt + 1, nPoints)
  }

  return points
}

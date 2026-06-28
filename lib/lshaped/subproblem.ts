// Subproblem solver — merit-order economic dispatch with analytical duals
// For fixed capacity x̄, solve the dispatch LP analytically per period.
// Returns optimal production, deficit, duals, and the optimality cut.

import {
  TECHNOLOGIES,
  N_TECH,
  BASE_OP_COST,
  EMISSION_FACTOR,
  DEFAULT_PERIODS,
  DEFAULT_PERIOD_SPANS,
  INITIAL_CAPACITY,
  BATTERY_PLANNING_AV,
  discountFactor,
  type LShapedScenario,
  type SubproblemResult,
  type Cut,
  type GhgCut,
} from './types'

// Fossil availability factor (from spec)
const FOSSIL_AV = 0.85

// Effective capacity for technology i given installed x and scenario data
// Battery uses BATTERY_PLANNING_AV (0.30) — see types.ts for justification.
// This replaces the previous 0.15 heuristic with a value grounded in:
//   η_round × utilization_factor = 0.846 × 0.355 ≈ 0.30
function effectiveCap(
  techIdx: number,
  x: number,            // ktep/year installed
  hPV: number,
  hWind: number,
): number {
  if (techIdx === 0) return hPV * x              // PV: stochastic solar availability
  if (techIdx === 1) return hWind * x            // Wind: stochastic wind availability
  if (techIdx === 6) return BATTERY_PLANNING_AV * x  // Battery: planning availability model
  return FOSSIL_AV * x                           // Fossil: 85% availability
}

// Operational cost of technology i in period p for a scenario
function opCostForTech(
  techIdx: number,
  pd: LShapedScenario['periods'][number],
): number {
  if (techIdx === 0) return BASE_OP_COST['PV']
  if (techIdx === 1) return BASE_OP_COST['Wind']
  if (techIdx === 2) return pd.gasOpCost
  if (techIdx === 3) return pd.oilOpCost
  if (techIdx === 4) return pd.gplOpCost
  if (techIdx === 5) return pd.condOpCost
  return BASE_OP_COST['Batterie']
}

export function solveSubproblem(
  scenarioIdx: number,
  scenario: LShapedScenario,
  cumX: number[][],  // [N_TECH][nPeriods] cumulative capacity
  lambdaD: number,
): SubproblemResult {
  const nPeriods = scenario.periods.length
  const periodResults: SubproblemResult['periods'] = []
  let totalOpCost = 0
  let totalGhg = 0

  // beta[i][t] = ∂Q/∂x_{i,t} — accumulated across periods (discounted)
  const beta: number[][] = Array.from({ length: N_TECH }, () => Array(nPeriods).fill(0))
  // betaGhg[i][t] = ∂Z₂/∂x_{i,t} — accumulated across periods (undiscounted)
  const betaGhg: number[][] = Array.from({ length: N_TECH }, () => Array(nPeriods).fill(0))

  let alphaAcc = 0  // accumulator for alpha before subtracting beta·x̄

  for (let pIdx = 0; pIdx < nPeriods; pIdx++) {
    const pd = scenario.periods[pIdx]
    const year = DEFAULT_PERIODS[pIdx]
    const span = DEFAULT_PERIOD_SPANS[pIdx]
    const disc = discountFactor(year)
    const demandPerYear = pd.demand    // ktep/year in this period
    const D = demandPerYear * span     // total ktep over the period

    // Get effective capacities and op costs for this period
    const opCosts = Array.from({ length: N_TECH }, (_, i) => opCostForTech(i, pd))
    const caps = Array.from({ length: N_TECH }, (_, i) =>
      effectiveCap(i, cumX[i][pIdx], pd.hPV, pd.hWind) * span
    )

    // Merit-order dispatch: sort technologies by op cost (ascending)
    const order = Array.from({ length: N_TECH }, (_, i) => i)
      .sort((a, b) => opCosts[a] - opCosts[b])

    const production = Array(N_TECH).fill(0)
    let remaining = D

    for (const i of order) {
      const dispatched = Math.min(caps[i], remaining)
      production[i] = dispatched
      remaining = Math.max(0, remaining - dispatched)
    }
    const deficit = remaining

    // Marginal cost (dual of demand constraint)
    let shadowDemand: number
    if (deficit > 1e-6) {
      shadowDemand = lambdaD
    } else {
      // Find last dispatched technology (highest cost among those used)
      let lastTechCost = 0
      for (const i of order) {
        if (production[i] > 1e-6) {
          lastTechCost = Math.max(lastTechCost, opCosts[i])
        }
      }
      shadowDemand = lastTechCost
    }

    // Shadow price of capacity constraint for each technology
    // μ_i > 0 iff technology i is fully used AND cheaper than marginal
    const shadowCap = Array(N_TECH).fill(0)
    for (let i = 0; i < N_TECH; i++) {
      const atCapacity = production[i] >= caps[i] - 1e-6 && caps[i] > 1e-9
      if (atCapacity) {
        shadowCap[i] = Math.max(0, shadowDemand - opCosts[i])
      }
    }

    // GHG for this period
    let periodGhg = 0
    for (let i = 0; i < N_TECH; i++) {
      const techName = TECHNOLOGIES[i]
      periodGhg += production[i] * EMISSION_FACTOR[techName]
    }

    // Discounted operational cost for this period
    const periodOpCost = (
      production.reduce((s, y, i) => s + y * opCosts[i], 0) +
      deficit * lambdaD
    ) * disc

    totalOpCost += periodOpCost
    totalGhg += periodGhg

    // Cut gradient: ∂Q/∂x_{i,pIdx} = -μ_i · ∂(effectiveCap_i)/∂x_{i,pIdx}
    // Must use same availability factors as effectiveCap() to keep cuts consistent.
    const dcap_dx = Array.from({ length: N_TECH }, (_, i) => {
      if (i === 0) return pd.hPV * span
      if (i === 1) return pd.hWind * span
      if (i === 6) return BATTERY_PLANNING_AV * span  // consistent with effectiveCap
      return FOSSIL_AV * span
    })

    for (let i = 0; i < N_TECH; i++) {
      // ∂Q_period/∂x_{i,pIdx} = -shadowCap[i] * dcap_dx[i] * disc
      beta[i][pIdx] += -shadowCap[i] * dcap_dx[i] * disc
    }

    // GHG gradient: ∂Z₂_period/∂x_{i,pIdx} = (EF_i - EF_marginal) × dcap_dx_i
    // EF of marginal technology (0 if system in deficit — deficit has no emissions)
    let EF_marginal = 0
    if (deficit <= 1e-6) {
      let marginalCost = -Infinity
      for (const i of order) {
        if (production[i] > 1e-6 && opCosts[i] > marginalCost) {
          marginalCost = opCosts[i]
          EF_marginal = EMISSION_FACTOR[TECHNOLOGIES[i]]
        }
      }
    }
    for (let i = 0; i < N_TECH; i++) {
      const atCapacity = production[i] >= caps[i] - 1e-6 && caps[i] > 1e-9
      if (atCapacity) {
        // NO discount factor — Z₂ is a cumulative physical quantity (MtCO₂)
        betaGhg[i][pIdx] += (EMISSION_FACTOR[TECHNOLOGIES[i]] - EF_marginal) * dcap_dx[i]
      }
    }

    alphaAcc += periodOpCost

    periodResults.push({
      production,
      deficit,
      opCost: periodOpCost,
      shadowDemand,
      shadowCap,
      ghg: periodGhg,
    })
  }

  // Compute alpha: alpha = Q(x̄) - Σ_{i,t} beta[i][t] * x̄[i][t]
  let alpha = alphaAcc
  for (let i = 0; i < N_TECH; i++) {
    for (let pIdx = 0; pIdx < nPeriods; pIdx++) {
      alpha -= beta[i][pIdx] * cumX[i][pIdx]
    }
  }

  // alphaGhg = Z₂(x̄, ω) − Σ_{i,t} betaGhg[i][t] · x̄[i][t]
  let alphaGhg = totalGhg
  for (let i = 0; i < N_TECH; i++)
    for (let pIdx = 0; pIdx < nPeriods; pIdx++)
      alphaGhg -= betaGhg[i][pIdx] * cumX[i][pIdx]

  const cut: Cut = {
    iteration: 0,  // filled by caller
    scenarioIdx,
    alpha,
    beta,
    active: true,
  }

  const ghgCut: GhgCut = {
    iteration: 0,  // filled by caller
    scenarioIdx,
    alphaGhg,
    betaGhg,
    active: true,
  }

  return {
    scenarioIdx,
    periods: periodResults,
    totalOpCost,
    totalGhg,
    cut,
    ghgCut,
  }
}

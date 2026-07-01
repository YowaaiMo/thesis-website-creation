// Main L-Shaped iteration loop and Pareto front solver
//
// Corrections vs previous version:
//   (1) Master LP now receives maxDeltaX and maxCumX bounds → prevents extreme solutions
//   (2) Pareto ε-constraint enforced on E[Z₂] = Σ_ω p_ω·Z₂^ω ≤ ε (not per-scenario)
//   (3) Default nScenarios = 20 as per scientific requirement

import {
  N_TECH,
  TECHNOLOGIES,
  DEFAULT_PERIODS,
  DEFAULT_PERIOD_SPANS,
  INITIAL_CAPACITY,
  MAX_DELTA_X,
  MAX_CUMULATIVE_X,
  CAPEX_BY_PERIOD,
  discountFactor,
  type LShapedScenario,
  type LShapedConfig,
  type Cut,
  type GhgCut,
  type IterationRecord,
  type MasterSolution,
  type LShapedResult,
  type ParetoPoint,
} from './types'
import { solveSubproblem } from './subproblem'
import { solveMaster, type MasterLP } from './master-lp'

// ──────────────────────────────────────────────────────────────────────────────
// Build investment cost matrix c^inv_{i,t} = CAPEX_{i,t} × d_t  [M€/ktep]
// With annual periods (span = 1), no annuity factor is needed.
// d_t = (1 + r)^{-(t − 2024)}, r = 0.07 (default in discountFactor).
function buildInvestCosts(nPeriods: number): number[][] {
  return Array.from({ length: N_TECH }, (_, i) =>
    Array.from({ length: nPeriods }, (__, t) => {
      const capex = CAPEX_BY_PERIOD[TECHNOLOGIES[i]][t]
      const disc = discountFactor(DEFAULT_PERIODS[t])   // r = 0.07 by default
      return capex * disc
    })
  )
}

// Build x⁰ matrix: initial capacity repeated across periods
function buildInitialCapMatrix(nPeriods: number): number[][] {
  return Array.from({ length: N_TECH }, (_, i) => {
    const x0 = INITIAL_CAPACITY[TECHNOLOGIES[i]]
    return Array(nPeriods).fill(x0)
  })
}

// Build ΔX̄ matrix [nTech × nPeriods] from MAX_DELTA_X (period-invariant)
function buildMaxDeltaX(nPeriods: number): number[][] {
  return Array.from({ length: N_TECH }, (_, i) => {
    const dx = MAX_DELTA_X[TECHNOLOGIES[i]]
    return Array(nPeriods).fill(dx)
  })
}

// Build X̄ matrix [nTech × nPeriods] from MAX_CUMULATIVE_X (period-invariant)
function buildMaxCumX(nPeriods: number): number[][] {
  return Array.from({ length: N_TECH }, (_, i) => {
    const xMax = MAX_CUMULATIVE_X[TECHNOLOGIES[i]]
    return Array(nPeriods).fill(xMax)
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Warm start: minimal Gas addition to cover worst-case demand in each period.
// Fossils are investable, so Gas is the natural coverage technology for deficits.
// Bounded by MAX_DELTA_X and MAX_CUMULATIVE_X per period.
function computeFeasibleWarmStart(
  scenarios: LShapedScenario[],
  initialCap: number[][],
  investCosts: number[][],
  nPeriods: number,
  maxDeltaX: number[][],
): { cumX: number[][]; investCost: number } {
  const FOSSIL_AV = 0.85
  const BATT_AV = 0.30
  const cumX = initialCap.map(row => [...row])

  for (let t = 0; t < nPeriods; t++) {
    const maxD = Math.max(...scenarios.map(sc => sc.periods[t].demand))
    const nonGas =
      0.60 * cumX[0][t] +        // PV average availability
      0.30 * cumX[1][t] +        // Wind average availability
      FOSSIL_AV * cumX[3][t] +   // Oil
      FOSSIL_AV * cumX[4][t] +   // GPL
      FOSSIL_AV * cumX[5][t] +   // Condensat
      BATT_AV  * cumX[6][t]      // Battery
    const gasNeeded = Math.max(0, maxD - nonGas) / FOSSIL_AV
    cumX[2][t] = Math.min(MAX_CUMULATIVE_X['Gaz'], Math.max(cumX[2][t], gasNeeded))
  }

  // Compute Gas investment cost (bounded by ΔX̄_Gas per period)
  let investCost = 0
  let prevGas = initialCap[2][0]
  for (let t = 0; t < nPeriods; t++) {
    const desired = Math.max(0, cumX[2][t] - prevGas)
    const bounded = Math.min(desired, maxDeltaX[2][t])
    cumX[2][t] = prevGas + bounded
    investCost += bounded * investCosts[2][t]
    prevGas = cumX[2][t]
  }

  return { cumX, investCost }
}

// ──────────────────────────────────────────────────────────────────────────────
// Pareto-only warm start: maximise REN investment first, then add minimal Gas
// for worst-case demand coverage. Used ONLY inside computePointEpsilon.
//
// Why: the gas-heavy warm start yields Z₂(x_ws) ≈ 4 500 MtCO₂. The first GHG
// linearisation cut at that point can only reduce the bound by ~400 MtCO₂
// (gradient range over max-REN ΔX at τ'=0 only), leaving min(cut) ≈ 4 100 >>
// ε_NDC = 2 500. This makes the master LP structurally infeasible from iteration 1.
//
// Starting from the REN-maximal point gives Z₂(x_ws) ≈ 1 420 MtCO₂ < ε for all
// practical ε values, so the ε-constraint is immediately satisfiable and the GHG
// cuts provide correct negative gradients (REN displaces fossil, not deficit).
// The warm start NEVER imposes the solution — the L-Shaped LP finds the true optimum.
function computeRenWarmStart(
  scenarios: LShapedScenario[],
  initialCap: number[][],
  investCosts: number[][],
  nPeriods: number,
  maxDeltaX: number[][],
  maxCumX: number[][],
): { cumX: number[][]; investCost: number } {
  const FOSSIL_AV = 0.85
  const BATT_AV   = 0.30
  const cumX = initialCap.map(row => [...row])
  let investCost = 0

  // Phase 1 — Maximise REN (PV=0, Wind=1, Battery=6) cumulatively across periods.
  // Each period's ΔX is bounded by MAX_DELTA_X and MAX_CUMULATIVE_X.
  for (const i of [0, 1, 6]) {
    let prevCap = initialCap[i][0]   // x⁰_i (same for all periods in initialCap)
    for (let t = 0; t < nPeriods; t++) {
      const delta = Math.max(0, Math.min(maxDeltaX[i][t], maxCumX[i][t] - prevCap))
      cumX[i][t] = prevCap + delta
      investCost += delta * investCosts[i][t]
      prevCap = cumX[i][t]
    }
  }

  // Phase 2 — Add minimal Gas to cover worst-case demand (bounded by MAX_DELTA_X).
  // With max-REN already deployed, initial Gas (32 480 ktep) typically suffices
  // for all periods, so Gas investment is usually zero here.
  let prevGas = initialCap[2][0]
  for (let t = 0; t < nPeriods; t++) {
    const maxD = Math.max(...scenarios.map(sc => sc.periods[t].demand))
    const nonGas =
      0.60 * cumX[0][t] +
      0.30 * cumX[1][t] +
      FOSSIL_AV * cumX[3][t] +
      FOSSIL_AV * cumX[4][t] +
      FOSSIL_AV * cumX[5][t] +
      BATT_AV   * cumX[6][t]
    const gasNeeded = Math.max(0, maxD - nonGas) / FOSSIL_AV
    const bounded   = Math.min(Math.max(0, gasNeeded - prevGas), maxDeltaX[2][t])
    cumX[2][t]  = prevGas + bounded
    if (bounded > 1e-9) investCost += bounded * investCosts[2][t]
    prevGas = cumX[2][t]
  }

  return { cumX, investCost }
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
  const maxDeltaX = buildMaxDeltaX(nPeriods)
  const maxCumX = buildMaxCumX(nPeriods)

  const cuts: Cut[] = []
  const iterations: IterationRecord[] = []

  // Warm start: feasible initial x̄ (Gas covers max demand, bounded by X̄)
  const warmStart = computeFeasibleWarmStart(scenarios, initialCap, investCosts, nPeriods, maxDeltaX)
  let cumX = warmStart.cumX
  let masterResult: MasterSolution = {
    deltaX: Array.from({ length: N_TECH }, () => Array(nPeriods).fill(0)),
    cumX,
    theta: Array(nScenarios).fill(0),
    investCost: warmStart.investCost,
    obj: 0,
  }

  let bestUB = Infinity
  let finalLB = 0

  for (let k = 1; k <= config.maxIter; k++) {
    const t0 = Date.now()

    // ① Resolve all subproblems at current x̄
    const subResults = scenarios.map((sc, w) =>
      solveSubproblem(w, sc, cumX, config.lambdaD)
    )

    const newCuts = subResults.map(sr => ({ ...sr.cut, iteration: k }))
    cuts.push(...newCuts)

    // ② Upper Bound: UB_k = CAPEX(x̄^{k-1}) + Σ_ω p_ω · Q_ω(x̄^{k-1})
    const opCostSum = subResults.reduce(
      (s, sr, w) => s + scenarios[w].prob * sr.totalOpCost, 0
    )
    const UB_k = masterResult.investCost + opCostSum
    if (UB_k < bestUB) bestUB = UB_k

    // ③ Solve master LP with cuts + bounds
    const lp: MasterLP = {
      nTech: N_TECH,
      nPeriods,
      nScenarios,
      investCosts,
      scenarioProbs: scenarios.map(s => s.prob),
      initialCap,
      cuts,
      maxDeltaX,
      maxCumX,
    }
    const masterLPResult = solveMaster(lp)
    const LB_k = masterLPResult.obj

    // ④ Gap = (UB* − LB_k) / UB*  — formule exacte du mémoire (§ 7.4.2)
    const gap = bestUB > 1e-9
      ? (bestUB - LB_k) / bestUB
      : 0

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

  // Final evaluation at optimal x̄
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
// True ε-constraint Pareto front — Mavrotas (2009)
//
// For each ε_j, solve exactly:   min Z₁   s.c. E[Z₂] ≤ ε_j,  x ∈ S
//
// Method: extended L-Shaped with GHG linearization cuts.
//   - Each subproblem returns a GHG cut (supporting hyperplane of concave Z₂)
//   - Master LP includes φ_ω surrogate variables + Σ p_ω φ_ω ≤ ε_j constraint
//   - Convergence → φ_ω = Z₂(x*, ω)  and  E[Z₂(x*)] ≤ ε_j  (guaranteed)
//
// Validity: Z₂(x, ω) is concave in x (sum of min-affine functions from merit order).
// GHG cuts are global upper bounds → φ_ω ≥ Z₂(x,ω) at optimum → E[Z₂] ≤ E[φ] ≤ ε.

export function runPareto(
  scenarios: LShapedScenario[],
  config: LShapedConfig,
  ghgMin: number,
  ghgMax: number,
  nPoints: number,
  onProgress?: (pt: number, total: number) => void,
): ParetoPoint[] {
  const nScenarios = scenarios.length
  const nPeriods = DEFAULT_PERIODS.length
  const investCosts = buildInvestCosts(nPeriods)
  const initialCap = buildInitialCapMatrix(nPeriods)
  const maxDeltaX = buildMaxDeltaX(nPeriods)
  const maxCumX = buildMaxCumX(nPeriods)

  // ── Per-point ε-constraint L-Shaped solve ────────────────────────────────
  function computePointEpsilon(epsilon: number): ParetoPoint {
    // REN-maximal warm start (Pareto-only): ensures Z₂(x_ws) < ε for all practical ε,
    // preventing structural infeasibility from the first GHG cut. See computeRenWarmStart.
    const ws = computeRenWarmStart(scenarios, initialCap, investCosts, nPeriods, maxDeltaX, maxCumX)

    const cuts: Cut[] = []
    const ghgCuts: GhgCut[] = []
    let cumX = ws.cumX
    let masterResult: MasterSolution = {
      deltaX: Array.from({ length: N_TECH }, () => Array(nPeriods).fill(0)),
      cumX,
      theta: Array(nScenarios).fill(0),
      investCost: ws.investCost,
      obj: 0,
    }
    let bestUB = Infinity
    let masterStatus = 'optimal'
    let consecutiveInfeasible = 0

    for (let k = 1; k <= config.maxIter; k++) {
      // ① Solve subproblems → cost cuts + GHG cuts
      const subResults = scenarios.map((sc, w) =>
        solveSubproblem(w, sc, cumX, config.lambdaD)
      )
      cuts.push(...subResults.map(sr => ({ ...sr.cut, iteration: k })))
      ghgCuts.push(...subResults.map(sr => ({ ...sr.ghgCut, iteration: k })))

      // ② Upper bound
      const opCostSum = subResults.reduce(
        (s, sr, w) => s + scenarios[w].prob * sr.totalOpCost, 0
      )
      const UB_k = masterResult.investCost + opCostSum
      if (UB_k < bestUB) bestUB = UB_k

      // ③ Master LP with ε-constraint
      const lp: MasterLP = {
        nTech: N_TECH, nPeriods, nScenarios, investCosts,
        scenarioProbs: scenarios.map(s => s.prob),
        initialCap, cuts, maxDeltaX, maxCumX,
        epsilon,
        ghgCuts,
      }
      const mr = solveMaster(lp)
      masterStatus = mr.status

      if (mr.status === 'infeasible') {
        consecutiveInfeasible++
        // After ≥3 infeasible master LPs, ε is genuinely infeasible.
        // (First 1–2 may be transient: GHG cuts are loose early on.)
        if (consecutiveInfeasible >= 3) break
        continue  // generate more GHG cuts without changing x
      }
      consecutiveInfeasible = 0

      cumX = mr.cumX
      masterResult = {
        deltaX: mr.deltaX, cumX: mr.cumX, theta: mr.theta,
        investCost: mr.investCost, obj: mr.obj,
      }

      // ④ Convergence check
      const gap = bestUB > 1 ? (bestUB - mr.obj) / bestUB : 0
      if (gap < config.tolerance && k >= 2) break
    }

    // Infeasible ε — return sentinel (filtered from display by pareto page)
    if (masterStatus === 'infeasible') {
      return {
        epsilon, Z1: Infinity, Z2: Infinity,
        capex: 0, opex: 0, feasible: false,
        solution: masterResult,
      }
    }

    // Evaluate true Z₁ and E[Z₂] at final x* (unpenalized dispatch)
    const sub = scenarios.map((sc, w) =>
      solveSubproblem(w, sc, cumX, config.lambdaD)
    )
    const Z1 = masterResult.investCost +
      sub.reduce((s, sr, w) => s + scenarios[w].prob * sr.totalOpCost, 0)
    const Z2 = sub.reduce((s, sr, w) => s + scenarios[w].prob * sr.totalGhg, 0)
    const capex = masterResult.investCost

    // ── Post-convergence GHG feasibility check ───────────────────────────────
    // The GHG linearisation cuts are valid upper bounds on Z₂ only when Z₂(x,ω)
    // is globally concave in x. When fossil capacity is also a decision variable,
    // Z₂ can be non-concave near the deficit/no-deficit transition, allowing the
    // LP to select x* where the surrogate φ_ω underestimates the true Z₂(x*, ω).
    //
    // Tolerance = 0.5 % — matches the L-Shaped convergence gap tolerance (config.tolerance).
    // Any point with E[Z₂] > ε × 1.005 is marked rejected (feasible:false, rejected:true)
    // so it is excluded from the Pareto chart and A/B/C selection, but its true Z₁ and Z₂
    // are preserved in the table with a "Rejeté" badge for scientific transparency.
    const GHG_FEASIBILITY_TOL = 0.005  // 0.5 %
    if (Z2 > epsilon * (1 + GHG_FEASIBILITY_TOL)) {
      return {
        epsilon, Z1, Z2, capex, opex: Z1 - capex,
        feasible: false, rejected: true,
        solution: masterResult,
      }
    }

    return { epsilon, Z1, Z2, capex, opex: Z1 - capex, feasible: true, solution: masterResult }
  }

  // ── Main loop — N linearly-spaced ε values from ghgMax down to ghgMin ───────
  const points: ParetoPoint[] = []

  for (let pt = 0; pt < nPoints; pt++) {
    const epsilon = nPoints > 1
      ? ghgMax - (pt / (nPoints - 1)) * (ghgMax - ghgMin)
      : ghgMax
    points.push(computePointEpsilon(epsilon))
    onProgress?.(pt + 1, nPoints)
  }

  // ── Insert NDC reference point if not already covered ────────────────────
  const ndc = config.ndcThreshold
  const gridSpacing = nPoints > 1 ? (ghgMax - ghgMin) / (nPoints - 1) : Infinity
  const ndcInRange = ndc > ghgMin && ndc < ghgMax
  const ndcCovered = points.some(p => Math.abs(p.epsilon - ndc) < gridSpacing * 0.4)

  if (ndcInRange && !ndcCovered) {
    const ndcPt = computePointEpsilon(ndc)
    const insertIdx = points.findIndex(p => p.epsilon < ndc)
    if (insertIdx >= 0) points.splice(insertIdx, 0, ndcPt)
    else points.push(ndcPt)
    onProgress?.(nPoints + 1, nPoints + 1)
  }

  return points
}

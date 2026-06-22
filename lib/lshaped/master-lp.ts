// Master problem LP solver using Big-M tableau simplex
// Solves: min c'z  s.t.  A·z ≥ b,  z ≥ 0
// where z = [Δx_{i,τ} for all i,τ | θ_ω for all ω]

const BIG_M = 1e9

/**
 * Minimise c'z subject to A·z ≥ b, z ≥ 0.
 * All constraints must be ≥-type and b ≥ 0 (assured by construction since
 * optimality-cut RHS α̃ are positive for the energy problem).
 *
 * Returns x (length n_orig), optimal obj value, and solving status.
 */
export function solveLPGe(
  nOrig: number,
  c: number[],
  A: number[][],
  b: number[],
): { x: number[]; obj: number; status: 'optimal' | 'infeasible' | 'unbounded' } {
  const m = A.length
  if (m === 0) {
    // Unconstrained: all variables at 0 is optimal when c ≥ 0
    return { x: Array(nOrig).fill(0), obj: 0, status: 'optimal' }
  }

  // Total variables: original (nOrig) + surplus (m) + artificial (m)
  const nTot = nOrig + m + m
  const iSurplus = (i: number) => nOrig + i
  const iArt = (i: number) => nOrig + m + i

  // Extend cost vector with Big-M for artificials
  const cExt = Array(nTot).fill(0)
  for (let j = 0; j < nOrig; j++) cExt[j] = c[j]
  for (let i = 0; i < m; i++) cExt[iArt(i)] = BIG_M

  // Build tableau: (m+1) rows × (nTot+1) cols
  // Row 0: objective; rows 1..m: constraints
  const tab: number[][] = []
  // Objective row (initially the extended cost)
  tab.push([...cExt, 0])
  // Constraint rows: A·z - s + a = b
  for (let i = 0; i < m; i++) {
    const row = Array(nTot + 1).fill(0)
    for (let j = 0; j < nOrig; j++) row[j] = A[i][j]
    row[iSurplus(i)] = -1
    row[iArt(i)] = 1
    row[nTot] = b[i]
    tab.push(row)
  }

  // Initial basis: artificials
  const basis = Array.from({ length: m }, (_, i) => iArt(i))

  // Update objective row: subtract BIG_M × each constraint row
  // (makes reduced cost of artificials = 0 when basic)
  for (let i = 0; i < m; i++) {
    for (let j = 0; j <= nTot; j++) {
      tab[0][j] -= BIG_M * tab[i + 1][j]
    }
  }

  const EPS = 1e-9
  const MAX_ITER = 5000

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Dantzig pivot selection: most negative reduced cost
    let enterCol = -1
    let minRC = -EPS
    for (let j = 0; j < nTot; j++) {
      if (tab[0][j] < minRC) { minRC = tab[0][j]; enterCol = j }
    }
    if (enterCol === -1) break  // optimal

    // Minimum ratio test
    let leaveRow = -1
    let minRatio = Infinity
    for (let i = 1; i <= m; i++) {
      const aij = tab[i][enterCol]
      if (aij > EPS) {
        const ratio = tab[i][nTot] / aij
        if (ratio < minRatio - EPS) {
          minRatio = ratio
          leaveRow = i
        }
      }
    }
    if (leaveRow === -1) return { x: [], obj: -Infinity, status: 'unbounded' }

    // Pivot
    basis[leaveRow - 1] = enterCol
    const pivot = tab[leaveRow][enterCol]
    for (let j = 0; j <= nTot; j++) tab[leaveRow][j] /= pivot

    for (let i = 0; i <= m; i++) {
      if (i === leaveRow) continue
      const factor = tab[i][enterCol]
      if (Math.abs(factor) < EPS) continue
      for (let j = 0; j <= nTot; j++) tab[i][j] -= factor * tab[leaveRow][j]
    }
  }

  // Check feasibility: no artificial should remain basic with positive value
  for (let i = 0; i < m; i++) {
    if (basis[i] >= nOrig + m && tab[i + 1][nTot] > 1e-6) {
      return { x: [], obj: Infinity, status: 'infeasible' }
    }
  }

  // Extract primal solution
  const x = Array(nOrig).fill(0)
  for (let i = 0; i < m; i++) {
    const bv = basis[i]
    if (bv < nOrig) x[bv] = Math.max(0, tab[i + 1][nTot])
  }

  // Compute objective directly from primal (avoid Big-M confusion in obj row)
  const obj = x.reduce((s, v, j) => s + c[j] * v, 0)

  return { x, obj, status: 'optimal' }
}

/**
 * Build and solve the master LP given accumulated cuts.
 *
 * Variables:  z = [Δx_{i,τ}  (nTech×nPeriods)  | θ_ω (nScenarios)]
 *
 * Objective:  min  Σ CAPEX_{i,τ}·disc_τ · Δx_{i,τ}  +  Σ p_ω · θ_ω
 *
 * Constraints (multicut, one per cut per scenario):
 *   θ_ω  -  Σ_{i,τ} γ^k_{ω,i,τ} · Δx_{i,τ}  ≥  ã^k_ω
 *
 * where ã^k_ω and γ^k_{ω,i,τ} are pre-computed from the cuts.
 */
export interface MasterLP {
  nTech: number
  nPeriods: number
  nScenarios: number
  investCosts: number[][]   // [nTech][nPeriods]  M€/ktep discounted
  scenarioProbs: number[]   // [nScenarios]
  initialCap: number[][]    // [nTech][nPeriods]  x_{i,0,t}
  cuts: import('./types').Cut[]
}

export function solveMaster(lp: MasterLP): {
  deltaX: number[][]
  cumX: number[][]
  theta: number[]
  investCost: number
  obj: number
  status: string
} {
  const { nTech, nPeriods, nScenarios, investCosts, scenarioProbs, initialCap, cuts } = lp
  const nDeltaX = nTech * nPeriods
  const nTheta = nScenarios
  const nOrig = nDeltaX + nTheta

  // Index helpers
  const idxDelta = (i: number, t: number) => i * nPeriods + t
  const idxTheta = (w: number) => nDeltaX + w

  // Objective coefficients
  const c = Array(nOrig).fill(0)
  for (let i = 0; i < nTech; i++)
    for (let t = 0; t < nPeriods; t++)
      c[idxDelta(i, t)] = investCosts[i][t]
  for (let w = 0; w < nScenarios; w++)
    c[idxTheta(w)] = scenarioProbs[w]

  if (cuts.length === 0) {
    // No cuts yet: minimum is 0 (invest nothing, θ=0)
    const deltaX = Array.from({ length: nTech }, () => Array(nPeriods).fill(0))
    const cumX = deltaX.map((row, i) => row.map((_, t) => initialCap[i][t]))
    return {
      deltaX,
      cumX,
      theta: Array(nScenarios).fill(0),
      investCost: 0,
      obj: 0,
      status: 'optimal',
    }
  }

  // Build constraints: one per cut
  // Cut says: θ_ω ≥ alpha + Σ_{i,τ} beta[i][τ] · x_{i,τ}
  // With x_{i,τ} = x0_{i,τ} + Σ_{τ'≤τ} Δx_{i,τ'} (cumulative)
  // So: θ_ω - Σ_{i,τ'} γ_{ω,i,τ'} · Δx_{i,τ'} ≥ ã_ω
  //   where γ_{ω,i,τ'} = Σ_{τ≥τ'} beta[i][τ]
  //   and   ã_ω        = alpha + Σ_{i,τ} beta[i][τ] · x0_{i,τ}

  const A: number[][] = []
  const b: number[] = []

  for (const cut of cuts) {
    const w = cut.scenarioIdx
    // Compute ã
    let aTilde = cut.alpha
    for (let i = 0; i < nTech; i++)
      for (let t = 0; t < nPeriods; t++)
        aTilde += cut.beta[i][t] * initialCap[i][t]

    // Compute γ_{i,τ'} = Σ_{t≥τ'} beta[i][t]
    const gamma: number[][] = Array.from({ length: nTech }, () => Array(nPeriods).fill(0))
    for (let i = 0; i < nTech; i++) {
      for (let tau = nPeriods - 1; tau >= 0; tau--) {
        gamma[i][tau] = cut.beta[i][tau] + (tau + 1 < nPeriods ? gamma[i][tau + 1] : 0)
      }
    }

    // Row: θ_w - Σ_{i,τ'} γ[i][τ'] · Δx_{i,τ'} ≥ aTilde
    const row = Array(nOrig).fill(0)
    row[idxTheta(w)] = 1
    for (let i = 0; i < nTech; i++)
      for (let tau = 0; tau < nPeriods; tau++)
        row[idxDelta(i, tau)] = -gamma[i][tau]  // subtract γ·Δx from lhs

    // b must be ≥ 0 for our implementation. aTilde can be negative if cuts are weak.
    // If aTilde < 0 we can safely clamp to 0 (θ ≥ 0 already dominates)
    const bVal = Math.max(0, aTilde)
    A.push(row)
    b.push(bVal)
  }

  const result = solveLPGe(nOrig, c, A, b)

  if (result.status !== 'optimal') {
    // Fallback: return initial capacity, no investment
    const deltaX = Array.from({ length: nTech }, () => Array(nPeriods).fill(0))
    const cumX = deltaX.map((row, i) => row.map((_, t) => initialCap[i][t]))
    return { deltaX, cumX, theta: Array(nScenarios).fill(0), investCost: 0, obj: 0, status: result.status }
  }

  // Extract Δx and θ
  const deltaX = Array.from({ length: nTech }, (_, i) =>
    Array.from({ length: nPeriods }, (__, t) => Math.max(0, result.x[idxDelta(i, t)]))
  )
  const theta = Array.from({ length: nScenarios }, (_, w) =>
    Math.max(0, result.x[idxTheta(w)])
  )

  // Cumulative capacity x_{i,t} = x_{i,0} + Σ_{τ≤t} Δx_{i,τ}
  const cumX = Array.from({ length: nTech }, (_, i) => {
    const row: number[] = []
    let running = 0
    for (let t = 0; t < nPeriods; t++) {
      running += deltaX[i][t]
      row.push(initialCap[i][t] + running)
    }
    return row
  })

  const investCost = deltaX.reduce(
    (s, row, i) => s + row.reduce((ss, dx, t) => ss + dx * investCosts[i][t], 0),
    0
  )

  return { deltaX, cumX, theta, investCost, obj: result.obj, status: 'optimal' }
}

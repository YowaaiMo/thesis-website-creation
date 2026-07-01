// Master problem LP solver — Big-M simplex with unified constraint handling
//
// Solves: min c'z  s.t.  A·z ≥ b,  0 ≤ z ≤ ub
//
// Constraint handling:
//   b_i ≥ 0 → standard: A_i·z − s_i + a_i = b_i, a_i in initial basis (Big-M)
//   b_i < 0 → negate row: (−A_i)·z + s_i = −b_i, s_i in initial basis (no Big-M needed)
//
// The sign-flip for b_i < 0 preserves the constraint: since s_i = −b_i + A_i·z ≥ 0
// ↔ A_i·z ≥ b_i (original constraint). This allows Benders cuts with negative RHS
// and investment/capacity bounds without any clamping.

// Reduced from 1e9 → 1e7 for better numerical conditioning.
// With costs O(10^4–10^6 M€), BIG_M = 1e7 provides 10x safety margin.
const BIG_M = 1e7

/**
 * General LP solver: min c'z  s.t.  A·z ≥ b,  0 ≤ z ≤ ub
 *
 * Handles arbitrary b (positive or negative RHS).
 * ub[j] = Infinity means no upper bound on z_j.
 * Upper bounds z_j ≤ ub_j are converted to ≥ constraints: -z_j ≥ -ub_j (b < 0 path).
 */
export function solveLPGe(
  nOrig: number,
  c: number[],
  A: number[][],
  b: number[],
  ub?: number[],
): { x: number[]; obj: number; status: 'optimal' | 'infeasible' | 'unbounded' } {

  // Augment with upper-bound constraints: z_j ≤ ub_j → -z_j ≥ -ub_j (b < 0)
  const Af: number[][] = [...A]
  const bf: number[] = [...b]
  if (ub) {
    for (let j = 0; j < nOrig; j++) {
      if (isFinite(ub[j])) {
        const row = Array(nOrig).fill(0)
        row[j] = -1
        Af.push(row)
        bf.push(-ub[j])
      }
    }
  }

  const m = Af.length
  if (m === 0) {
    return { x: Array(nOrig).fill(0), obj: 0, status: 'optimal' }
  }

  // Classify: b_i >= 0 needs artificial; b_i < 0 uses negated-row surplus
  const needsArt = bf.map(bi => bi >= 0)
  const nArt = needsArt.filter(Boolean).length

  // Global index of artificial variable for row i (only if needsArt[i])
  const artOf: number[] = []
  let aC = 0
  for (let i = 0; i < m; i++) artOf.push(needsArt[i] ? nOrig + m + aC++ : -1)

  const nTot = nOrig + m + nArt

  // Extended cost vector: Big-M penalty for artificials only
  const cExt = Array(nTot).fill(0)
  for (let j = 0; j < nOrig; j++) cExt[j] = c[j]
  for (let i = 0; i < m; i++) if (needsArt[i]) cExt[artOf[i]] = BIG_M

  // Build tableau: row 0 = objective, rows 1..m = constraints
  const tab: number[][] = [Array(nTot + 1).fill(0)]
  for (let j = 0; j <= nTot; j++) tab[0][j] = cExt[j]

  for (let i = 0; i < m; i++) {
    const row = Array(nTot + 1).fill(0)
    if (needsArt[i]) {
      // b_i >= 0: A_i·z − s_i + a_i = b_i, artificial a_i in basis
      for (let j = 0; j < nOrig; j++) row[j] = Af[i][j]
      row[nOrig + i] = -1          // surplus coefficient
      row[artOf[i]] = +1           // artificial coefficient
      row[nTot] = bf[i]            // RHS = b_i >= 0
    } else {
      // b_i < 0: negate row → (−A_i)·z + s_i = −b_i, surplus in basis
      for (let j = 0; j < nOrig; j++) row[j] = -Af[i][j]
      row[nOrig + i] = +1          // surplus coefficient (positive after negation)
      row[nTot] = -bf[i]           // RHS = −b_i > 0  ✓
    }
    tab.push(row)
  }

  // Initial basis: artificial if b_i >= 0, surplus if b_i < 0
  const basis = Array.from({ length: m }, (_, i) =>
    needsArt[i] ? artOf[i] : nOrig + i
  )

  // Update objective row to eliminate artificial basis variables (standard Big-M setup)
  for (let i = 0; i < m; i++) {
    if (!needsArt[i]) continue
    for (let j = 0; j <= nTot; j++) tab[0][j] -= BIG_M * tab[i + 1][j]
  }

  const EPS = 1e-9
  const MAX_ITER = 50_000

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Dantzig pivot: most negative reduced cost
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
        if (ratio < minRatio - EPS) { minRatio = ratio; leaveRow = i }
      }
    }
    if (leaveRow === -1) return { x: [], obj: -Infinity, status: 'unbounded' }

    // Pivot
    basis[leaveRow - 1] = enterCol
    const piv = tab[leaveRow][enterCol]
    for (let j = 0; j <= nTot; j++) tab[leaveRow][j] /= piv
    for (let i = 0; i <= m; i++) {
      if (i === leaveRow) continue
      const f = tab[i][enterCol]
      if (Math.abs(f) < EPS) continue
      for (let j = 0; j <= nTot; j++) tab[i][j] -= f * tab[leaveRow][j]
    }
  }

  // Feasibility check: no artificial in basis with positive value
  for (let i = 0; i < m; i++) {
    if (needsArt[i] && basis[i] >= nOrig + m && tab[i + 1][nTot] > 1e-6) {
      return { x: [], obj: Infinity, status: 'infeasible' }
    }
  }

  // Extract primal solution
  const x = Array(nOrig).fill(0)
  for (let i = 0; i < m; i++) {
    if (basis[i] < nOrig) x[basis[i]] = Math.max(0, tab[i + 1][nTot])
  }

  const obj = x.reduce((s, v, j) => s + c[j] * v, 0)
  return { x, obj, status: 'optimal' }
}

// ──────────────────────────────────────────────────────────────────────────────
/**
 * Master LP input structure.
 *
 * Standard (no epsilon): z = [Δx_{i,τ}  (nTech×nPeriods)] ∪ [θ_ω (nScenarios)]
 * With ε-constraint:     z = [Δx_{i,τ}] ∪ [θ_ω] ∪ [φ_ω (nScenarios)]
 *
 * Objective:   min  Σ c^inv_{i,τ}·Δx_{i,τ}  +  Σ p_ω·θ_ω    (φ not in objective)
 *
 * Constraints:
 *   (1) Cost cuts:    θ_ω − Σ γ^k_{ω,i,τ}·Δx_{i,τ} ≥ ã^k_ω
 *   (2) GHG cuts:     φ_ω − Σ γ^k_GHG_{ω,i,τ}·Δx_{i,τ} ≥ ã^k_GHG_ω   [if epsilon set]
 *   (3) ε constraint: −Σ_ω p_ω·φ_ω ≥ −ε  (b<0 path)                    [if epsilon set]
 *   (4) Investment:   0 ≤ Δx_{i,τ} ≤ maxDeltaX[i][τ]
 *   (5) Cumulative:   −Σ_{τ'≤τ} Δx_{i,τ'} ≥ −(maxCumX[i][τ]−x⁰_i)    (b<0 path)
 */
export interface MasterLP {
  nTech: number
  nPeriods: number
  nScenarios: number
  investCosts: number[][]     // [nTech][nPeriods] M€/ktep discounted per period
  scenarioProbs: number[]     // [nScenarios]
  initialCap: number[][]      // [nTech][nPeriods] = x⁰_i for all τ
  cuts: import('./types').Cut[]
  maxDeltaX: number[][]       // [nTech][nPeriods] ΔX̄_{i,τ} — max new capacity
  maxCumX: number[][]         // [nTech][nPeriods] X̄_{i,τ} — max cumulative capacity
  epsilon?: number             // if set: enforce Σ_ω p_ω·φ_ω ≤ ε (MtCO₂)
  ghgCuts?: import('./types').GhgCut[]   // GHG linearization cuts (one per scenario per iteration)
}

export function solveMaster(lp: MasterLP): {
  deltaX: number[][]
  cumX: number[][]
  theta: number[]
  investCost: number
  obj: number
  status: string
} {
  const { nTech, nPeriods, nScenarios, investCosts, scenarioProbs,
          initialCap, cuts, maxDeltaX, maxCumX, epsilon, ghgCuts } = lp

  const hasGhg = epsilon !== undefined && ghgCuts !== undefined && ghgCuts.length > 0

  const nDeltaX = nTech * nPeriods
  const nTheta  = nScenarios
  const nPhi    = hasGhg ? nScenarios : 0
  const nOrig   = nDeltaX + nTheta + nPhi

  const idxDelta = (i: number, t: number) => i * nPeriods + t
  const idxTheta = (w: number) => nDeltaX + w
  const idxPhi   = (w: number) => nDeltaX + nTheta + w   // only valid when hasGhg

  // Objective coefficients — φ_ω have zero cost (constraint only, not objective)
  const c = Array(nOrig).fill(0)
  for (let i = 0; i < nTech; i++)
    for (let t = 0; t < nPeriods; t++)
      c[idxDelta(i, t)] = investCosts[i][t]
  for (let w = 0; w < nScenarios; w++)
    c[idxTheta(w)] = scenarioProbs[w]

  // Upper bounds: Δx_{i,τ} ≤ maxDeltaX[i][τ], θ_ω and φ_ω unbounded
  const ub = Array(nOrig).fill(Infinity)
  for (let i = 0; i < nTech; i++)
    for (let t = 0; t < nPeriods; t++)
      ub[idxDelta(i, t)] = maxDeltaX[i][t]

  // Build ≥ constraint matrix
  const A: number[][] = []
  const b: number[] = []

  // ── (1) Cost optimality cuts ─────────────────────────────────────────────
  // θ_w − Σ_{i,τ'} γ_{w,i,τ'}·Δx_{i,τ'} ≥ ã_{w}^k
  // where ã = α + Σ β·x0  and  γ_{i,τ'} = Σ_{t≥τ'} β[i][t]  (suffix sum)
  for (const cut of cuts) {
    const w = cut.scenarioIdx
    let aTilde = cut.alpha
    for (let i = 0; i < nTech; i++)
      for (let t = 0; t < nPeriods; t++)
        aTilde += cut.beta[i][t] * initialCap[i][t]

    const gamma: number[][] = Array.from({ length: nTech }, () => Array(nPeriods).fill(0))
    for (let i = 0; i < nTech; i++)
      for (let tau = nPeriods - 1; tau >= 0; tau--)
        gamma[i][tau] = cut.beta[i][tau] + (tau + 1 < nPeriods ? gamma[i][tau + 1] : 0)

    const row = Array(nOrig).fill(0)
    row[idxTheta(w)] = 1
    for (let i = 0; i < nTech; i++)
      for (let tau = 0; tau < nPeriods; tau++)
        row[idxDelta(i, tau)] = -gamma[i][tau]

    A.push(row)
    b.push(aTilde)
  }

  // ── (2) GHG linearization cuts (only when ε-constraint active) ───────────
  // φ_w − Σ_{i,τ'} γ_GHG_{w,i,τ'}·Δx_{i,τ'} ≥ ã_GHG_{w}^k
  // Valid because Z₂(x,ω) is concave in x → gradient gives global upper bound
  // → φ_ω ≥ cut(x) ≥ Z₂(x,ω) at the optimum, so Σ p_ω φ_ω ≤ ε ⟹ E[Z₂] ≤ ε
  if (hasGhg) {
    for (const ghgCut of ghgCuts!) {
      const w = ghgCut.scenarioIdx
      let aTildeGhg = ghgCut.alphaGhg
      for (let i = 0; i < nTech; i++)
        for (let t = 0; t < nPeriods; t++)
          aTildeGhg += ghgCut.betaGhg[i][t] * initialCap[i][t]

      const gammaGhg: number[][] = Array.from({ length: nTech }, () => Array(nPeriods).fill(0))
      for (let i = 0; i < nTech; i++)
        for (let tau = nPeriods - 1; tau >= 0; tau--)
          gammaGhg[i][tau] = ghgCut.betaGhg[i][tau] + (tau + 1 < nPeriods ? gammaGhg[i][tau + 1] : 0)

      const row = Array(nOrig).fill(0)
      row[idxPhi(w)] = 1
      for (let i = 0; i < nTech; i++)
        for (let tau = 0; tau < nPeriods; tau++)
          row[idxDelta(i, tau)] = -gammaGhg[i][tau]

      A.push(row)
      b.push(aTildeGhg)
    }

    // ── (3) GHG aggregate constraint: Σ_ω p_ω·φ_ω ≤ ε ─────────────────────
    // Written as ≥: −Σ_ω p_ω·φ_ω ≥ −ε  (b < 0 path in solveLPGe)
    const row = Array(nOrig).fill(0)
    for (let w = 0; w < nScenarios; w++) row[idxPhi(w)] = -scenarioProbs[w]
    A.push(row)
    b.push(-epsilon!)   // b < 0 → handled by negated-row path
  }

  // ── (4) Cumulative capacity bounds ───────────────────────────────────────
  // −Σ_{τ'≤τ} Δx_{i,τ'} ≥ −(maxCumX[i][τ]−x⁰_i)   (b<0 path)
  for (let i = 0; i < nTech; i++) {
    for (let tau = 0; tau < nPeriods; tau++) {
      const rhs = -(maxCumX[i][tau] - initialCap[i][tau])
      if (rhs >= 0) continue
      const row = Array(nOrig).fill(0)
      for (let tPrime = 0; tPrime <= tau; tPrime++)
        row[idxDelta(i, tPrime)] = -1
      A.push(row)
      b.push(rhs)
    }
  }

  // ── Solve ─────────────────────────────────────────────────────────────────
  const result = solveLPGe(nOrig, c, A, b, ub)

  if (result.status !== 'optimal') {
    const deltaX = Array.from({ length: nTech }, () => Array(nPeriods).fill(0))
    const cumX = deltaX.map((_, i) => initialCap[i].slice())
    return { deltaX, cumX, theta: Array(nScenarios).fill(0), investCost: 0, obj: 0, status: result.status }
  }

  // ── Extract Δx, θ (and discard φ — used internally for constraint only) ──
  const deltaX = Array.from({ length: nTech }, (_, i) =>
    Array.from({ length: nPeriods }, (__, t) => Math.max(0, result.x[idxDelta(i, t)]))
  )
  const theta = Array.from({ length: nScenarios }, (_, w) =>
    Math.max(0, result.x[idxTheta(w)])
  )

  const cumX = Array.from({ length: nTech }, (_, i) => {
    let running = 0
    return Array.from({ length: nPeriods }, (__, t) => {
      running += deltaX[i][t]
      return initialCap[i][t] + running
    })
  })

  const investCost = deltaX.reduce(
    (s, row, i) => s + row.reduce((ss, dx, t) => ss + dx * investCosts[i][t], 0),
    0
  )

  return { deltaX, cumX, theta, investCost, obj: result.obj, status: 'optimal' }
}

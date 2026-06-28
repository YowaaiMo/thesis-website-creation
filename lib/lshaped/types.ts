// L-Shaped Stochastic Optimization — Type Definitions
// Units: capacity & demand in ktep/year, costs in M€, GHG in MtCO2
// Convention: x_{i,τ} represents maximum annual deliverable energy from source i in period τ
// across ALL end-uses (electricity + industry + heat + transport) for Algeria's total energy mix.

export const TECHNOLOGIES = ['PV', 'Wind', 'Gaz', 'Pétrole', 'GPL', 'Condensat', 'Batterie'] as const
export type Technology = typeof TECHNOLOGIES[number]
export const N_TECH = 7

// 5 representative periods spanning 2024–2050
// Justification: temporal aggregation reduces master LP from 27×7=189 to 5×7=35 variables.
// Energy balance is preserved via span weights Δt_τ; discounting via d_τ × Δt_τ approximates ∫d(t)dt.
export const DEFAULT_PERIODS = [2024, 2030, 2036, 2042, 2048] as const
export const DEFAULT_PERIOD_SPANS = [6, 6, 6, 6, 3] as const // years each period represents

export interface LShapedScenario {
  id: number
  prob: number
  periods: PeriodData[]
}

export interface PeriodData {
  year: number
  demand: number     // ktep/year (total across all sectors)
  hPV: number        // ∈ [0,1] solar availability factor
  hWind: number      // ∈ [0,1] wind availability factor
  gasOpCost: number  // M€/ktep operational cost (stochastic)
  oilOpCost: number
  gplOpCost: number
  condOpCost: number
}

export interface LShapedConfig {
  nScenarios: number
  maxIter: number
  tolerance: number      // gap threshold for convergence (e.g. 0.005 = 0.5%)
  lambdaD: number        // penalty for demand deficit (>> max op cost)
  enablePareto: boolean
  nParetoPoints: number
  ndcThreshold: number   // MtCO₂ total horizon — vérification NDC (post-hoc)
}

// Scientific default: 20 scenarios per professor's requirement (LHS-generated).
// Keep nScenarios = 5 ONLY for quick debug/test runs, never for final results.
export const DEFAULT_CONFIG: LShapedConfig = {
  nScenarios: 20,
  maxIter: 30,
  tolerance: 0.005,
  lambdaD: 50,           // M€/ktep — >> max fossil op cost ~0.22
  enablePareto: false,
  nParetoPoints: 10,
  ndcThreshold: 2_500,   // MtCO₂ — plafond NDC Algérie (ajustable)
}

export const DEBUG_CONFIG: LShapedConfig = {
  ...DEFAULT_CONFIG,
  nScenarios: 5,
  maxIter: 15,
}

// ──────────────────────────────────────────────────────────────────────────────
// Initial installed capacities — Algeria 2024 (Table 6.3, mémoire)
// Effective supply ≈ 56 072 units vs demand 2024 ≈ 57 047 → déficit initial ~1.7%
export const INITIAL_CAPACITY: Record<Technology, number> = {
  'PV':           198,   // Table 6.3 (mémoire)
  'Wind':          30,   // Table 6.3 (mémoire)
  'Gaz':       32_480,   // Table 6.3 (mémoire)
  'Pétrole':   18_720,   // Table 6.3 (mémoire)
  'GPL':        8_150,   // Table 6.3 (mémoire)
  'Condensat':  6_430,   // Table 6.3 (mémoire)
  'Batterie':     100,   // estimation 2024
}

// ──────────────────────────────────────────────────────────────────────────────
// Maximum NEW capacity per 6-year representative period.
// Renouvelables : ajout annuel max × 6 ans (Table 6.4 mémoire).
// Fossiles : bornes de réalisme technologique (expansion possible mais plafonnée).
export const MAX_DELTA_X: Record<Technology, number> = {
  'PV':        24_000,   // 4 000/an × 6 ans — Table 6.4 (mémoire)
  'Wind':      18_000,   // 3 000/an × 6 ans — Table 6.4 (mémoire)
  'Gaz':        5_000,   // expansion Sonelgaz — plafond de réalisme
  'Pétrole':    2_000,   // tendance légèrement déclinante
  'GPL':        1_000,   // saturation résidentielle
  'Condensat':  1_000,   // couplé à la production pétrolière
  'Batterie':   7_200,   // 1 200/an × 6 ans — Table 6.4 (mémoire)
}

// Maximum CUMULATIVE installed capacity.
// Renouvelables : Table 6.4 (mémoire). Fossiles : plafonds réalistes long terme.
export const MAX_CUMULATIVE_X: Record<Technology, number> = {
  'PV':       100_000,   // Table 6.4 (mémoire)
  'Wind':      80_000,   // Table 6.4 (mémoire)
  'Gaz':       65_000,   // incluant capacité initiale 32 480
  'Pétrole':   25_000,   // incluant capacité initiale 18 720
  'GPL':       12_000,   // incluant capacité initiale 8 150
  'Condensat': 12_000,   // incluant capacité initiale 6 430
  'Batterie':  25_000,   // Table 6.4 (mémoire)
}

// ──────────────────────────────────────────────────────────────────────────────
// CAPEX per period in M€/ktep — interpreted as annualized capital cost
// (paid every year of the period, so total cost = CAPEX × disc_τ × Δt_τ)
// Row = technology, column = period index (0‥4)
export const CAPEX_BY_PERIOD: Record<Technology, number[]> = {
  'PV':        [5.31, 4.15, 3.25, 2.54, 1.99],   // declining (learning curve)
  'Wind':      [6.37, 5.48, 4.71, 4.05, 3.48],   // declining
  'Gaz':       [1.09, 1.09, 1.09, 1.09, 1.09],   // constant (mature technology)
  'Pétrole':   [0.80, 0.80, 0.80, 0.80, 0.80],
  'GPL':       [0.70, 0.70, 0.70, 0.70, 0.70],
  'Condensat': [0.80, 0.80, 0.80, 0.80, 0.80],
  'Batterie':  [15.9, 10.8, 7.37, 5.02, 3.41],   // strong learning curve (lithium-ion)
}

// Base operational costs (M€/ktep dispatched) — stochastic costs built on top for fossils
export const BASE_OP_COST: Record<Technology, number> = {
  'PV':        0.054,
  'Wind':      0.076,
  'Gaz':       0.162,
  'Pétrole':   0.216,
  'GPL':       0.195,
  'Condensat': 0.206,
  'Batterie':  0.020,   // cycling O&M cost
}

// GHG emission factors (MtCO2/ktep dispatched)
export const EMISSION_FACTOR: Record<Technology, number> = {
  'PV':        0,
  'Wind':      0,
  'Gaz':       0.00235,
  'Pétrole':   0.00307,
  'GPL':       0.00265,
  'Condensat': 0.00295,
  'Batterie':  0,
}

// ──────────────────────────────────────────────────────────────────────────────
// Battery planning model parameters (Level B — intermediate planning model)
// Justification: for multi-year planning (5 representative periods), a daily SoC
// model is inappropriate (time scale mismatch). Instead, battery provides a
// "planning availability" reflecting:
//   η_round = η_c × η_d = 0.92² ≈ 0.846 (round-trip efficiency)
//   utilization = 0.355 (daily cycling ~130 useful days/year at design DOD)
//   BATTERY_PLANNING_AV = 0.846 × 0.355 ≈ 0.30
// This means: 1 ktep of installed battery capacity contributes 0.30 ktep/year
// of dispatchable energy supply in the annual planning balance.
export const BATTERY_PLANNING_AV = 0.30
export const BATTERY_ROUND_TRIP_EFF = 0.846  // η_c × η_d = 0.92²

// NDC plafond d'émissions (MtCO₂ sur tout l'horizon 2024–2050)
// ≈ 37% réduction vs référence 100% fossil (~4 000 MtCO₂). Ajustable par l'utilisateur.
export const NDC_THRESHOLD_DEFAULT = 2_500

// Discount factor d_τ = (1 + r)^{-(τ − 2024)}, r = 2%
export function discountFactor(year: number, r = 0.02): number {
  return 1 / Math.pow(1 + r, year - 2024)
}

// ──────────────────────────────────────────────────────────────────────────────
// Cost cut structure: θ_ω ≥ α + Σ_{i,τ} β[i][τ] · x_{i,τ}
export interface Cut {
  iteration: number
  scenarioIdx: number
  alpha: number
  beta: number[][]   // [N_TECH][nPeriods]
  active: boolean
}

// GHG cut structure: φ_ω ≥ alphaGhg + Σ_{i,τ} betaGhg[i][τ] · x_{i,τ}
// Supporting hyperplane of the concave function Z₂(x, ω) from above.
// Used in ε-constraint Pareto: Σ_ω p_ω φ_ω ≤ ε  →  E[Z₂] ≤ ε  ✓
export interface GhgCut {
  iteration: number
  scenarioIdx: number
  alphaGhg: number
  betaGhg: number[][]   // [N_TECH][nPeriods] — gradient ∂Z₂/∂x, undiscounted
  active: boolean
}

// ──────────────────────────────────────────────────────────────────────────────
export interface SubproblemResult {
  scenarioIdx: number
  periods: {
    production: number[]   // [N_TECH] ktep dispatched over the period
    deficit: number        // ktep unmet demand
    opCost: number         // M€ discounted operational cost
    shadowDemand: number   // dual of demand constraint (M€/ktep)
    shadowCap: number[]    // dual of capacity constraint per tech (M€/ktep)
    ghg: number            // MtCO2 GHG emissions
  }[]
  totalOpCost: number
  totalGhg: number
  cut: Cut
  ghgCut: GhgCut
}

export interface MasterSolution {
  deltaX: number[][]   // [N_TECH][nPeriods] new capacity added per period
  cumX: number[][]     // [N_TECH][nPeriods] cumulative capacity
  theta: number[]      // [nScenarios] future cost proxy values
  investCost: number   // M€ discounted CAPEX
  obj: number          // master objective (Lower Bound)
}

export interface IterationRecord {
  k: number
  LB: number
  UB: number
  gap: number
  master: MasterSolution
  subproblems: SubproblemResult[]
  cuts: Cut[]
  timeMs: number
}

export interface LShapedResult {
  config: LShapedConfig
  scenarios: LShapedScenario[]
  iterations: IterationRecord[]
  bestUB: number
  finalLB: number
  finalGap: number
  status: 'converged' | 'max_iter'
  totalCost: number
  totalGhg: number
  finalSolution: MasterSolution
}

export interface ParetoPoint {
  epsilon: number    // GHG upper bound E[Z₂] ≤ ε (MtCO₂)
  Z1: number         // total cost (M€)
  Z2: number         // expected GHG (MtCO₂) — true value from post-convergence re-evaluation
  capex: number      // discounted CAPEX component (M€)
  opex: number       // expected discounted OPEX component (M€)
  feasible: boolean  // false when LP was structurally infeasible (Z1=Z2=∞) OR post-check rejected
  rejected?: boolean // true when LP converged but post-check finds E[Z₂] > ε × (1 + GHG_TOL)
                     // In this case Z1/Z2 hold the actual values so the violation can be displayed.
  solution: MasterSolution
}

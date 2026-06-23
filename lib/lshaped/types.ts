// L-Shaped Stochastic Optimization — Type Definitions
// Units: capacity & demand in ktep/year, costs in M€, GHG in MtCO2

export const TECHNOLOGIES = ['PV', 'Wind', 'Gaz', 'Pétrole', 'GPL', 'Condensat', 'Batterie'] as const
export type Technology = typeof TECHNOLOGIES[number]
export const N_TECH = 7

// Default 5 representative periods spanning 2024–2050
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
  hPV: number        // ∈ [0,1] solar availability
  hWind: number      // ∈ [0,1] wind availability
  gasOpCost: number  // M€/ktep operational cost
  oilOpCost: number
  gplOpCost: number
  condOpCost: number
}

export interface LShapedConfig {
  nScenarios: number
  maxIter: number
  tolerance: number   // gap threshold for convergence (e.g. 0.005 = 0.5%)
  lambdaD: number     // penalty for demand deficit (>> max op cost)
  enablePareto: boolean
  nParetoPoints: number
}

export const DEFAULT_CONFIG: LShapedConfig = {
  nScenarios: 5,
  maxIter: 20,
  tolerance: 0.005,
  lambdaD: 50,    // M€/ktep — >> max fossil op cost ~0.22; 50 avoids astronomical deficits
  enablePareto: false,
  nParetoPoints: 10,
}

// Initial installed capacities in ktep/year (max annual production potential)
export const INITIAL_CAPACITY: Record<Technology, number> = {
  'PV':         1_200,
  'Wind':         600,
  'Gaz':       32_000,
  'Pétrole':   12_000,
  'GPL':        4_000,
  'Condensat':  6_000,
  'Batterie':     200,
}

// CAPEX per period in M€/ktep (declining for renewables)
// Row = technology, column = period index (0‥4)
export const CAPEX_BY_PERIOD: Record<Technology, number[]> = {
  'PV':        [5.31, 4.15, 3.25, 2.54, 1.99],
  'Wind':      [6.37, 5.48, 4.71, 4.05, 3.48],
  'Gaz':       [1.09, 1.09, 1.09, 1.09, 1.09],
  'Pétrole':   [0.80, 0.80, 0.80, 0.80, 0.80],
  'GPL':       [0.70, 0.70, 0.70, 0.70, 0.70],
  'Condensat': [0.80, 0.80, 0.80, 0.80, 0.80],
  'Batterie':  [15.9, 10.8, 7.37, 5.02, 3.41],
}

// Base operational costs (M€/ktep) — stochastic costs are on top
export const BASE_OP_COST: Record<Technology, number> = {
  'PV':        0.054,
  'Wind':      0.076,
  'Gaz':       0.162,
  'Pétrole':   0.216,
  'GPL':       0.195,
  'Condensat': 0.206,
  'Batterie':  0.020,
}

// GHG emission factors (MtCO2/ktep)
export const EMISSION_FACTOR: Record<Technology, number> = {
  'PV':        0,
  'Wind':      0,
  'Gaz':       0.00235,
  'Pétrole':   0.00307,
  'GPL':       0.00265,
  'Condensat': 0.00295,
  'Batterie':  0,
}

// Discount factor for each period
export function discountFactor(year: number, r = 0.02): number {
  return 1 / Math.pow(1 + r, year - 2024)
}

// ──────────────────────────────────────────────────────────────────────────────
// Optimality cut: θ_ω ≥ alpha + Σ_{i,τ} beta[i][τ] · x_{i,τ}
export interface Cut {
  iteration: number
  scenarioIdx: number
  alpha: number
  beta: number[][]   // [N_TECH][nPeriods]
  active: boolean
}

// ──────────────────────────────────────────────────────────────────────────────
export interface SubproblemResult {
  scenarioIdx: number
  periods: {
    production: number[]   // [N_TECH] ktep dispatched
    deficit: number        // ktep unmet demand
    opCost: number         // M€ discounted
    shadowDemand: number   // dual of demand constraint (M€/ktep)
    shadowCap: number[]    // dual of capacity constraint per tech (M€/ktep)
    ghg: number            // MtCO2
  }[]
  totalOpCost: number
  totalGhg: number
  cut: Cut
}

export interface MasterSolution {
  deltaX: number[][]   // [N_TECH][nPeriods] new capacity added
  cumX: number[][]     // [N_TECH][nPeriods] cumulative capacity
  theta: number[]      // [nScenarios] value of future cost proxy
  investCost: number   // M€ discounted
  obj: number          // master objective (lower bound)
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
  epsilon: number  // GHG upper bound (MtCO2)
  Z1: number       // total cost (M€)
  Z2: number       // total GHG (MtCO2)
  solution: MasterSolution
}

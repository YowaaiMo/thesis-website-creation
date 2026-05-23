// Monte Carlo Simulation Engine for Energy Planning
// Based on the specifications from the cahier des charges

// ── Seeded PRNG (mulberry32) — section 4.9 / 7.1 ────────────────────────────
let _prng: (() => number) | null = null

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function setSimulationSeed(seed: number | null): void {
  _prng = seed !== null ? mulberry32(seed) : null
}

function rnd(): number { return _prng ? _prng() : Math.random() }

// ─────────────────────────────────────────────────────────────────────────────

export interface SimulationParams {
  numScenarios: number
  startYear: number
  endYear: number
  // Demand parameters
  demandVarianceMultiplier: number
  // Solar parameters
  solarAlpha: number
  solarBeta: number
  // Wind parameters
  windMean: number
  windStd: number
  // CAPEX PV parameters
  capexPvInitial: number
  capexPvMu: number
  capexPvSigma: number
  // Gas price parameters (GARCH)
  gasPriceInitial: number
  gasPriceMu: number
  garchOmega: number
  garchAlpha: number
  garchBeta: number
  // Fossil operational costs (DA/tep) — exact σ from spec section 5.8
  oilOpCostMean: number
  oilOpCostStd: number
  gplOpCostMean: number
  gplOpCostStd: number
  condensatOpCostMean: number
  condensatOpCostStd: number
  // Demand trend coefficients D̂_s,t = A·t² + B·t + C (t = t_stat = year−1980)
  // section 4.2.2 IMPORTANT: coefficients must be parameters, not hardcoded
  demandResA: number; demandResB: number; demandResC: number; demandResStd: number
  demandIndA: number; demandIndB: number; demandIndC: number; demandIndStd: number
  demandTraA: number; demandTraB: number; demandTraC: number; demandTraStd: number
  demandAgrB: number; demandAgrC: number; demandAgrStd: number  // linear (A=0)
  demandTerB: number; demandTerC: number; demandTerStd: number  // linear (A=0)
}

export interface SectorDemand {
  residential: number[]
  industrial: number[]
  transport: number[]
  agriculture: number[]
  tertiary: number[]
  total: number[]
}

export interface Scenario {
  id: number
  years: number[]
  demand: SectorDemand
  solarAvailability: number[]
  windAvailability: number[]
  capexPv: number[]
  gasPrice: number[]
  operationalCostGas: number[]
  operationalCostOil: number[]
  operationalCostGPL: number[]
  operationalCostCondensat: number[]
  fossilAvailability: number  // deterministic = 0.85 (section 5.5)
}

export interface SimulationResult {
  scenarios: Scenario[]
  statistics: Statistics
  extremeScenarios: ExtremeScenarios
  computationTime: number
}

export interface Statistics {
  demand: VariableStats
  solarAvailability: VariableStats
  windAvailability: VariableStats
  capexPv: VariableStats
  gasPrice: VariableStats
}

export interface VariableStats {
  mean: number[]
  std: number[]
  min: number[]
  max: number[]
  q5: number[]
  q25: number[]
  q50: number[]
  q75: number[]
  q95: number[]
}

export interface ExtremeScenarios {
  maxDemand: number
  minDemand: number
  maxGasPrice: number
  minCapexPv: number
  pessimistic: number
}

export interface DeterministicParams {
  batteryEfficiencyCharge: number    // ηc = 0.92
  batteryEfficiencyDischarge: number // ηd = 0.92
  emissionsTarget: number            // ENDC = 171.9 MtCO2eq
  discountRate: number               // δ = 0.02
  initialFossilProduction: number    // fossil0 = 120000 ktep
  bigM: number                       // BigM = 200000 ktep
  renewableTarget2024: number        // α = 0.10
  renewableTarget2030: number        // α = 0.27
  renewableTarget2050: number        // α = 0.40
  emissionFactorGas: number          // 2.35 tCO2/tep
  emissionFactorOil: number          // 3.07
  emissionFactorGPL: number          // 2.65
  emissionFactorCondensat: number    // 2.95
  techCostGas: number                // 15 USD/MWh
  techCostOil: number                // 20
  techCostGPL: number                // 18
  techCostCondensat: number          // 19
  techCostPV: number                 // 5
  techCostWind: number               // 7
}

export const DEFAULT_DETERMINISTIC_PARAMS: DeterministicParams = {
  batteryEfficiencyCharge: 0.92,
  batteryEfficiencyDischarge: 0.92,
  emissionsTarget: 171.9,
  discountRate: 0.02,
  initialFossilProduction: 120000,
  bigM: 200000,
  renewableTarget2024: 0.10,
  renewableTarget2030: 0.27,
  renewableTarget2050: 0.40,
  emissionFactorGas: 2.35,
  emissionFactorOil: 3.07,
  emissionFactorGPL: 2.65,
  emissionFactorCondensat: 2.95,
  techCostGas: 15,
  techCostOil: 20,
  techCostGPL: 18,
  techCostCondensat: 19,
  techCostPV: 5,
  techCostWind: 7,
}

// Default parameters based on cahier des charges
export const DEFAULT_PARAMS: SimulationParams = {
  numScenarios: 20,
  startYear: 2024,
  endYear: 2050,
  demandVarianceMultiplier: 1.0,
  solarAlpha: 5.76,
  solarBeta: 3.84,
  windMean: 0.296,
  windStd: 0.035,
  capexPvInitial: 800,
  capexPvMu: -0.05,
  capexPvSigma: 0.10,
  gasPriceInitial: 4.5,
  gasPriceMu: 0.02,
  garchOmega: 0.0002,
  garchAlpha: 0.10,
  garchBeta: 0.85,
  oilOpCostMean: 48846,  oilOpCostStd: 2442,
  gplOpCostMean: 44194,  gplOpCostStd: 2210,
  condensatOpCostMean: 46520, condensatOpCostStd: 2326,
  // Demand trend coefficients — section 5.2
  demandResA: 2.97,   demandResB: 218.55,  demandResC: 3614.88, demandResStd: 1330,
  demandIndA: 7.37,   demandIndB: -108.43, demandIndC: 4045.29, demandIndStd: 488,
  demandTraA: 8.92,   demandTraB: -51.88,  demandTraC: 3291.95, demandTraStd: 1408,
  demandAgrB: 40.77,  demandAgrC: -1003.81, demandAgrStd: 102,
  demandTerB: 142.29, demandTerC: -801.03,  demandTerStd: 230,
}

// Standard normal random number generator (Box-Muller transform)
function randn(): number {
  let u = 0, v = 0
  while (u === 0) u = rnd()
  while (v === 0) v = rnd()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// Beta distribution random number generator
function betaRandom(alpha: number, beta: number): number {
  const gammaAlpha = gammaRandom(alpha)
  const gammaBeta = gammaRandom(beta)
  return gammaAlpha / (gammaAlpha + gammaBeta)
}

// Gamma distribution random number generator (Marsaglia and Tsang's method)
function gammaRandom(shape: number): number {
  if (shape < 1) {
    return gammaRandom(1 + shape) * Math.pow(rnd(), 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  let x: number, v: number
  do {
    do {
      x = randn()
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rnd()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  } while (true)
}

// Truncated normal distribution
function truncatedNormal(mean: number, std: number, min: number, max: number): number {
  let value: number
  do {
    value = mean + std * randn()
  } while (value < min || value > max)
  return value
}

// Cholesky decomposition for correlated demand
function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length
  const L: number[][] = Array(n).fill(null).map(() => Array(n).fill(0))
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k]
      }
      if (i === j) {
        L[i][j] = Math.sqrt(matrix[i][i] - sum)
      } else {
        L[i][j] = (matrix[i][j] - sum) / L[j][j]
      }
    }
  }
  return L
}

// Demand trend helper (t_stat = year − 1980 = t_mod + 43, section 5.1)
function demandTrend(A: number, B: number, C: number, tStat: number): number {
  return A * tStat * tStat + B * tStat + C
}

// Generate a single scenario
function generateScenario(id: number, params: SimulationParams): Scenario {
  const numYears = params.endYear - params.startYear + 1
  const years: number[] = []
  for (let year = params.startYear; year <= params.endYear; year++) years.push(year)

  // Demand std with variance multiplier (section 5.2)
  const stdRes = params.demandResStd * params.demandVarianceMultiplier
  const stdInd = params.demandIndStd * params.demandVarianceMultiplier
  const stdTra = params.demandTraStd * params.demandVarianceMultiplier
  const stdAgr = params.demandAgrStd * params.demandVarianceMultiplier
  const stdTer = params.demandTerStd * params.demandVarianceMultiplier

  // Correlation matrix Rε — Res, Ind, Tra (section 5.2)
  const correlationMatrix = [[1.0, 0.188, -0.662], [0.188, 1.0, 0.052], [-0.662, 0.052, 1.0]]
  const stds = [stdRes, stdInd, stdTra]
  const covMatrix = correlationMatrix.map((row, i) => row.map((val, j) => val * stds[i] * stds[j]))
  const L = choleskyDecomposition(covMatrix)

  const residential: number[] = [], industrial: number[] = [], transport: number[] = []
  const agriculture: number[] = [], tertiary: number[] = [], total: number[] = []

  for (let i = 0; i < numYears; i++) {
    const tStat = params.startYear + i - 1980  // t_stat = year − 1980 (section 5.1)
    const z = [randn(), randn(), randn()]
    const ce = [
      L[0][0]*z[0],
      L[1][0]*z[0] + L[1][1]*z[1],
      L[2][0]*z[0] + L[2][1]*z[1] + L[2][2]*z[2]
    ]
    const resVal = Math.max(0, demandTrend(params.demandResA, params.demandResB, params.demandResC, tStat) + ce[0])
    const indVal = Math.max(0, demandTrend(params.demandIndA, params.demandIndB, params.demandIndC, tStat) + ce[1])
    const traVal = Math.max(0, demandTrend(params.demandTraA, params.demandTraB, params.demandTraC, tStat) + ce[2])
    const agrVal = Math.max(0, demandTrend(0, params.demandAgrB, params.demandAgrC, tStat) + stdAgr * randn())
    const terVal = Math.max(0, demandTrend(0, params.demandTerB, params.demandTerC, tStat) + stdTer * randn())
    residential.push(resVal); industrial.push(indVal); transport.push(traVal)
    agriculture.push(agrVal); tertiary.push(terVal)
    total.push(resVal + indVal + traVal + agrVal + terVal)
  }
  
  // Solar availability (Beta distribution)
  const solarAvailability: number[] = []
  for (let i = 0; i < numYears; i++) {
    solarAvailability.push(betaRandom(params.solarAlpha, params.solarBeta))
  }
  
  // Wind availability (Truncated normal)
  const windAvailability: number[] = []
  for (let i = 0; i < numYears; i++) {
    windAvailability.push(truncatedNormal(params.windMean, params.windStd, 0, 1))
  }
  
  // CAPEX PV (Geometric Brownian Motion)
  const capexPv: number[] = [params.capexPvInitial]
  for (let i = 1; i < numYears; i++) {
    const drift = params.capexPvMu - (params.capexPvSigma * params.capexPvSigma) / 2
    const shock = params.capexPvSigma * randn()
    const newCapex = capexPv[i - 1] * Math.exp(drift + shock)
    capexPv.push(Math.max(0.01, newCapex)) // Ensure positive
  }
  
  // Gas price (GARCH(1,1))
  const gasPrice: number[] = [params.gasPriceInitial]
  const sigma2_0 = params.garchOmega / (1 - params.garchAlpha - params.garchBeta)
  let sigma2 = sigma2_0
  let epsilon = 0
  
  for (let i = 1; i < numYears; i++) {
    sigma2 = params.garchOmega + params.garchAlpha * epsilon * epsilon + params.garchBeta * sigma2
    const z = randn()
    epsilon = Math.sqrt(sigma2) * z
    const newPrice = gasPrice[i - 1] * Math.exp(params.gasPriceMu + epsilon)
    gasPrice.push(Math.max(0.1, newPrice)) // Ensure positive
  }
  
  // Operational cost for gas (gas price + technical cost)
  const operationalCostGas = gasPrice.map(price => price + DEFAULT_DETERMINISTIC_PARAMS.techCostGas)

  // Fossil op costs N(mean, σ²) DA/tep — absolute σ per section 5.8
  const operationalCostOil: number[] = []
  const operationalCostGPL: number[] = []
  const operationalCostCondensat: number[] = []
  for (let i = 0; i < numYears; i++) {
    operationalCostOil.push(Math.max(0, params.oilOpCostMean + params.oilOpCostStd * randn()))
    operationalCostGPL.push(Math.max(0, params.gplOpCostMean + params.gplOpCostStd * randn()))
    operationalCostCondensat.push(Math.max(0, params.condensatOpCostMean + params.condensatOpCostStd * randn()))
  }

  return {
    id, years,
    demand: { residential, industrial, transport, agriculture, tertiary, total },
    solarAvailability, windAvailability, capexPv, gasPrice, operationalCostGas,
    operationalCostOil, operationalCostGPL, operationalCostCondensat,
    fossilAvailability: 0.85,  // deterministic, section 5.5
  }
}

// Calculate statistics — quantiles 5%, 25%, 50%, 75%, 95% (section 7.7)
function calculateStats(scenarios: Scenario[], getValue: (s: Scenario, i: number) => number): VariableStats {
  const numYears = scenarios[0].years.length
  const S = scenarios.length
  const mean: number[] = [], std: number[] = [], min: number[] = [], max: number[] = []
  const q5: number[] = [], q25: number[] = [], q50: number[] = [], q75: number[] = [], q95: number[] = []

  for (let i = 0; i < numYears; i++) {
    const vals = scenarios.map(s => getValue(s, i)).sort((a, b) => a - b)
    const avg = vals.reduce((a, b) => a + b, 0) / S
    mean.push(avg)
    std.push(Math.sqrt(vals.reduce((acc, v) => acc + (v - avg) ** 2, 0) / S))
    min.push(vals[0])
    max.push(vals[S - 1])
    q5.push(vals[Math.floor(S * 0.05)])
    q25.push(vals[Math.floor(S * 0.25)])
    q50.push(vals[Math.floor(S * 0.50)])
    q75.push(vals[Math.floor(S * 0.75)])
    q95.push(vals[Math.floor(S * 0.95)])
  }
  return { mean, std, min, max, q5, q25, q50, q75, q95 }
}

// Find extreme scenarios
function findExtremeScenarios(scenarios: Scenario[]): ExtremeScenarios {
  let maxDemandIdx = 0
  let minDemandIdx = 0
  let maxGasPriceIdx = 0
  let minCapexPvIdx = 0
  
  let maxDemandVal = -Infinity
  let minDemandVal = Infinity
  let maxGasPriceVal = -Infinity
  let minCapexPvVal = Infinity
  
  scenarios.forEach((s, idx) => {
    const totalDemand = s.demand.total.reduce((a, b) => a + b, 0)
    const avgGasPrice = s.gasPrice.reduce((a, b) => a + b, 0) / s.gasPrice.length
    const finalCapexPv = s.capexPv[s.capexPv.length - 1]
    
    if (totalDemand > maxDemandVal) {
      maxDemandVal = totalDemand
      maxDemandIdx = idx
    }
    if (totalDemand < minDemandVal) {
      minDemandVal = totalDemand
      minDemandIdx = idx
    }
    if (avgGasPrice > maxGasPriceVal) {
      maxGasPriceVal = avgGasPrice
      maxGasPriceIdx = idx
    }
    if (finalCapexPv < minCapexPvVal) {
      minCapexPvVal = finalCapexPv
      minCapexPvIdx = idx
    }
  })
  
  // Pessimistic scenario: high demand + high gas price + low solar availability
  let pessimisticIdx = 0
  let pessimisticScore = -Infinity
  
  scenarios.forEach((s, idx) => {
    const totalDemand = s.demand.total.reduce((a, b) => a + b, 0) / s.demand.total.length
    const avgGasPrice = s.gasPrice.reduce((a, b) => a + b, 0) / s.gasPrice.length
    const avgSolar = s.solarAvailability.reduce((a, b) => a + b, 0) / s.solarAvailability.length
    
    // Normalize and combine (higher score = more pessimistic)
    const score = totalDemand / 50000 + avgGasPrice / 10 - avgSolar * 5
    
    if (score > pessimisticScore) {
      pessimisticScore = score
      pessimisticIdx = idx
    }
  })
  
  return {
    maxDemand: maxDemandIdx,
    minDemand: minDemandIdx,
    maxGasPrice: maxGasPriceIdx,
    minCapexPv: minCapexPvIdx,
    pessimistic: pessimisticIdx
  }
}

// Main simulation function
export function runSimulation(params: SimulationParams): SimulationResult {
  const startTime = performance.now()
  
  // Generate all scenarios
  const scenarios: Scenario[] = []
  for (let i = 0; i < params.numScenarios; i++) {
    scenarios.push(generateScenario(i, params))
  }
  
  // Calculate statistics
  const statistics: Statistics = {
    demand: calculateStats(scenarios, (s, i) => s.demand.total[i]),
    solarAvailability: calculateStats(scenarios, (s, i) => s.solarAvailability[i]),
    windAvailability: calculateStats(scenarios, (s, i) => s.windAvailability[i]),
    capexPv: calculateStats(scenarios, (s, i) => s.capexPv[i]),
    gasPrice: calculateStats(scenarios, (s, i) => s.gasPrice[i])
  }
  
  // Find extreme scenarios
  const extremeScenarios = findExtremeScenarios(scenarios)
  
  const endTime = performance.now()
  
  return {
    scenarios,
    statistics,
    extremeScenarios,
    computationTime: endTime - startTime
  }
}

// Export to CSV format
export function exportToCSV(result: SimulationResult): string {
  const headers = ['scenario', 'year', 'demand_total', 'demand_residential', 'demand_industrial',
    'demand_transport', 'demand_agriculture', 'demand_tertiary', 'h_PV', 'h_Wind', 'capex_PV',
    'gas_price', 'op_cost_gas', 'op_cost_oil_DA_tep', 'op_cost_gpl_DA_tep', 'op_cost_cond_DA_tep']

  const rows = [headers.join(',')]

  result.scenarios.forEach(scenario => {
    scenario.years.forEach((year, i) => {
      const row = [
        scenario.id,
        year,
        scenario.demand.total[i].toFixed(2),
        scenario.demand.residential[i].toFixed(2),
        scenario.demand.industrial[i].toFixed(2),
        scenario.demand.transport[i].toFixed(2),
        scenario.demand.agriculture[i].toFixed(2),
        scenario.demand.tertiary[i].toFixed(2),
        scenario.solarAvailability[i].toFixed(4),
        scenario.windAvailability[i].toFixed(4),
        scenario.capexPv[i].toFixed(2),
        scenario.gasPrice[i].toFixed(2),
        scenario.operationalCostGas[i].toFixed(2),
        scenario.operationalCostOil[i].toFixed(0),
        scenario.operationalCostGPL[i].toFixed(0),
        scenario.operationalCostCondensat[i].toFixed(0),
      ]
      rows.push(row.join(','))
    })
  })
  
  return rows.join('\n')
}

// Export to JSON format
export function exportToJSON(result: SimulationResult): string {
  return JSON.stringify({
    metadata: {
      numScenarios: result.scenarios.length,
      years: result.scenarios[0].years,
      computationTime: result.computationTime
    },
    scenarios: result.scenarios,
    statistics: result.statistics,
    extremeScenarios: result.extremeScenarios
  }, null, 2)
}

// ============================================================
// LHS (Latin Hypercube Sampling) Engine
// ============================================================

// Generate n stratified uniform samples in [0,1], shuffled
function lhsUniform(n: number): number[] {
  const samples = Array.from({ length: n }, (_, k) => (k + rnd()) / n)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[samples[i], samples[j]] = [samples[j], samples[i]]
  }
  return samples
}

// Standard normal inverse CDF (Acklam's rational approximation)
function normalInverseCDF(p: number): number {
  if (p <= 0) return -8
  if (p >= 1) return 8
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
              1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
              6.680131188771972e+01, -1.328068155288572e+01]
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
              -2.549732539343734e+00,  4.374664141464968e+00,  2.938163982698783e+00]
  const d = [ 7.784695709041462e-03,  3.224671290700398e-01,  2.445134137142996e+00,
               3.754408661907416e+00]
  const pLow = 0.02425, pHigh = 1 - pLow
  let q: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
  } else if (p <= pHigh) {
    q = p - 0.5
    const r = q * q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
             ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
  }
}

// Standard normal CDF approximation
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const d = Math.exp(-0.5 * x * x) * poly / Math.sqrt(2 * Math.PI)
  return x >= 0 ? 1 - d : d
}

// Log-gamma (Lanczos approximation)
function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  x -= 1
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
              -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
               1.5056327351493116e-7]
  let sum = c[0]
  for (let i = 1; i <= 8; i++) sum += c[i] / (x + i)
  const t = x + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum)
}

// Regularized incomplete beta function I_x(a,b) — continued fraction method
function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  if (x > (a + 1) / (a + b + 2)) return 1 - regularizedBeta(1 - x, b, a)
  const lbeta_ab = lgamma(a) + lgamma(b) - lgamma(a + b)
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta_ab)
  let qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - qab * x / qap
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d; let h = d
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d; h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d; const del = d * c; h *= del
    if (Math.abs(del - 1) < 1e-8) break
  }
  return front * h / a
}

// Beta inverse CDF via bisection
function betaInverseCDF(p: number, alpha: number, betaParam: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  let lo = 0, hi = 1
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (regularizedBeta(mid, alpha, betaParam) < p) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

// LHS samples from standard normal
function lhsNormal(n: number): number[] {
  return lhsUniform(n).map(u => normalInverseCDF(u))
}

// LHS samples from Beta(alpha, beta)
function lhsBetaDist(n: number, alpha: number, betaParam: number): number[] {
  return lhsUniform(n).map(u => betaInverseCDF(u, alpha, betaParam))
}

// LHS samples from truncated normal N[lo,hi](mu, sigma)
function lhsTruncatedNormal(n: number, mu: number, sigma: number, lo: number, hi: number): number[] {
  const phiLo = normalCDF((lo - mu) / sigma)
  const phiHi = normalCDF((hi - mu) / sigma)
  return lhsUniform(n).map(u => {
    const p = phiLo + u * (phiHi - phiLo)
    return mu + sigma * normalInverseCDF(Math.max(1e-10, Math.min(1 - 1e-10, p)))
  })
}

// Main LHS simulation function
export function runLHSSimulation(params: SimulationParams): SimulationResult {
  const startTime = performance.now()
  const numYears = params.endYear - params.startYear + 1
  const S = params.numScenarios

  // Demand standard deviations
  const stdRes = params.demandResStd * params.demandVarianceMultiplier
  const stdInd = params.demandIndStd * params.demandVarianceMultiplier
  const stdTra = params.demandTraStd * params.demandVarianceMultiplier
  const stdAgr = params.demandAgrStd * params.demandVarianceMultiplier
  const stdTer = params.demandTerStd * params.demandVarianceMultiplier

  // Cholesky for correlated demand (same matrix as MC)
  const corrMatrix = [[1.0, 0.188, -0.662], [0.188, 1.0, 0.052], [-0.662, 0.052, 1.0]]
  const stds3 = [stdRes, stdInd, stdTra]
  const covMatrix = corrMatrix.map((row, i) => row.map((val, j) => val * stds3[i] * stds3[j]))
  const L = choleskyDecomposition(covMatrix)

  // Pre-generate LHS samples for every (year, scenario) pair
  // Each array is [numYears][S]
  const lhsZ1  = Array.from({ length: numYears }, () => lhsNormal(S))  // for Res/Ind/Tra z1
  const lhsZ2  = Array.from({ length: numYears }, () => lhsNormal(S))  // z2
  const lhsZ3  = Array.from({ length: numYears }, () => lhsNormal(S))  // z3
  const lhsZ4  = Array.from({ length: numYears }, () => lhsNormal(S))  // Agr
  const lhsZ5  = Array.from({ length: numYears }, () => lhsNormal(S))  // Ter
  const lhsSol = Array.from({ length: numYears }, () => lhsBetaDist(S, params.solarAlpha, params.solarBeta))
  const lhsWnd = Array.from({ length: numYears }, () => lhsTruncatedNormal(S, params.windMean, params.windStd, 0, 1))
  // GBM / GARCH shocks: one shock per year-step per scenario [numYears-1][S]
  const lhsCapex = Array.from({ length: numYears - 1 }, () => lhsNormal(S))
  const lhsGas   = Array.from({ length: numYears - 1 }, () => lhsNormal(S))
  const lhsOil   = Array.from({ length: numYears }, () => lhsNormal(S))
  const lhsGPL   = Array.from({ length: numYears }, () => lhsNormal(S))
  const lhsCond  = Array.from({ length: numYears }, () => lhsNormal(S))

  const years = Array.from({ length: numYears }, (_, i) => params.startYear + i)
  const scenarios: Scenario[] = []

  for (let s = 0; s < S; s++) {
    const residential: number[] = [], industrial: number[] = [], transport: number[] = []
    const agriculture: number[] = [], tertiary: number[] = [], total: number[] = []
    const solarAvailability: number[] = [], windAvailability: number[] = []

    for (let yi = 0; yi < numYears; yi++) {
      const tStat = params.startYear + yi - 1980
      // Correlated demand errors via Cholesky applied to LHS normals
      const z = [lhsZ1[yi][s], lhsZ2[yi][s], lhsZ3[yi][s]]
      const ce = [
        L[0][0]*z[0],
        L[1][0]*z[0] + L[1][1]*z[1],
        L[2][0]*z[0] + L[2][1]*z[1] + L[2][2]*z[2]
      ]
      const resVal = Math.max(0, demandTrend(params.demandResA, params.demandResB, params.demandResC, tStat) + ce[0])
      const indVal = Math.max(0, demandTrend(params.demandIndA, params.demandIndB, params.demandIndC, tStat) + ce[1])
      const traVal = Math.max(0, demandTrend(params.demandTraA, params.demandTraB, params.demandTraC, tStat) + ce[2])
      const agrVal = Math.max(0, demandTrend(0, params.demandAgrB, params.demandAgrC, tStat) + stdAgr * lhsZ4[yi][s])
      const terVal = Math.max(0, demandTrend(0, params.demandTerB, params.demandTerC, tStat) + stdTer * lhsZ5[yi][s])
      residential.push(resVal); industrial.push(indVal); transport.push(traVal)
      agriculture.push(agrVal); tertiary.push(terVal)
      total.push(resVal + indVal + traVal + agrVal + terVal)
      solarAvailability.push(lhsSol[yi][s])
      windAvailability.push(lhsWnd[yi][s])
    }

    // GBM for CAPEX PV
    const capexPv: number[] = [params.capexPvInitial]
    for (let yi = 1; yi < numYears; yi++) {
      const drift = params.capexPvMu - (params.capexPvSigma ** 2) / 2
      capexPv.push(Math.max(0.01, capexPv[yi - 1] * Math.exp(drift + params.capexPvSigma * lhsCapex[yi - 1][s])))
    }

    // GARCH(1,1) for gas price
    const gasPrice: number[] = [params.gasPriceInitial]
    let sigma2 = params.garchOmega / (1 - params.garchAlpha - params.garchBeta)
    let epsilon = 0
    for (let yi = 1; yi < numYears; yi++) {
      sigma2 = params.garchOmega + params.garchAlpha * epsilon * epsilon + params.garchBeta * sigma2
      epsilon = Math.sqrt(sigma2) * lhsGas[yi - 1][s]
      gasPrice.push(Math.max(0.1, gasPrice[yi - 1] * Math.exp(params.gasPriceMu + epsilon)))
    }

    const operationalCostGas = gasPrice.map(p => p + DEFAULT_DETERMINISTIC_PARAMS.techCostGas)
    const operationalCostOil = Array.from({ length: numYears }, (_, yi) =>
      Math.max(0, params.oilOpCostMean + params.oilOpCostStd * lhsOil[yi][s]))
    const operationalCostGPL = Array.from({ length: numYears }, (_, yi) =>
      Math.max(0, params.gplOpCostMean + params.gplOpCostStd * lhsGPL[yi][s]))
    const operationalCostCondensat = Array.from({ length: numYears }, (_, yi) =>
      Math.max(0, params.condensatOpCostMean + params.condensatOpCostStd * lhsCond[yi][s]))
    scenarios.push({
      id: s, years,
      demand: { residential, industrial, transport, agriculture, tertiary, total },
      solarAvailability, windAvailability, capexPv, gasPrice,
      operationalCostGas, operationalCostOil, operationalCostGPL, operationalCostCondensat,
      fossilAvailability: 0.85,
    })
  }

  const statistics: Statistics = {
    demand:            calculateStats(scenarios, (sc, i) => sc.demand.total[i]),
    solarAvailability: calculateStats(scenarios, (sc, i) => sc.solarAvailability[i]),
    windAvailability:  calculateStats(scenarios, (sc, i) => sc.windAvailability[i]),
    capexPv:           calculateStats(scenarios, (sc, i) => sc.capexPv[i]),
    gasPrice:          calculateStats(scenarios, (sc, i) => sc.gasPrice[i])
  }
  const extremeScenarios = findExtremeScenarios(scenarios)
  const endTime = performance.now()
  return { scenarios, statistics, extremeScenarios, computationTime: endTime - startTime }
}

// MC vs LHS comparison metrics for a given year index
export interface MethodComparison {
  variable: string
  unit: string
  mcMean: number[]
  lhsMean: number[]
  mcStd: number[]
  lhsStd: number[]
  mcQ5: number[]
  lhsQ5: number[]
  mcQ95: number[]
  lhsQ95: number[]
  years: number[]
}

export function buildComparison(
  mc: SimulationResult,
  lhs: SimulationResult,
  key: keyof Statistics,
  label: string,
  unit: string
): MethodComparison {
  const years = mc.scenarios[0].years
  return {
    variable: label,
    unit,
    mcMean:  mc.statistics[key].mean,
    lhsMean: lhs.statistics[key].mean,
    mcStd:   mc.statistics[key].std,
    lhsStd:  lhs.statistics[key].std,
    mcQ5:    mc.statistics[key].q5,
    lhsQ5:   lhs.statistics[key].q5,
    mcQ95:   mc.statistics[key].q95,
    lhsQ95:  lhs.statistics[key].q95,
    years,
  }
}

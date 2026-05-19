// Monte Carlo Simulation Engine for Energy Planning
// Based on the specifications from the cahier des charges

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
  q95: number[]
}

export interface ExtremeScenarios {
  maxDemand: number
  minDemand: number
  maxGasPrice: number
  minCapexPv: number
  pessimistic: number
}

// Default parameters based on cahier des charges
export const DEFAULT_PARAMS: SimulationParams = {
  numScenarios: 300,
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
}

// Standard normal random number generator (Box-Muller transform)
function randn(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// Beta distribution random number generator
function betaRandom(alpha: number, beta: number): number {
  // Using gamma distribution to generate beta
  const gammaAlpha = gammaRandom(alpha)
  const gammaBeta = gammaRandom(beta)
  return gammaAlpha / (gammaAlpha + gammaBeta)
}

// Gamma distribution random number generator (Marsaglia and Tsang's method)
function gammaRandom(shape: number): number {
  if (shape < 1) {
    return gammaRandom(1 + shape) * Math.pow(Math.random(), 1 / shape)
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
    const u = Math.random()
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

// Demand trend functions (based on cahier des charges equations)
function demandTrendResidential(t: number): number {
  return 2.97 * t * t + 218.55 * t + 3614.88
}

function demandTrendIndustrial(t: number): number {
  return 7.37 * t * t - 108.43 * t + 4045.29
}

function demandTrendTransport(t: number): number {
  return 8.92 * t * t - 51.88 * t + 3291.95
}

function demandTrendAgriculture(t: number): number {
  return 40.77 * t - 1003.81
}

function demandTrendTertiary(t: number): number {
  return 142.29 * t - 801.03
}

// Generate a single scenario
function generateScenario(id: number, params: SimulationParams): Scenario {
  const numYears = params.endYear - params.startYear + 1
  const years: number[] = []
  
  for (let year = params.startYear; year <= params.endYear; year++) {
    years.push(year)
  }
  
  // Demand standard deviations (from cahier des charges)
  const stdResidential = 1330 * params.demandVarianceMultiplier
  const stdIndustrial = 488 * params.demandVarianceMultiplier
  const stdTransport = 1408 * params.demandVarianceMultiplier
  const stdAgriculture = 102 * params.demandVarianceMultiplier
  const stdTertiary = 230 * params.demandVarianceMultiplier
  
  // Correlation matrix for main sectors (Res, Ind, Tra)
  const correlationMatrix = [
    [1.0, 0.7, 0.5],
    [0.7, 1.0, 0.6],
    [0.5, 0.6, 1.0]
  ]
  
  // Scale to covariance matrix
  const stds = [stdResidential, stdIndustrial, stdTransport]
  const covMatrix = correlationMatrix.map((row, i) => 
    row.map((val, j) => val * stds[i] * stds[j])
  )
  
  // Cholesky decomposition
  const L = choleskyDecomposition(covMatrix)
  
  // Generate demands
  const residential: number[] = []
  const industrial: number[] = []
  const transport: number[] = []
  const agriculture: number[] = []
  const tertiary: number[] = []
  const total: number[] = []
  
  for (let i = 0; i < numYears; i++) {
    const t = i // t starts at 0 for 2024
    
    // Generate correlated errors for main sectors
    const z = [randn(), randn(), randn()]
    const correlatedErrors = [
      L[0][0] * z[0],
      L[1][0] * z[0] + L[1][1] * z[1],
      L[2][0] * z[0] + L[2][1] * z[1] + L[2][2] * z[2]
    ]
    
    // Calculate demands with trend + error
    const resVal = Math.max(0, demandTrendResidential(t) + correlatedErrors[0])
    const indVal = Math.max(0, demandTrendIndustrial(t) + correlatedErrors[1])
    const traVal = Math.max(0, demandTrendTransport(t) + correlatedErrors[2])
    const agrVal = Math.max(0, demandTrendAgriculture(t) + stdAgriculture * randn())
    const terVal = Math.max(0, demandTrendTertiary(t) + stdTertiary * randn())
    
    residential.push(resVal)
    industrial.push(indVal)
    transport.push(traVal)
    agriculture.push(agrVal)
    tertiary.push(terVal)
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
  const techCostGas = 15 // Base technical operational cost
  const operationalCostGas = gasPrice.map(price => price + techCostGas)
  
  return {
    id,
    years,
    demand: {
      residential,
      industrial,
      transport,
      agriculture,
      tertiary,
      total
    },
    solarAvailability,
    windAvailability,
    capexPv,
    gasPrice,
    operationalCostGas
  }
}

// Calculate statistics for a variable across all scenarios
function calculateStats(scenarios: Scenario[], getValue: (s: Scenario, i: number) => number): VariableStats {
  const numYears = scenarios[0].years.length
  const numScenarios = scenarios.length
  
  const mean: number[] = []
  const std: number[] = []
  const min: number[] = []
  const max: number[] = []
  const q5: number[] = []
  const q95: number[] = []
  
  for (let i = 0; i < numYears; i++) {
    const values = scenarios.map(s => getValue(s, i)).sort((a, b) => a - b)
    
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / numScenarios
    mean.push(avg)
    
    const variance = values.reduce((acc, val) => acc + (val - avg) ** 2, 0) / numScenarios
    std.push(Math.sqrt(variance))
    
    min.push(values[0])
    max.push(values[numScenarios - 1])
    q5.push(values[Math.floor(numScenarios * 0.05)])
    q95.push(values[Math.floor(numScenarios * 0.95)])
  }
  
  return { mean, std, min, max, q5, q95 }
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
    'demand_transport', 'demand_agriculture', 'demand_tertiary', 'h_PV', 'h_Wind', 'capex_PV', 'gas_price', 'op_cost_gas']
  
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
        scenario.operationalCostGas[i].toFixed(2)
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

import { auditLogger } from './compliance'

export interface DataPoint {
  label: string
  value: number
  timestamp?: number
  metadata?: Record<string, unknown>
}

export interface DataSeries {
  name: string
  data: DataPoint[]
  type?: 'line' | 'bar' | 'scatter'
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable'
  slope: number
  r2: number
  confidence: number
  prediction: number[]
  seasonality: SeasonalityResult | null
}

export interface SeasonalityResult {
  period: number
  strength: number
  peaks: number[]
  troughs: number[]
}

export interface StatisticalSummary {
  count: number
  sum: number
  mean: number
  median: number
  mode: number | null
  stdDev: number
  variance: number
  min: number
  max: number
  range: number
  quartiles: {
    q1: number
    q2: number
    q3: number
  }
  skewness: number
  kurtosis: number
}

export interface CorrelationResult {
  coefficient: number
  strength: 'none' | 'weak' | 'moderate' | 'strong' | 'very_strong'
  direction: 'positive' | 'negative' | 'none'
  pValue: number
  significant: boolean
}

export interface RegressionResult {
  type: 'linear' | 'polynomial' | 'exponential' | 'logarithmic'
  equation: string
  coefficients: number[]
  r2: number
  rmse: number
  predictions: number[]
}

export interface AnomalyDetection {
  anomalies: Anomaly[]
  threshold: number
  method: 'zscore' | 'iqr' | 'isolation'
}

export interface Anomaly {
  index: number
  value: number
  expectedValue: number
  deviation: number
  severity: 'low' | 'medium' | 'high'
}

export interface ForecastResult {
  values: number[]
  confidence: {
    lower: number[]
    upper: number[]
  }
  accuracy: number
  method: 'moving_average' | 'exponential_smoothing' | 'arima' | 'prophet'
}

export interface ClusterResult {
  clusters: Cluster[]
  silhouetteScore: number
  optimalK: number
}

export interface Cluster {
  id: number
  center: number[]
  members: number[]
  size: number
}

export interface DataAnalysisResult {
  summary: StatisticalSummary
  trends: TrendAnalysis | null
  correlations: CorrelationResult[]
  anomalies: AnomalyDetection | null
  forecast: ForecastResult | null
  insights: string[]
  recommendations: string[]
}

export class EnhancedDataAnalyzer {
  private static instance: EnhancedDataAnalyzer

  private constructor() {}

  static getInstance(): EnhancedDataAnalyzer {
    if (!EnhancedDataAnalyzer.instance) {
      EnhancedDataAnalyzer.instance = new EnhancedDataAnalyzer()
    }
    return EnhancedDataAnalyzer.instance
  }

  analyze(data: number[], options?: {
    detectAnomalies?: boolean
    forecast?: boolean
    forecastPeriods?: number
  }): DataAnalysisResult {
    const summary = this.calculateStatistics(data)
    const trends = this.analyzeTrend(data)
    const correlations: CorrelationResult[] = []
    const anomalies = options?.detectAnomalies ? this.detectAnomalies(data) : null
    const forecast = options?.forecast ? this.forecast(data, options?.forecastPeriods || 5) : null
    
    const insights = this.generateInsights(summary, trends, anomalies)
    const recommendations = this.generateRecommendations(summary, trends, anomalies)

    auditLogger.createAuditLog(
      { dataPoints: data.length },
      [{
        step: 1,
        operation: 'data_analysis',
        method: 'statistical_analysis',
        input: { count: data.length },
        output: { mean: summary.mean, stdDev: summary.stdDev },
        evidence: `trend: ${trends?.direction || 'none'}`
      }],
      { success: true }
    )

    return {
      summary,
      trends,
      correlations,
      anomalies,
      forecast,
      insights,
      recommendations
    }
  }

  analyzeSeries(series: DataSeries[]): DataAnalysisResult & { crossCorrelations: CorrelationResult[] } {
    if (series.length === 0) {
      throw new Error('At least one data series is required')
    }

    const primaryData = series[0].data.map(d => d.value)
    const baseResult = this.analyze(primaryData, { detectAnomalies: true })
    
    const crossCorrelations: CorrelationResult[] = []
    
    if (series.length > 1) {
      for (let i = 1; i < series.length; i++) {
        const otherData = series[i].data.map(d => d.value)
        if (otherData.length === primaryData.length) {
          crossCorrelations.push(this.calculateCorrelation(primaryData, otherData))
        }
      }
    }

    return { ...baseResult, crossCorrelations }
  }

  calculateStatistics(data: number[]): StatisticalSummary {
    const n = data.length
    if (n === 0) {
      return this.getEmptySummary()
    }

    const sorted = [...data].sort((a, b) => a - b)
    const sum = data.reduce((a, b) => a + b, 0)
    const mean = sum / n
    
    const median = this.calculatePercentile(sorted, 50)
    const q1 = this.calculatePercentile(sorted, 25)
    const q3 = this.calculatePercentile(sorted, 75)
    
    const mode = this.calculateMode(data)
    
    const squaredDiffs = data.map(x => Math.pow(x - mean, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n
    const stdDev = Math.sqrt(variance)
    
    const min = sorted[0]
    const max = sorted[n - 1]
    const range = max - min
    
    const skewness = this.calculateSkewness(data, mean, stdDev)
    const kurtosis = this.calculateKurtosis(data, mean, stdDev)

    return {
      count: n,
      sum,
      mean,
      median,
      mode,
      stdDev,
      variance,
      min,
      max,
      range,
      quartiles: { q1, q2: median, q3 },
      skewness,
      kurtosis
    }
  }

  private getEmptySummary(): StatisticalSummary {
    return {
      count: 0,
      sum: 0,
      mean: 0,
      median: 0,
      mode: null,
      stdDev: 0,
      variance: 0,
      min: 0,
      max: 0,
      range: 0,
      quartiles: { q1: 0, q2: 0, q3: 0 },
      skewness: 0,
      kurtosis: 0
    }
  }

  private calculatePercentile(sorted: number[], percentile: number): number {
    const index = (percentile / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    
    if (lower === upper) return sorted[lower]
    
    const weight = index - lower
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }

  private calculateMode(data: number[]): number | null {
    const frequency: Map<number, number> = new Map()
    
    for (const value of data) {
      frequency.set(value, (frequency.get(value) || 0) + 1)
    }
    
    let maxFreq = 0
    let mode: number | null = null
    
    for (const [value, freq] of frequency) {
      if (freq > maxFreq) {
        maxFreq = freq
        mode = value
      }
    }
    
    return maxFreq > 1 ? mode : null
  }

  private calculateSkewness(data: number[], mean: number, stdDev: number): number {
    if (stdDev === 0) return 0
    
    const n = data.length
    const cubedDiffs = data.map(x => Math.pow((x - mean) / stdDev, 3))
    return cubedDiffs.reduce((a, b) => a + b, 0) / n
  }

  private calculateKurtosis(data: number[], mean: number, stdDev: number): number {
    if (stdDev === 0) return 0
    
    const n = data.length
    const fourthPowers = data.map(x => Math.pow((x - mean) / stdDev, 4))
    return fourthPowers.reduce((a, b) => a + b, 0) / n - 3
  }

  analyzeTrend(data: number[]): TrendAnalysis | null {
    if (data.length < 3) return null
    
    const n = data.length
    const xMean = (n - 1) / 2
    const yMean = data.reduce((a, b) => a + b, 0) / n
    
    let numerator = 0
    let denominator = 0
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (data[i] - yMean)
      denominator += Math.pow(i - xMean, 2)
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0
    const intercept = yMean - slope * xMean
    
    let ssRes = 0
    let ssTot = 0
    
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept
      ssRes += Math.pow(data[i] - predicted, 2)
      ssTot += Math.pow(data[i] - yMean, 2)
    }
    
    const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0
    
    let direction: TrendAnalysis['direction']
    if (Math.abs(slope) < 0.001) direction = 'stable'
    else if (slope > 0) direction = 'increasing'
    else direction = 'decreasing'
    
    const prediction: number[] = []
    for (let i = n; i < n + 5; i++) {
      prediction.push(slope * i + intercept)
    }
    
    const seasonality = this.detectSeasonality(data)
    
    const confidence = Math.min(0.5 + r2 * 0.5, 0.95)

    return {
      direction,
      slope,
      r2,
      confidence,
      prediction,
      seasonality
    }
  }

  private detectSeasonality(data: number[]): SeasonalityResult | null {
    const n = data.length
    if (n < 10) return null
    
    const maxPeriod = Math.floor(n / 3)
    let bestPeriod = 0
    let bestStrength = 0
    
    for (let period = 2; period <= maxPeriod; period++) {
      let sumCorr = 0
      const numLags = Math.floor(n / period) - 1
      
      for (let lag = 1; lag <= numLags; lag++) {
        const corr = this.calculateAutoCorrelation(data, lag * period)
        sumCorr += Math.abs(corr)
      }
      
      const avgCorr = sumCorr / numLags
      if (avgCorr > bestStrength) {
        bestStrength = avgCorr
        bestPeriod = period
      }
    }
    
    if (bestStrength < 0.3) return null
    
    const peaks: number[] = []
    const troughs: number[] = []
    
    for (let i = 1; i < n - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        peaks.push(i)
      } else if (data[i] < data[i - 1] && data[i] < data[i + 1]) {
        troughs.push(i)
      }
    }

    return {
      period: bestPeriod,
      strength: bestStrength,
      peaks,
      troughs
    }
  }

  private calculateAutoCorrelation(data: number[], lag: number): number {
    const n = data.length
    const mean = data.reduce((a, b) => a + b, 0) / n
    
    let numerator = 0
    let denominator = 0
    
    for (let i = 0; i < n; i++) {
      denominator += Math.pow(data[i] - mean, 2)
      if (i >= lag) {
        numerator += (data[i] - mean) * (data[i - lag] - mean)
      }
    }
    
    return denominator !== 0 ? numerator / denominator : 0
  }

  calculateCorrelation(x: number[], y: number[]): CorrelationResult {
    const n = Math.min(x.length, y.length)
    if (n < 2) {
      return {
        coefficient: 0,
        strength: 'none',
        direction: 'none',
        pValue: 1,
        significant: false
      }
    }
    
    const xMean = x.slice(0, n).reduce((a, b) => a + b, 0) / n
    const yMean = y.slice(0, n).reduce((a, b) => a + b, 0) / n
    
    let numerator = 0
    let xDenom = 0
    let yDenom = 0
    
    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean
      const yDiff = y[i] - yMean
      numerator += xDiff * yDiff
      xDenom += xDiff * xDiff
      yDenom += yDiff * yDiff
    }
    
    const denominator = Math.sqrt(xDenom * yDenom)
    const coefficient = denominator !== 0 ? numerator / denominator : 0
    
    let strength: CorrelationResult['strength']
    const absCoeff = Math.abs(coefficient)
    if (absCoeff < 0.1) strength = 'none'
    else if (absCoeff < 0.3) strength = 'weak'
    else if (absCoeff < 0.5) strength = 'moderate'
    else if (absCoeff < 0.7) strength = 'strong'
    else strength = 'very_strong'
    
    const direction = coefficient > 0.05 ? 'positive' : coefficient < -0.05 ? 'negative' : 'none'
    
    const tStat = coefficient * Math.sqrt((n - 2) / (1 - coefficient * coefficient))
    const pValue = this.tDistributionPValue(tStat, n - 2)
    
    const significant = pValue < 0.05

    return { coefficient, strength, direction, pValue, significant }
  }

  private tDistributionPValue(t: number, df: number): number {
    const x = df / (t * t + df)
    return this.incompleteBeta(df / 2, 0.5, x)
  }

  private incompleteBeta(a: number, b: number, x: number): number {
    if (x === 0) return 0
    if (x === 1) return 1
    
    const maxIterations = 100
    const epsilon = 1e-10
    
    const front = Math.exp(
      this.logGamma(a + b) - this.logGamma(a) - this.logGamma(b) +
      a * Math.log(x) + b * Math.log(1 - x)
    ) / a
    
    let f = 1
    let sum = 1
    
    for (let i = 0; i < maxIterations; i++) {
      const m = (i + 1) / 2
      let d: number
      
      if (i % 2 === 0) {
        d = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m))
      } else {
        d = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1))
      }
      
      f = 1 + d * f
      sum += front * (f - 1)
      
      if (Math.abs(d) < epsilon) break
    }
    
    return sum
  }

  private logGamma(x: number): number {
    const cof = [
      76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
    ]
    
    let y = x
    let tmp = x + 5.5
    tmp -= (x + 0.5) * Math.log(tmp)
    
    let ser = 1.000000000190015
    for (const c of cof) {
      y += 1
      ser += c / y
    }
    
    return -tmp + Math.log(2.5066282746310005 * ser / x)
  }

  detectAnomalies(data: number[], method: 'zscore' | 'iqr' | 'isolation' = 'zscore'): AnomalyDetection {
    const anomalies: Anomaly[] = []
    const n = data.length
    
    if (n < 3) {
      return { anomalies, threshold: 0, method }
    }
    
    const mean = data.reduce((a, b) => a + b, 0) / n
    const stdDev = Math.sqrt(data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / n)
    
    let threshold: number
    
    switch (method) {
      case 'zscore':
        threshold = 2.5
        for (let i = 0; i < n; i++) {
          const zScore = stdDev > 0 ? Math.abs(data[i] - mean) / stdDev : 0
          if (zScore > threshold) {
            const severity = zScore > 3.5 ? 'high' : zScore > 3 ? 'medium' : 'low'
            anomalies.push({
              index: i,
              value: data[i],
              expectedValue: mean,
              deviation: zScore,
              severity
            })
          }
        }
        break
        
      case 'iqr':
        const sorted = [...data].sort((a, b) => a - b)
        const q1 = this.calculatePercentile(sorted, 25)
        const q3 = this.calculatePercentile(sorted, 75)
        const iqr = q3 - q1
        threshold = 1.5
        
        const lowerBound = q1 - threshold * iqr
        const upperBound = q3 + threshold * iqr
        
        for (let i = 0; i < n; i++) {
          if (data[i] < lowerBound || data[i] > upperBound) {
            const deviation = Math.max(
              Math.abs(data[i] - lowerBound) / iqr,
              Math.abs(data[i] - upperBound) / iqr
            )
            const severity = deviation > 3 ? 'high' : deviation > 2 ? 'medium' : 'low'
            anomalies.push({
              index: i,
              value: data[i],
              expectedValue: (q1 + q3) / 2,
              deviation,
              severity
            })
          }
        }
        break
        
      case 'isolation':
        threshold = 0.5
        const scores = this.isolationForestScore(data)
        for (let i = 0; i < n; i++) {
          if (scores[i] > threshold) {
            const severity = scores[i] > 0.7 ? 'high' : scores[i] > 0.6 ? 'medium' : 'low'
            anomalies.push({
              index: i,
              value: data[i],
              expectedValue: mean,
              deviation: scores[i],
              severity
            })
          }
        }
        break
    }

    return { anomalies, threshold, method }
  }

  private isolationForestScore(data: number[], numTrees: number = 100): number[] {
    const n = data.length
    const scores: number[] = new Array(n).fill(0)
    
    for (let t = 0; t < numTrees; t++) {
      const indices = [...Array(n).keys()]
      this.shuffleArray(indices)
      
      const subsampleSize = Math.min(256, n)
      const subsample = indices.slice(0, subsampleSize)
      
      for (const i of subsample) {
        const pathLength = this.calculatePathLength(data, i, subsample, 0, Math.ceil(Math.log2(subsampleSize)))
        scores[i] += Math.pow(2, -pathLength / this.averagePathLength(subsampleSize))
      }
    }
    
    for (let i = 0; i < n; i++) {
      scores[i] /= numTrees
    }
    
    return scores
  }

  private calculatePathLength(
    data: number[],
    index: number,
    indices: number[],
    currentDepth: number,
    maxDepth: number
  ): number {
    if (currentDepth >= maxDepth || indices.length <= 1) {
      return currentDepth + this.averagePathLength(indices.length)
    }
    
    const min = Math.min(...indices.map(i => data[i]))
    const max = Math.max(...indices.map(i => data[i]))
    
    if (min === max) {
      return currentDepth + this.averagePathLength(indices.length)
    }
    
    const splitValue = min + Math.random() * (max - min)
    
    const leftIndices = indices.filter(i => data[i] < splitValue)
    const rightIndices = indices.filter(i => data[i] >= splitValue)
    
    if (leftIndices.includes(index)) {
      return this.calculatePathLength(data, index, leftIndices, currentDepth + 1, maxDepth)
    } else {
      return this.calculatePathLength(data, index, rightIndices, currentDepth + 1, maxDepth)
    }
  }

  private averagePathLength(n: number): number {
    if (n <= 1) return 0
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n)
  }

  private shuffleArray(array: number[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]
    }
  }

  forecast(data: number[], periods: number = 5): ForecastResult {
    const n = data.length
    
    if (n < 3) {
      return {
        values: new Array(periods).fill(data[data.length - 1] || 0),
        confidence: {
          lower: new Array(periods).fill(0),
          upper: new Array(periods).fill(0)
        },
        accuracy: 0,
        method: 'moving_average'
      }
    }
    
    const alpha = 0.3
    const smoothed: number[] = [data[0]]
    
    for (let i = 1; i < n; i++) {
      smoothed[i] = alpha * data[i] + (1 - alpha) * smoothed[i - 1]
    }
    
    const values: number[] = []
    const lastSmoothed = smoothed[n - 1]
    
    for (let i = 0; i < periods; i++) {
      values.push(lastSmoothed)
    }
    
    const stdDev = Math.sqrt(
      data.reduce((sum, x, i) => sum + Math.pow(x - smoothed[i], 2), 0) / n
    )
    
    const lower = values.map(v => v - 1.96 * stdDev)
    const upper = values.map(v => v + 1.96 * stdDev)
    
    const mape = data.reduce((sum, x, i) => {
      if (i === 0 || x === 0) return sum
      return sum + Math.abs((x - smoothed[i]) / x)
    }, 0) / (n - 1)
    
    const accuracy = Math.max(0, 1 - mape)

    return {
      values,
      confidence: { lower, upper },
      accuracy,
      method: 'exponential_smoothing'
    }
  }

  performRegression(
    x: number[],
    y: number[],
    type: 'linear' | 'polynomial' | 'exponential' | 'logarithmic' = 'linear'
  ): RegressionResult {
    const n = Math.min(x.length, y.length)
    
    let coefficients: number[] = []
    let equation = ''
    let predictions: number[] = []
    
    switch (type) {
      case 'linear': {
        const result = this.linearRegression(x.slice(0, n), y.slice(0, n))
        coefficients = [result.slope, result.intercept]
        equation = `y = ${result.slope.toFixed(4)}x + ${result.intercept.toFixed(4)}`
        predictions = x.map(xi => result.slope * xi + result.intercept)
        break
      }
      
      case 'polynomial': {
        const result = this.polynomialRegression(x.slice(0, n), y.slice(0, n), 2)
        coefficients = result.coefficients
        equation = `y = ${coefficients[2].toFixed(4)}x² + ${coefficients[1].toFixed(4)}x + ${coefficients[0].toFixed(4)}`
        predictions = x.map(xi => coefficients[0] + coefficients[1] * xi + coefficients[2] * xi * xi)
        break
      }
      
      case 'exponential': {
        const logY = y.map(yi => Math.log(Math.max(yi, 0.001)))
        const result = this.linearRegression(x.slice(0, n), logY.slice(0, n))
        const a = Math.exp(result.intercept)
        const b = result.slope
        coefficients = [a, b]
        equation = `y = ${a.toFixed(4)} * e^(${b.toFixed(4)}x)`
        predictions = x.map(xi => a * Math.exp(b * xi))
        break
      }
      
      case 'logarithmic': {
        const logX = x.map(xi => Math.log(Math.max(xi, 0.001)))
        const result = this.linearRegression(logX.slice(0, n), y.slice(0, n))
        coefficients = [result.slope, result.intercept]
        equation = `y = ${result.intercept.toFixed(4)} + ${result.slope.toFixed(4)} * ln(x)`
        predictions = x.map(xi => result.intercept + result.slope * Math.log(Math.max(xi, 0.001)))
        break
      }
    }
    
    const ySlice = y.slice(0, n)
    const yMean = ySlice.reduce((a, b) => a + b, 0) / n
    
    let ssRes = 0
    let ssTot = 0
    
    for (let i = 0; i < n; i++) {
      ssRes += Math.pow(ySlice[i] - predictions[i], 2)
      ssTot += Math.pow(ySlice[i] - yMean, 2)
    }
    
    const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0
    const rmse = Math.sqrt(ssRes / n)

    return { type, equation, coefficients, r2, rmse, predictions }
  }

  private linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = x.length
    const xMean = x.reduce((a, b) => a + b, 0) / n
    const yMean = y.reduce((a, b) => a + b, 0) / n
    
    let numerator = 0
    let denominator = 0
    
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean)
      denominator += Math.pow(x[i] - xMean, 2)
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0
    const intercept = yMean - slope * xMean
    
    return { slope, intercept }
  }

  private polynomialRegression(x: number[], y: number[], degree: number): { coefficients: number[] } {
    const n = x.length
    
    const matrix: number[][] = []
    const vector: number[] = []
    
    for (let i = 0; i <= degree; i++) {
      matrix[i] = []
      for (let j = 0; j <= degree; j++) {
        let sum = 0
        for (let k = 0; k < n; k++) {
          sum += Math.pow(x[k], i + j)
        }
        matrix[i][j] = sum
      }
      
      let sum = 0
      for (let k = 0; k < n; k++) {
        sum += y[k] * Math.pow(x[k], i)
      }
      vector[i] = sum
    }
    
    for (let i = 0; i <= degree; i++) {
      const pivot = matrix[i][i]
      for (let j = 0; j <= degree; j++) {
        matrix[i][j] /= pivot
      }
      vector[i] /= pivot
      
      for (let k = 0; k <= degree; k++) {
        if (k !== i) {
          const factor = matrix[k][i]
          for (let j = 0; j <= degree; j++) {
            matrix[k][j] -= factor * matrix[i][j]
          }
          vector[k] -= factor * vector[i]
        }
      }
    }
    
    return { coefficients: vector }
  }

  private generateInsights(
    summary: StatisticalSummary,
    trends: TrendAnalysis | null,
    anomalies: AnomalyDetection | null
  ): string[] {
    const insights: string[] = []
    
    if (summary.count > 0) {
      insights.push(`Data contains ${summary.count} data points`)
      insights.push(`Average value is ${summary.mean.toFixed(2)} with standard deviation ${summary.stdDev.toFixed(2)}`)
      
      if (summary.skewness > 0.5) {
        insights.push('Distribution is positively skewed (right tail)')
      } else if (summary.skewness < -0.5) {
        insights.push('Distribution is negatively skewed (left tail)')
      }
      
      if (summary.kurtosis > 1) {
        insights.push('Distribution has heavy tails (leptokurtic)')
      } else if (summary.kurtosis < -1) {
        insights.push('Distribution has light tails (platykurtic)')
      }
    }
    
    if (trends) {
      insights.push(`Trend is ${trends.direction} with R² = ${trends.r2.toFixed(3)}`)
      if (trends.seasonality) {
        insights.push(`Seasonal pattern detected with period ${trends.seasonality.period}`)
      }
    }
    
    if (anomalies && anomalies.anomalies.length > 0) {
      insights.push(`Found ${anomalies.anomalies.length} anomalies using ${anomalies.method} method`)
      const highSeverity = anomalies.anomalies.filter(a => a.severity === 'high').length
      if (highSeverity > 0) {
        insights.push(`${highSeverity} anomalies have high severity`)
      }
    }
    
    return insights
  }

  private generateRecommendations(
    summary: StatisticalSummary,
    trends: TrendAnalysis | null,
    anomalies: AnomalyDetection | null
  ): string[] {
    const recommendations: string[] = []
    
    if (summary.stdDev / summary.mean > 0.5) {
      recommendations.push('High variability detected - consider investigating causes')
    }
    
    if (trends) {
      if (trends.direction === 'increasing' && trends.confidence > 0.7) {
        recommendations.push('Strong upward trend - plan for continued growth')
      } else if (trends.direction === 'decreasing' && trends.confidence > 0.7) {
        recommendations.push('Strong downward trend - investigate and take action')
      }
      
      if (trends.r2 < 0.3) {
        recommendations.push('Weak trend fit - data may be too noisy or non-linear')
      }
    }
    
    if (anomalies && anomalies.anomalies.length > summary.count * 0.1) {
      recommendations.push('High anomaly rate - review data quality')
    }
    
    if (summary.range > summary.mean * 2) {
      recommendations.push('Large range relative to mean - check for outliers')
    }
    
    return recommendations
  }
}

export const enhancedDataAnalyzer = EnhancedDataAnalyzer.getInstance()

import { describe, it, expect } from 'vitest'
import { analyzeData, suggestCharts } from '../utils/enhancedFeatures'

describe('DataAnalysis', () => {
  describe('analyzeData', () => {
    it('should analyze simple numeric data', () => {
      const data = [
        ['Name', 'Age', 'Score'],
        ['Alice', 25, 85],
        ['Bob', 30, 92],
        ['Charlie', 28, 78]
      ]
      
      const result = analyzeData(data)
      
      expect(result.summary.totalRows).toBe(3)
      expect(result.summary.totalColumns).toBe(3)
      expect(result.summary.numericColumns).toBe(2)
      expect(result.summary.textColumns).toBe(1)
    })

    it('should calculate statistics correctly', () => {
      const data = [
        ['Value'],
        [10],
        [20],
        [30],
        [40],
        [50]
      ]
      
      const result = analyzeData(data)
      const stats = result.statistics[0]
      
      expect(stats.type).toBe('numeric')
      expect(stats.stats?.min).toBe(10)
      expect(stats.stats?.max).toBe(50)
      expect(stats.stats?.mean).toBe(30)
      expect(stats.stats?.median).toBe(30)
    })

    it('should detect correlations', () => {
      const data = [
        ['X', 'Y'],
        [1, 2],
        [2, 4],
        [3, 6],
        [4, 8],
        [5, 10]
      ]
      
      const result = analyzeData(data)
      
      expect(result.correlations.length).toBeGreaterThan(0)
      expect(result.correlations[0].correlation).toBeCloseTo(1, 1)
    })

    it('should detect trends', () => {
      const data = [
        ['Value'],
        [10],
        [20],
        [30],
        [40],
        [50]
      ]
      
      const result = analyzeData(data)
      
      expect(result.trends.length).toBeGreaterThan(0)
      expect(result.trends[0].trend).toBe('increasing')
    })

    it('should detect outliers', () => {
      const data = [
        ['Value'],
        [10],
        [10],
        [10],
        [10],
        [1000]
      ]
      
      const result = analyzeData(data)
      
      expect(result.outliers.length).toBeGreaterThan(0)
      expect(result.outliers[0].value).toBe(1000)
    })

    it('should handle empty data', () => {
      const result = analyzeData([])
      
      expect(result.summary.totalRows).toBe(0)
      expect(result.summary.totalColumns).toBe(0)
    })

    it('should handle text columns', () => {
      const data = [
        ['Name', 'Category'],
        ['Alice', 'A'],
        ['Bob', 'B'],
        ['Charlie', 'A']
      ]
      
      const result = analyzeData(data)
      const categoryStats = result.statistics.find((s: any) => s.column === 'Category')
      
      expect(categoryStats?.type).toBe('text')
      expect(categoryStats?.uniqueCount).toBe(2)
    })
  })

  describe('suggestCharts', () => {
    it('should suggest scatter chart for numeric data', () => {
      const data = [
        ['X', 'Y'],
        [1, 2],
        [2, 4],
        [3, 6]
      ]
      
      const charts = suggestCharts(data)
      
      expect(charts.some((c: any) => c.type === 'scatter')).toBe(true)
    })

    it('should suggest bar chart for mixed data', () => {
      const data = [
        ['Category', 'Value'],
        ['A', 10],
        ['B', 20],
        ['C', 30]
      ]
      
      const charts = suggestCharts(data)
      
      expect(charts.some((c: any) => c.type === 'bar')).toBe(true)
    })

    it('should suggest line chart for numeric data', () => {
      const data = [
        ['Value'],
        [10],
        [20],
        [30]
      ]
      
      const charts = suggestCharts(data)
      
      expect(charts.some((c: any) => c.type === 'line')).toBe(true)
    })

    it('should return empty array for empty data', () => {
      const charts = suggestCharts([])
      
      expect(charts.length).toBe(0)
    })
  })
})

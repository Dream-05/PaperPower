/**
 * Text-to-SQL 组件
 * 使用本地训练的模型进行自然语言到SQL的转换
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Divider,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Storage as DatabaseIcon,
  Code as CodeIcon,
  History as HistoryIcon,
} from '@mui/icons-material'
import { useLocalModel } from '../services/localModelService'

interface SQLResult {
  sql: string
  question: string
  confidence: number
  executionTime?: number
}

interface HistoryItem {
  question: string
  schema: string
  sql: string
  timestamp: Date
}

const Text2SQLComponent: React.FC = () => {
  const [question, setQuestion] = useState('')
  const [schema, setSchema] = useState('')
  const [result, setResult] = useState<SQLResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [copied, setCopied] = useState(false)

  const { text2sql, isLoading, error, isReady, checkStatus } = useLocalModel()

  useEffect(() => {
    checkStatus()
    const savedHistory = localStorage.getItem('sql_history')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [checkStatus])

  const handleConvert = useCallback(async () => {
    if (!question.trim()) return

    try {
      const startTime = performance.now()
      const sqlResult = await text2sql(question, schema)
      const endTime = performance.now()

      setResult({
        ...sqlResult,
        executionTime: endTime - startTime,
      })

      const newHistory: HistoryItem = {
        question,
        schema,
        sql: sqlResult.sql,
        timestamp: new Date(),
      }

      const updatedHistory = [newHistory, ...history.slice(0, 9)]
      setHistory(updatedHistory)
      localStorage.setItem('sql_history', JSON.stringify(updatedHistory))
    } catch (err) {
      console.error('SQL conversion failed:', err)
    }
  }, [question, schema, text2sql, history])

  const handleCopy = useCallback(() => {
    if (result?.sql) {
      navigator.clipboard.writeText(result.sql)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [result])

  const handleClear = useCallback(() => {
    setQuestion('')
    setSchema('')
    setResult(null)
  }, [])

  const exampleQuestions = [
    '查找所有员工',
    '统计每个部门的员工数量',
    '找出工资最高的员工',
    '查找年龄大于30的员工',
    '按入职日期排序显示员工',
  ]

  const exampleSchemas = [
    '表 员工: 员工ID (int), 姓名, 部门, 工资, 入职日期, 年龄',
    '表 学生: 学号 (int), 姓名, 年龄, 班级, 成绩',
    '表 产品: 产品ID (int), 产品名称, 价格, 类别, 库存',
  ]

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DatabaseIcon color="primary" />
        Text-to-SQL 转换器
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        使用本地训练的AI模型，将自然语言问题转换为SQL查询语句
      </Typography>

      {!isReady && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          模型服务未连接，请确保后端服务已启动
          <Button size="small" onClick={checkStatus} sx={{ ml: 2 }}>
            重试连接
          </Button>
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          数据库表结构
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={3}
          value={schema}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSchema(e.target.value)}
          placeholder="例如: 表 员工: 员工ID (int), 姓名, 部门, 工资"
          sx={{ mb: 2 }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {exampleSchemas.map((s, i) => (
            <Chip
              key={i}
              label={s.split(':')[0]}
              size="small"
              onClick={() => setSchema(s)}
              variant="outlined"
            />
          ))}
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          自然语言问题
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={2}
          value={question}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuestion(e.target.value)}
          placeholder="例如: 查找所有员工"
          sx={{ mb: 2 }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {exampleQuestions.map((q, i) => (
            <Chip
              key={i}
              label={q}
              size="small"
              onClick={() => setQuestion(q)}
              variant="outlined"
            />
          ))}
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
          onClick={handleConvert}
          disabled={!question.trim() || isLoading || !isReady}
          size="large"
        >
          {isLoading ? '转换中...' : '转换为SQL'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleClear}
        >
          清空
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CodeIcon color="primary" />
              生成的SQL
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {result.executionTime && (
                <Chip
                  label={`${result.executionTime.toFixed(0)}ms`}
                  size="small"
                  variant="outlined"
                />
              )}
              <Tooltip title={copied ? '已复制' : '复制SQL'}>
                <IconButton size="small" onClick={handleCopy}>
                  <CopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Box
            sx={{
              p: 2,
              bgcolor: 'grey.900',
              borderRadius: 1,
              fontFamily: 'monospace',
              color: 'common.white',
              overflow: 'auto',
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{result.sql}</pre>
          </Box>
        </Paper>
      )}

      {history.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon />
            历史记录
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {history.slice(0, 5).map((item, i) => (
            <Card key={i} variant="outlined" sx={{ mb: 1 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body2" color="text.secondary">
                  {item.question}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', color: 'primary.main', mt: 0.5 }}
                >
                  {item.sql}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Paper>
      )}
    </Box>
  )
}

export default Text2SQLComponent

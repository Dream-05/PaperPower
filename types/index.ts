export interface SemanticToken {
  type: 'intent' | 'entity' | 'constraint' | 'style' | 'emotion' | 'special'
  value: string
  confidence: number
  position: [number, number]
}

export interface IntentParseResult {
  intent: string
  parameters: Record<string, unknown>
  emotion: string
  urgency: 'low' | 'normal' | 'high'
  implicitNeeds: string[]
  decisionPath: DecisionStep[]
  multiInstructions?: MultiInstruction[]
}

export interface MultiInstruction {
  id: string
  trigger: string
  content: string
  position: [number, number]
}

export interface DecisionStep {
  step: number
  operation: string
  method: string
  input: unknown
  output: unknown
  evidence: string
}

export interface AuditLog {
  auditId: string
  timestamp: string
  algorithmVersion: string
  inputHash: string
  decisionPath: DecisionStep[]
  finalOutputHash: string
  reproducibility: {
    sameInputSameOutput: boolean
    verificationCommand: string
    replayAvailable: boolean
  }
}

export interface DocumentFormat {
  type: 'thesis' | 'lesson_plan' | 'report' | 'resume' | 'other'
  titleFont: string
  titleSize: number
  bodyFont: string
  bodySize: number
  lineSpacing: number
  margins: {
    top: number
    bottom: number
    left: number
    right: number
  }
}

export interface FileItem {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  modifiedAt?: string
  extension?: string
}

export interface RecentFile {
  id: string
  name: string
  type: 'word' | 'excel' | 'ppt' | 'pdf'
  path: string
  lastOpened: string
}

export interface AIQuickCommand {
  id: string
  label: string
  description: string
  icon: string
  action: string
}

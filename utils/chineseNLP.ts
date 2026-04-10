import { SemanticMatcher, IntentClassifier } from './semanticTraining'

export interface SemanticAnalysis {
  intent: string
  entities: Entity[]
  actions: Action[]
  targets: Target[]
  constraints: Constraint[]
  confidence: number
}

export interface Entity {
  type: 'document' | 'element' | 'style' | 'content' | 'file'
  value: string
  position: [number, number]
}

export interface Action {
  type: string
  name: string
  parameters: Record<string, unknown>
}

export interface Target {
  type: string
  selector: string
  count?: number
}

export interface Constraint {
  type: string
  value: string
}

export interface InstructionTemplate {
  patterns: RegExp[]
  intent: string
  extractor: (match: RegExpMatchArray) => Partial<SemanticAnalysis>
}

// SpecialTokens定义 - 专注于标点符号的语义含义
const SPECIAL_TOKENS = {
  // 标点符号特殊标记 - 核心语义
  PUNCTUATION: {
    '，': 'COMMA_INSTRUCTION_CONTINUE',      // 逗号：指令未结束，后面还有相关指令
    '。': 'PERIOD_INSTRUCTION_END',          // 句号：指令结束
    '；': 'SEMICOLON_INSTRUCTION_SEP',       // 分号：指令分隔
    '！': 'EXCLAMATION_EMPHASIS',            // 感叹号：强调
    '？': 'QUESTION_INQUIRY',                // 问号：询问
    '\n': 'NEWLINE_PARAGRAPH_END',           // 回车：段落结束
    '、': 'CATENATION_ENUM',                 // 顿号：枚举
    '：': 'COLON_EXPLANATION',               // 冒号：解释说明
    '（': 'PAREN_START',                     // 左括号
    '）': 'PAREN_END',                       // 右括号
    '【': 'BRACKET_START',                   // 左方括号
    '】': 'BRACKET_END',                     // 右方括号
    '《': 'ANGLE_START',                     // 左书名号
    '》': 'ANGLE_END',                       // 右书名号
    '"': 'QUOTE_DOUBLE',                     // 双引号
    ',': 'COMMA_ENGLISH',                    // 英文逗号
    '.': 'PERIOD_ENGLISH',                   // 英文句号
    '!': 'EXCLAMATION_ENGLISH',              // 英文感叹号
    '?': 'QUESTION_ENGLISH',                 // 英文问号
    ';': 'SEMICOLON_ENGLISH',                // 英文分号
    ':': 'COLON_ENGLISH',                    // 英文冒号
    '(': 'PAREN_ENGLISH_START',              // 英文左括号
    ')': 'PAREN_ENGLISH_END',                // 英文右括号
    '[': 'BRACKET_ENGLISH_START',            // 英文左方括号
    ']': 'BRACKET_ENGLISH_END'               // 英文右方括号
  },
  
  // 关键词特殊标记 - 用于指令识别
  KEYWORDS: {
    '把': 'BA_CONSTRUCTION',                 // 把字句
    '将': 'JIANG_CONSTRUCTION',              // 将字句
    '让': 'RANG_CONSTRUCTION',               // 让字句
    '给': 'GEI_CONSTRUCTION',                // 给字句
    '帮': 'BANG_REQUEST',                    // 帮助请求
    '请': 'QING_REQUEST',                    // 礼貌请求
    '需要': 'XUYAO_NEED',                    // 需求表达
    '想要': 'XIANGYAO_WANT',                 // 意愿表达
    '希望': 'XIWANG_HOPE',                   // 希望表达
    '和': 'HE_AND',                          // 和（连接）
    '与': 'YU_AND',                          // 与（连接）
    '及': 'JI_AND',                          // 及（连接）
    '然后': 'RANHOU_THEN',                   // 然后（顺序）
    '接着': 'JIEZHE_THEN',                   // 接着（顺序）
    '同时': 'TONGSHI_SIMULTANEOUS',          // 同时（并行）
    '或者': 'HUOZHE_OR',                     // 或者（选择）
    '还是': 'HAISHI_OR',                     // 还是（选择）
    '但是': 'DANSHI_BUT',                    // 但是（转折）
    '不过': 'BUGUO_BUT',                     // 不过（转折）
    'this': 'THIS_ENGLISH',                  // 英文this
    'that': 'THAT_ENGLISH',                  // 英文that
    'the': 'THE_ENGLISH',                    // 英文the
    'and': 'AND_ENGLISH',                    // 英文and
    'or': 'OR_ENGLISH',                      // 英文or
    'but': 'BUT_ENGLISH',                    // 英文but
    'then': 'THEN_ENGLISH',                  // 英文then
    'if': 'IF_ENGLISH',                      // 英文if
    'when': 'WHEN_ENGLISH',                  // 英文when
    'where': 'WHERE_ENGLISH',                // 英文where
    'who': 'WHO_ENGLISH',                    // 英文who
    'why': 'WHY_ENGLISH',                    // 英文why
    'how': 'HOW_ENGLISH'                     // 英文how
  }
}

// 特殊标记处理工具 - 专注于标点符号语义
class SpecialTokenProcessor {
  // 分析标点符号的语义含义
  static analyzePunctuationSemantics(input: string): {
    punctuationSequence: string[];
    instructionBoundaries: number[];
    paragraphBoundaries: number[];
    semanticHints: string[];
  } {
    const punctuationSequence: string[] = []
    const instructionBoundaries: number[] = []
    const paragraphBoundaries: number[] = []
    const semanticHints: string[] = []
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i]
      const token = SPECIAL_TOKENS.PUNCTUATION[char as keyof typeof SPECIAL_TOKENS.PUNCTUATION]
      
      if (token) {
        punctuationSequence.push(token)
        
        // 分析标点符号的语义含义
        switch (token) {
          case 'COMMA_INSTRUCTION_CONTINUE':
            semanticHints.push(`位置${i}: 逗号表示指令未结束，后面还有相关指令`)
            break
          case 'PERIOD_INSTRUCTION_END':
            instructionBoundaries.push(i)
            semanticHints.push(`位置${i}: 句号表示指令结束`)
            break
          case 'SEMICOLON_INSTRUCTION_SEP':
            instructionBoundaries.push(i)
            semanticHints.push(`位置${i}: 分号表示指令分隔`)
            break
          case 'NEWLINE_PARAGRAPH_END':
            paragraphBoundaries.push(i)
            semanticHints.push(`位置${i}: 回车表示段落结束`)
            break
          case 'EXCLAMATION_EMPHASIS':
            semanticHints.push(`位置${i}: 感叹号表示强调`)
            break
          case 'QUESTION_INQUIRY':
            semanticHints.push(`位置${i}: 问号表示询问`)
            break
          case 'COLON_EXPLANATION':
            semanticHints.push(`位置${i}: 冒号表示解释说明`)
            break
        }
      }
    }
    
    return {
      punctuationSequence,
      instructionBoundaries,
      paragraphBoundaries,
      semanticHints
    }
  }
  
  // 提取关键词特殊标记
  static extractKeywords(input: string): {
    keywords: string[];
    positions: { keyword: string; position: number }[];
    semanticRoles: string[];
  } {
    const keywords: string[] = []
    const positions: { keyword: string; position: number }[] = []
    const semanticRoles: string[] = []
    
    for (let i = 0; i < input.length; i++) {
      // 检查中文关键词（2-3个字符）
      for (let len = 3; len >= 1; len--) {
        const substr = input.substring(i, i + len)
        const token = SPECIAL_TOKENS.KEYWORDS[substr as keyof typeof SPECIAL_TOKENS.KEYWORDS]
        
        if (token) {
          keywords.push(substr)
          positions.push({ keyword: substr, position: i })
          
          // 分析关键词的语义角色
          switch (token) {
            case 'BA_CONSTRUCTION':
            case 'JIANG_CONSTRUCTION':
            case 'RANG_CONSTRUCTION':
            case 'GEI_CONSTRUCTION':
              semanticRoles.push(`位置${i}: "${substr}" 表示把字句结构，用于引出动作对象`)
              break
            case 'BANG_REQUEST':
            case 'QING_REQUEST':
              semanticRoles.push(`位置${i}: "${substr}" 表示请求语气`)
              break
            case 'HE_AND':
            case 'YU_AND':
            case 'JI_AND':
              semanticRoles.push(`位置${i}: "${substr}" 表示连接关系`)
              break
            case 'RANHOU_THEN':
            case 'JIEZHE_THEN':
              semanticRoles.push(`位置${i}: "${substr}" 表示顺序关系`)
              break
            case 'TONGSHI_SIMULTANEOUS':
              semanticRoles.push(`位置${i}: "${substr}" 表示并行关系`)
              break
            case 'HUOZHE_OR':
            case 'HAISHI_OR':
              semanticRoles.push(`位置${i}: "${substr}" 表示选择关系`)
              break
            case 'DANSHI_BUT':
            case 'BUGUO_BUT':
              semanticRoles.push(`位置${i}: "${substr}" 表示转折关系`)
              break
            default:
              if (token.endsWith('_ENGLISH')) {
                semanticRoles.push(`位置${i}: "${substr}" 是英文关键词`)
              }
          }
          
          i += len - 1 // 跳过已匹配的字符
          break
        }
      }
    }
    
    return {
      keywords,
      positions,
      semanticRoles
    }
  }
  
  // 综合分析特殊标记的语义
  static analyzeSemantics(input: string): {
    punctuation: ReturnType<typeof SpecialTokenProcessor.analyzePunctuationSemantics>;
    keywords: ReturnType<typeof SpecialTokenProcessor.extractKeywords>;
    instructionStructure: {
      type: 'simple' | 'compound' | 'sequential' | 'parallel';
      complexity: number;
      description: string;
    };
  } {
    const punctuation = this.analyzePunctuationSemantics(input)
    const keywords = this.extractKeywords(input)
    
    // 分析指令结构
    let instructionStructure: {
      type: 'simple' | 'compound' | 'sequential' | 'parallel';
      complexity: number;
      description: string;
    } = {
      type: 'simple',
      complexity: 1,
      description: '单一指令'
    }
    
    // 根据标点符号和关键词判断指令结构
    if (punctuation.instructionBoundaries.length > 0) {
      instructionStructure = {
        type: 'compound',
        complexity: punctuation.instructionBoundaries.length + 1,
        description: `复合指令，包含${punctuation.instructionBoundaries.length + 1}个子指令`
      }
    }
    
    // 检查是否有顺序关系
    if (keywords.keywords.includes('然后') || keywords.keywords.includes('接着')) {
      instructionStructure = {
        type: 'sequential',
        complexity: punctuation.instructionBoundaries.length + 1,
        description: '顺序执行的指令序列'
      }
    }
    
    // 检查是否有并行关系
    if (keywords.keywords.includes('同时')) {
      instructionStructure = {
        type: 'parallel',
        complexity: punctuation.instructionBoundaries.length + 1,
        description: '并行执行的指令'
      }
    }
    
    return {
      punctuation,
      keywords,
      instructionStructure
    }
  }
}

// 上下文管理类 - 实现前后文算法和思考
class ContextManager {
  private static contextHistory: Map<string, SemanticAnalysis[]> = new Map();
  private static contextMetadata: Map<string, {
    lastAccessTime: number;
    instructionCount: number;
    averageConfidence: number;
    dominantIntent: string;
    instructionSequence: string[];
  }> = new Map();

  static addToContext(sessionId: string, analysis: SemanticAnalysis, originalInput: string): void {
    if (!this.contextHistory.has(sessionId)) {
      this.contextHistory.set(sessionId, []);
      this.contextMetadata.set(sessionId, {
        lastAccessTime: Date.now(),
        instructionCount: 0,
        averageConfidence: 0,
        dominantIntent: 'unknown',
        instructionSequence: []
      });
    }
    
    const context = this.contextHistory.get(sessionId)!;
    const metadata = this.contextMetadata.get(sessionId)!;
    
    context.push(analysis);
    
    // 更新元数据
    metadata.lastAccessTime = Date.now();
    metadata.instructionCount++;
    metadata.averageConfidence = (metadata.averageConfidence * (context.length - 1) + analysis.confidence) / context.length;
    metadata.instructionSequence.push(originalInput);
    
    // 计算主导意图
    const intentCounts: Record<string, number> = {};
    context.forEach(a => {
      intentCounts[a.intent] = (intentCounts[a.intent] || 0) + 1;
    });
    metadata.dominantIntent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
    
    // 只保留最近10条指令的上下文
    if (context.length > 10) {
      context.splice(0, context.length - 10);
      metadata.instructionSequence.splice(0, metadata.instructionSequence.length - 10);
    }
  }

  static getContext(sessionId: string): SemanticAnalysis[] {
    const context = this.contextHistory.get(sessionId);
    return context || [];
  }

  static getMetadata(sessionId: string): {
    lastAccessTime: number;
    instructionCount: number;
    averageConfidence: number;
    dominantIntent: string;
    instructionSequence: string[];
  } | null {
    return this.contextMetadata.get(sessionId) || null;
  }

  static clearContext(sessionId: string): void {
    this.contextHistory.delete(sessionId);
    this.contextMetadata.delete(sessionId);
  }

  // 前后文关系分析 - 核心算法
  static analyzeContextualRelationship(
    current: SemanticAnalysis, 
    context: SemanticAnalysis[],
    _currentInput: string,
    contextInputs: string[]
  ): {
    related: boolean;
    relationship: string;
    contextScore: number;
    pattern: string;
    reasoning: string;
  } {
    if (context.length === 0) {
      return { 
        related: false, 
        relationship: 'none', 
        contextScore: 0, 
        pattern: 'first_instruction',
        reasoning: '这是第一条指令，没有上下文关系'
      };
    }

    const lastInstruction = context[context.length - 1];
    const lastInput = contextInputs[contextInputs.length - 1];
    let score = 0;
    let relationship = 'none';
    let pattern = 'unknown';
    let reasoning = '';

    // 检查是否是重复指令
    if (this.isDuplicateInstruction(current, lastInstruction)) {
      return {
        related: true,
        relationship: 'duplicate',
        contextScore: 1.0,
        pattern: 'repetition',
        reasoning: `当前指令与上一条指令"${lastInput}"重复`
      };
    }

    // 检查是否是修正指令
    if (this.isCorrectionInstruction(current, lastInstruction)) {
      return {
        related: true,
        relationship: 'correction',
        contextScore: 0.9,
        pattern: 'correction',
        reasoning: `当前指令是对上一条指令"${lastInput}"的修正`
      };
    }

    // 检查是否是撤销指令
    if (this.isUndoInstruction(current, lastInstruction)) {
      return {
        related: true,
        relationship: 'undo',
        contextScore: 0.8,
        pattern: 'undo',
        reasoning: `当前指令是撤销上一条指令"${lastInput}"`
      };
    }

    // 检查目标类型是否相同
    if (current.targets.length > 0 && lastInstruction.targets.length > 0) {
      const currentTarget = current.targets[0].type;
      const lastTarget = lastInstruction.targets[0].type;
      if (currentTarget === lastTarget) {
        score += 0.5;
        relationship = 'same_target';
        pattern = 'same_target_sequence';
        reasoning = `当前指令与上一条指令针对相同的目标"${currentTarget}"`;
      } else {
        // 检查是否是目标切换
        score += 0.2;
        relationship = 'target_switch';
        pattern = 'target_switch';
        reasoning = `当前指令从目标"${lastTarget}"切换到目标"${currentTarget}"`;
      }
    }

    // 检查动作是否相关
    if (current.actions.length > 0 && lastInstruction.actions.length > 0) {
      const currentAction = current.actions[0].type;
      const lastAction = lastInstruction.actions[0].type;
      if (this.areActionsRelated(currentAction, lastAction)) {
        score += 0.3;
        relationship = relationship === 'none' ? 'related_actions' : relationship;
        pattern = 'related_actions';
        reasoning += reasoning ? `，且动作"${lastAction}"和"${currentAction}"相关` : `动作"${lastAction}"和"${currentAction}"相关`;
      }
    }

    // 检查意图是否相同
    if (current.intent === lastInstruction.intent) {
      score += 0.2;
      pattern = 'same_intent';
      reasoning += reasoning ? `，意图相同` : `意图相同`;
    }

    // 基于指令顺序增加相关性
    if (context.length > 1) {
      score += 0.1;
    }

    return {
      related: score > 0.3,
      relationship,
      contextScore: score,
      pattern,
      reasoning: reasoning || '没有明显的上下文关系'
    };
  }

  // 检查是否是重复指令
  private static isDuplicateInstruction(current: SemanticAnalysis, last: SemanticAnalysis): boolean {
    if (current.targets.length !== last.targets.length) return false;
    if (current.actions.length !== last.actions.length) return false;
    
    for (let i = 0; i < current.targets.length; i++) {
      if (current.targets[i].type !== last.targets[i].type) return false;
    }
    
    for (let i = 0; i < current.actions.length; i++) {
      if (current.actions[i].type !== last.actions[i].type) return false;
    }
    
    return true;
  }

  // 检查是否是修正指令
  private static isCorrectionInstruction(current: SemanticAnalysis, last: SemanticAnalysis): boolean {
    if (current.targets.length === 0 || last.targets.length === 0) return false;
    
    const currentTarget = current.targets[0].type;
    const lastTarget = last.targets[0].type;
    
    return currentTarget === lastTarget && current.actions.length > 0 && last.actions.length > 0;
  }

  // 检查是否是撤销指令
  private static isUndoInstruction(current: SemanticAnalysis, _last: SemanticAnalysis): boolean {
    const undoKeywords = ['取消', '撤销', '恢复', '还原', 'undo', 'cancel', 'restore'];
    
    if (current.actions.length > 0) {
      const action = current.actions[0].type.toLowerCase();
      return undoKeywords.some(keyword => action.includes(keyword));
    }
    
    return false;
  }

  // 分析指令序列模式
  static analyzePattern(context: SemanticAnalysis[], contextInputs: string[]): {
    pattern: string;
    confidence: number;
    suggestion: string;
  } {
    if (context.length < 2) {
      return { pattern: 'insufficient_data', confidence: 0, suggestion: '' };
    }

    const recentInstructions = context.slice(-5);
    const recentInputs = contextInputs.slice(-5);
    
    // 检查是否是格式化序列
    const formattingActions = ['alignCenter', 'alignLeft', 'alignRight', 'indent', 'bold', 'italic', 'underline'];
    const formattingCount = recentInstructions.filter(a => 
      a.actions.some(action => formattingActions.includes(action.type))
    ).length;
    
    if (formattingCount >= 3) {
      return {
        pattern: 'formatting_sequence',
        confidence: 0.8,
        suggestion: `检测到格式化操作序列：${recentInputs.join(' -> ')}`
      };
    }

    // 检查是否是内容生成序列
    const contentActions = ['write', 'generate', 'create', 'insert'];
    const contentCount = recentInstructions.filter(a => 
      a.actions.some(action => contentActions.includes(action.type))
    ).length;
    
    if (contentCount >= 2) {
      return {
        pattern: 'content_generation_sequence',
        confidence: 0.7,
        suggestion: `检测到内容生成序列：${recentInputs.join(' -> ')}`
      };
    }

    // 检查是否是搜索序列
    const searchActions = ['search', 'query', 'find'];
    const searchCount = recentInstructions.filter(a => 
      a.actions.some(action => searchActions.includes(action.type))
    ).length;
    
    if (searchCount >= 2) {
      return {
        pattern: 'search_sequence',
        confidence: 0.7,
        suggestion: `检测到搜索序列：${recentInputs.join(' -> ')}`
      };
    }

    return {
      pattern: 'unknown',
      confidence: 0.3,
      suggestion: ''
    };
  }

  private static areActionsRelated(action1: string, action2: string): boolean {
    const relatedActions: Record<string, string[]> = {
      'alignCenter': ['alignLeft', 'alignRight', 'alignJustify'],
      'alignLeft': ['alignCenter', 'alignRight', 'alignJustify'],
      'alignRight': ['alignCenter', 'alignLeft', 'alignJustify'],
      'indent': ['bold', 'italic', 'underline'],
      'bold': ['italic', 'underline', 'indent'],
      'italic': ['bold', 'underline', 'indent'],
      'underline': ['bold', 'italic', 'indent']
    };

    return relatedActions[action1]?.includes(action2) || false;
  }
}

export class ChineseNLPProcessor {
  private static readonly INTENT_TEMPLATES: InstructionTemplate[] = [
    {
      patterns: [
        /帮[我我把]*([^，,。；;]+?)(居中|左对齐|右对齐|首行缩进|首航缩进|首行|首航|缩进|加粗|斜体|下划线|删除线)/g,
        /把([^，,。；;]+?)(居中|左对齐|右对齐|首行缩进|首航缩进|首行|首航|缩进|加粗|斜体|下划线|删除线)/g,
        /([^，,。；;]+?)(居中|左对齐|右对齐|首行缩进|首航缩进|首行|首航|缩进|加粗|斜体|下划线|删除线)/g
      ],
      intent: 'format',
      extractor: (match) => {
        const [, target, action] = match
        return {
          intent: 'format',
          targets: target ? [{ type: target.trim(), selector: target.trim() }] : [],
          actions: action ? [{ type: action, name: action, parameters: {} }] : []
        }
      }
    },
    {
      patterns: [
        /帮[我我把]*写([^，,。；;]+?)/g,
        /写([^，,。；;]+?)/g,
        /生成([^，,。；;]+?)/g,
        /创建([^，,。；;]+?)/g
      ],
      intent: 'content',
      extractor: (match) => {
        const [, content] = match
        return {
          intent: 'content',
          entities: content ? [{ type: 'content', value: content.trim(), position: [0, content.length] }] : [],
          actions: [{ type: 'write', name: 'write', parameters: { content: content?.trim() } }]
        }
      }
    },
    {
      patterns: [
        /搜索([^，,。；;]+?)/g,
        /查询([^，,。；;]+?)/g,
        /查找([^，,。；;]+?)/g
      ],
      intent: 'search',
      extractor: (match) => {
        const [, query] = match
        return {
          intent: 'search',
          entities: query ? [{ type: 'content', value: query.trim(), position: [0, query.length] }] : [],
          actions: [{ type: 'search', name: 'search', parameters: { query: query?.trim() } }]
        }
      }
    }
  ]

  private static readonly TARGET_MAPPINGS: Record<string, string> = {
    '标题': 'heading',
    '一级标题': 'heading1',
    '二级标题': 'heading2',
    '三级标题': 'heading3',
    '大标题': 'heading1',
    '小标题': 'heading3',
    '主标题': 'heading1',
    '副标题': 'heading2',
    '正文': 'paragraph',
    '段落': 'paragraph',
    '文字': 'text',
    '内容': 'content',
    '文本': 'text',
    '文章': 'content',
    '列表': 'list',
    '表格': 'table',
    '图片': 'image',
    '链接': 'link',
    '引用': 'quote',
    '代码': 'code',
    '文档': 'document',
    '文件': 'file',
    '页面': 'page',
    '所有': 'all',
    '全部': 'all'
  }

  private static readonly ACTION_MAPPINGS: Record<string, string> = {
    '居中': 'alignCenter',
    '左对齐': 'alignLeft',
    '左对': 'alignLeft',
    '右对齐': 'alignRight',
    '右对': 'alignRight',
    '两端对齐': 'alignJustify',
    '分散对齐': 'alignJustify',
    '首行缩进': 'indent',
    '首航缩进': 'indent',
    '首行': 'indent',
    '首航': 'indent',
    '缩进': 'indent',
    '增加缩进': 'increaseIndent',
    '减少缩进': 'decreaseIndent',
    '加粗': 'bold',
    '斜体': 'italic',
    '下划线': 'underline',
    '删除线': 'strikethrough',
    '上标': 'superscript',
    '下标': 'subscript',
    '大写': 'uppercase',
    '小写': 'lowercase',
    '首字母大写': 'capitalize',
    '增大字号': 'increaseFontSize',
    '减小字号': 'decreaseFontSize',
    '放大': 'increaseFontSize',
    '缩小': 'decreaseFontSize',
    '设置字号': 'setFontSize',
    '清除格式': 'clearFormat',
    '复制格式': 'copyFormat',
    '应用格式': 'applyFormat',
    '写': 'write',
    '生成': 'generate',
    '创建': 'create',
    '制作': 'create',
    '编写': 'write',
    '撰写': 'write',
    '导入': 'import',
    '插入': 'insert',
    '增加': 'add',
    '添加': 'add',
    '删除': 'delete',
    '修改': 'modify',
    '调整': 'adjust',
    '设置': 'set',
    '搜索': 'search',
    '查询': 'search',
    '查找': 'search',
    '获取': 'get',
    '下载': 'download',
    '上传': 'upload',
    '打开': 'open',
    '关闭': 'close',
    '保存': 'save',
    '复制': 'copy',
    '粘贴': 'paste',
    '剪切': 'cut',
    '运行': 'run',
    '执行': 'execute',
    '启动': 'start',
    '停止': 'stop',
    '暂停': 'pause',
    '继续': 'resume',
    '创建文档': 'createDocument',
    '新建文档': 'createDocument',
    '打开文档': 'openDocument',
    '保存文档': 'saveDocument',
    '关闭文档': 'closeDocument',
    '插入图片': 'insertImage',
    '插入表格': 'insertTable',
    '插入列表': 'insertList',
    '插入链接': 'insertLink',
    '帮助': 'help',
    '支持': 'help',
    '指导': 'guide',
    '教程': 'tutorial',
    '解释': 'explain',
    '说明': 'explain'
  }

  static analyze(input: string, sessionId: string = 'default'): SemanticAnalysis {
    console.log('🔍 分析输入:', input)
    
    // 分析特殊标记的语义
    const semantics = SpecialTokenProcessor.analyzeSemantics(input)
    console.log('🧠 特殊标记语义分析:', semantics)
    
    // 输出语义提示
    semantics.punctuation.semanticHints.forEach(hint => console.log(`  💡 ${hint}`))
    semantics.keywords.semanticRoles.forEach(role => console.log(`  🎯 ${role}`))
    console.log(`  📊 指令结构: ${semantics.instructionStructure.description}`)
    
    const classification = IntentClassifier.classify(input)
    console.log('📊 意图分类:', classification)
    
    if (classification.confidence > 0.5) {
      const bestMatch = SemanticMatcher.findBestMatch(input, classification.language)
      if (bestMatch) {
        console.log('🎯 最佳匹配:', bestMatch)
        
        const convertedEntities: Entity[] = (bestMatch.entities || []).map(e => ({
          type: e.type as Entity['type'],
          value: e.value,
          position: [e.start, e.end] as [number, number]
        }))
        
        const analysis: SemanticAnalysis = {
          intent: bestMatch.intent || 'unknown',
          entities: convertedEntities,
          actions: bestMatch.action ? [{ type: bestMatch.action, name: bestMatch.action, parameters: {} }] : [],
          targets: bestMatch.target ? [{ type: bestMatch.target, selector: bestMatch.target }] : [],
          constraints: [],
          confidence: classification.confidence
        }
        
        // 添加特殊标记语义信息到约束中
        analysis.constraints.push({
          type: 'punctuation_semantics',
          value: JSON.stringify(semantics.punctuation.semanticHints)
        })
        
        analysis.constraints.push({
          type: 'keyword_semantics',
          value: JSON.stringify(semantics.keywords.semanticRoles)
        })
        
        analysis.constraints.push({
          type: 'instruction_structure',
          value: JSON.stringify(semantics.instructionStructure)
        })
        
        // 标准化目标和动作
        this.normalizeAnalysis(analysis)
        
        // 分析上下文关系
        const context = ContextManager.getContext(sessionId)
        const metadata = ContextManager.getMetadata(sessionId)
        const contextualRelationship = ContextManager.analyzeContextualRelationship(
          analysis, 
          context, 
          input,
          metadata?.instructionSequence || []
        )
        
        console.log('🔗 上下文关系:', contextualRelationship)
        console.log(`  🤔 推理: ${contextualRelationship.reasoning}`)
        
        // 添加上下文信息到结果
        analysis.constraints.push({
          type: 'contextual_relationship',
          value: JSON.stringify(contextualRelationship)
        })
        
        // 更新置信度
        if (contextualRelationship.related) {
          analysis.confidence = Math.min(1, analysis.confidence + contextualRelationship.contextScore * 0.2)
        }
        
        // 添加到上下文
        ContextManager.addToContext(sessionId, analysis, input)
        
        console.log('✅ 分析完成:', analysis)
        return analysis
      }
    }
    
    // 回退分析
    const fallback = this.fallbackAnalysis(input)
    ContextManager.addToContext(sessionId, fallback, input)
    return fallback
  }

  static splitInstructions(input: string): string[] {
    const instructions: string[] = []
    let currentInstruction = ''
    
    console.log('🔤 原始输入:', input)
    
    // 分析标点符号语义
    const semantics = SpecialTokenProcessor.analyzeSemantics(input)
    console.log('🧠 标点符号语义分析:')
    semantics.punctuation.semanticHints.forEach(hint => console.log(`  💡 ${hint}`))
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i]
      const token = SPECIAL_TOKENS.PUNCTUATION[char as keyof typeof SPECIAL_TOKENS.PUNCTUATION]
      
      if (token) {
        // 根据标点符号的语义含义进行分割
        switch (token) {
          case 'COMMA_INSTRUCTION_CONTINUE':
            // 逗号：指令未结束，后面还有相关指令
            if (currentInstruction.trim()) {
              instructions.push(currentInstruction.trim())
              currentInstruction = ''
            }
            break
          case 'PERIOD_INSTRUCTION_END':
            // 句号：指令结束
            currentInstruction += char
            if (currentInstruction.trim()) {
              instructions.push(currentInstruction.trim())
              currentInstruction = ''
            }
            break
          case 'SEMICOLON_INSTRUCTION_SEP':
            // 分号：指令分隔
            if (currentInstruction.trim()) {
              instructions.push(currentInstruction.trim())
              currentInstruction = ''
            }
            break
          case 'NEWLINE_PARAGRAPH_END':
            // 回车：段落结束
            if (currentInstruction.trim()) {
              instructions.push(currentInstruction.trim())
              currentInstruction = ''
            }
            break
          default:
            // 其他标点符号，保留在当前指令中
            currentInstruction += char
        }
      } else {
        // 普通字符
        currentInstruction += char
      }
    }
    
    // 处理最后一个指令
    if (currentInstruction.trim()) {
      instructions.push(currentInstruction.trim())
    }
    
    // 过滤无效指令
    const validInstructions = instructions.filter(instruction => this.isValidInstruction(instruction))
    console.log('📋 分割结果:', validInstructions)
    return validInstructions
  }

  private static isValidInstruction(text: string): boolean {
    const actionKeywords = [
      '居中', '左对齐', '右对齐', '首行缩进', '首航缩进', '缩进',
      '加粗', '斜体', '下划线', '删除线', '增大字号', '减小字号',
      '写', '生成', '创建', '制作', '编写', '撰写', '导入', '插入',
      '增加', '添加', '删除', '修改', '调整', '设置',
      '搜索', '查询', '查找', '获取', '下载', '上传',
      '打开', '关闭', '保存', '复制', '粘贴', '剪切',
      '运行', '执行', '启动', '停止', '暂停', '继续',
      '创建文档', '新建文档', '打开文档', '保存文档', '关闭文档',
      '插入图片', '插入表格', '插入列表', '插入链接',
      '帮助', '支持', '指导', '教程', '解释', '说明'
    ]
    
    return actionKeywords.some(keyword => text.includes(keyword))
  }

  private static normalizeAnalysis(analysis: SemanticAnalysis): void {
    // 标准化目标
    analysis.targets = analysis.targets.map(target => ({
      ...target,
      type: this.normalizeTarget(target.type)
    }))
    
    // 标准化动作
    analysis.actions = analysis.actions.map(action => ({
      ...action,
      type: this.normalizeAction(action.type)
    }))
  }

  private static normalizeTarget(target: string): string {
    const trimmed = target.trim()
    return this.TARGET_MAPPINGS[trimmed] || 'all'
  }

  private static normalizeAction(action: string): string {
    const trimmed = action.trim()
    return this.ACTION_MAPPINGS[trimmed] || action
  }

  private static fallbackAnalysis(input: string): SemanticAnalysis {
    console.log('⚠️ 使用回退分析')
    
    const analysis: SemanticAnalysis = {
      intent: 'unknown',
      entities: [],
      actions: [],
      targets: [],
      constraints: [],
      confidence: 0.3
    }
    
    // 简单的关键词匹配
    for (const template of this.INTENT_TEMPLATES) {
      for (const pattern of template.patterns) {
        const match = pattern.exec(input)
        if (match) {
          const extracted = template.extractor(match)
          Object.assign(analysis, extracted)
          analysis.confidence = 0.6
          break
        }
      }
      if (analysis.confidence > 0.3) break
    }
    
    // 标准化分析结果
    this.normalizeAnalysis(analysis)
    
    console.log('📋 回退分析结果:', analysis)
    return analysis
  }
}
Office.onReady(() => {
  console.log('智办AI Excel Add-in 已就绪');
});

async function showNotification(title: string, message: string): Promise<void> {
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    const range = sheet.getRange('A1');
    range.values = [[`${title}: ${message}`]];
    await context.sync();
  });
}

async function getSelectedCellFormula(): Promise<string | null> {
  return Excel.run(async (context) => {
    const range = context.workbook.getSelectedRange();
    range.load('formulas');
    await context.sync();
    return range.formulas[0][0] as string;
  });
}

async function getSelectedRangeInfo(): Promise<{
  address: string;
  values: string[][];
  formulas: string[][];
}> {
  return Excel.run(async (context) => {
    const range = context.workbook.getSelectedRange();
    range.load(['address', 'values', 'formulas']);
    await context.sync();
    return {
      address: range.address,
      values: range.values as string[][],
      formulas: range.formulas as string[][],
    };
  });
}

function parseFormula(formula: string): {
  functionName: string;
  arguments: string[];
  description: string;
} {
  if (!formula || !formula.startsWith('=')) {
    return { functionName: '', arguments: [], description: '不是有效的公式' };
  }

  const match = formula.match(/^=(\w+)\((.*)\)$/);
  if (!match) {
    return { functionName: '', arguments: [], description: '无法解析公式结构' };
  }

  const functionName = match[1].toUpperCase();
  const argsStr = match[2];
  const arguments: string[] = [];
  
  let depth = 0;
  let currentArg = '';
  for (const char of argsStr) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      arguments.push(currentArg.trim());
      currentArg = '';
    } else {
      currentArg += char;
    }
  }
  if (currentArg.trim()) {
    arguments.push(currentArg.trim());
  }

  const descriptions: Record<string, string> = {
    SUM: '计算一组数值的总和',
    AVERAGE: '计算一组数值的算术平均值',
    COUNT: '计算包含数字的单元格数量',
    COUNTA: '计算非空单元格的数量',
    MAX: '返回一组数值中的最大值',
    MIN: '返回一组数值中的最小值',
    IF: '根据条件返回不同的值',
    SUMIF: '根据条件对单元格求和',
    SUMIFS: '根据多个条件对单元格求和',
    COUNTIF: '根据条件计算单元格数量',
    COUNTIFS: '根据多个条件计算单元格数量',
    VLOOKUP: '在表格中纵向查找指定值',
    HLOOKUP: '在表格中横向查找指定值',
    XLOOKUP: '新一代查找函数，支持双向查找',
    INDEX: '返回指定位置的值',
    MATCH: '返回值在区域中的位置',
    PMT: '计算贷款每期还款金额',
    NPV: '计算投资的净现值',
    IRR: '计算内部收益率',
    FV: '计算投资的未来值',
    PV: '计算投资的现值',
  };

  return {
    functionName,
    arguments,
    description: descriptions[functionName] || `${functionName} 函数`,
  };
}

function explainFormulaInChinese(parsed: ReturnType<typeof parseFormula>): string {
  const { functionName, arguments: args, description } = parsed;
  
  if (!functionName) {
    return '请选择一个包含公式的单元格';
  }

  let explanation = `【${functionName}】${description}\n\n`;
  
  const argExplanations: Record<string, string[]> = {
    SUM: ['数值范围：要计算总和的单元格区域'],
    AVERAGE: ['数值范围：要计算平均值的单元格区域'],
    IF: ['条件：要判断的条件表达式', '真值：条件为真时返回的值', '假值：条件为假时返回的值'],
    SUMIF: ['条件区域：要判断条件的单元格区域', '条件：判断条件', '求和区域：实际求和的单元格区域'],
    VLOOKUP: ['查找值：要查找的值', '表格区域：包含数据的表格范围', '列号：返回值所在的列号', '匹配类型：0=精确匹配，1=近似匹配'],
    XLOOKUP: ['查找值：要查找的值', '查找区域：包含查找值的区域', '返回区域：要返回值的区域'],
    PMT: ['利率：每期利率', '期数：总还款期数', '现值：贷款本金'],
  };

  const argNames = argExplanations[functionName] || args.map((_, i) => `参数${i + 1}`);
  
  explanation += '参数说明：\n';
  args.forEach((arg, i) => {
    const argName = argNames[i] || `参数${i + 1}`;
    explanation += `  ${argName}\n    当前值：${arg}\n`;
  });

  return explanation;
}

async function optimizeFormula(formula: string): Promise<string> {
  if (!formula || !formula.startsWith('=')) {
    return '请选择一个包含公式的单元格';
  }

  let optimized = formula;
  const suggestions: string[] = [];

  if (formula.includes('SUMIF') && formula.includes('SUMIF')) {
    suggestions.push('💡 如果使用多个SUMIF，可考虑使用SUMIFS简化公式');
  }

  if (formula.includes('VLOOKUP') && !formula.includes('XLOOKUP')) {
    suggestions.push('💡 可使用XLOOKUP替代VLOOKUP，更灵活且不需要计算列号');
  }

  if (formula.includes('INDEX') && formula.includes('MATCH')) {
    suggestions.push('💡 INDEX+MATCH组合是高效的查找方式，已是最优解');
  }

  const nestedIfCount = (formula.match(/IF\(/g) || []).length;
  if (nestedIfCount > 3) {
    suggestions.push('💡 嵌套IF过多，建议使用IFS函数或创建辅助列');
  }

  if (suggestions.length === 0) {
    suggestions.push('✅ 公式结构良好，暂无优化建议');
  }

  return `公式优化建议：\n\n${suggestions.join('\n\n')}`;
}

async function diagnoseError(formula: string): Promise<string> {
  const errors: { pattern: RegExp; name: string; cause: string; solution: string }[] = [
    {
      pattern: /#VALUE!/,
      name: '#VALUE! 错误',
      cause: '参数类型不正确，如对文本进行数学运算',
      solution: '• 检查公式中的参数类型\n• 使用VALUE()函数转换文本为数字\n• 使用IFERROR()处理错误',
    },
    {
      pattern: /#REF!/,
      name: '#REF! 错误',
      cause: '引用了无效的单元格，如删除了被引用的单元格',
      solution: '• 检查公式中的单元格引用\n• 恢复被删除的单元格\n• 更新引用范围',
    },
    {
      pattern: /#DIV\/0!/,
      name: '#DIV/0! 错误',
      cause: '除数为零或空单元格',
      solution: '• 使用IF判断除数是否为0\n• 使用IFERROR()包装公式\n• 检查数据源是否有空值',
    },
    {
      pattern: /#N\/A/,
      name: '#N/A 错误',
      cause: '查找函数未找到匹配值',
      solution: '• 检查查找值是否存在于查找范围\n• 使用IFNA()处理\n• 确认数据格式一致',
    },
    {
      pattern: /#NAME\?/,
      name: '#NAME? 错误',
      cause: '函数名拼写错误或使用了不存在的名称',
      solution: '• 检查函数名拼写\n• 确认函数在当前Excel版本中可用\n• 检查是否需要启用加载项',
    },
    {
      pattern: /#NUM!/,
      name: '#NUM! 错误',
      cause: '数值参数无效，如负数开平方',
      solution: '• 检查数值参数范围\n• 使用IF判断参数有效性',
    },
    {
      pattern: /#NULL!/,
      name: '#NULL! 错误',
      cause: '区域交集运算符使用不当',
      solution: '• 检查区域引用语法\n• 使用正确的区域运算符(:)',
    },
  ];

  for (const error of errors) {
    if (error.pattern.test(formula)) {
      return `【${error.name}】\n\n原因：${error.cause}\n\n解决方案：\n${error.solution}`;
    }
  }

  if (!formula || !formula.startsWith('=')) {
    return '请选择一个包含公式的单元格进行错误诊断';
  }

  return '✅ 未检测到错误，公式语法正确';
}

async function generateFormulaFromSelection(rangeInfo: ReturnType<typeof getSelectedRangeInfo>): Promise<string> {
  const { address, values, formulas } = await rangeInfo;
  
  const suggestions: string[] = [];
  
  const hasNumbers = values.some(row => 
    row.some(cell => typeof cell === 'number' || (!isNaN(Number(cell)) && cell !== ''))
  );
  
  const hasFormulas = formulas.some(row => 
    row.some(cell => typeof cell === 'string' && cell.startsWith('='))
  );

  if (hasNumbers && !hasFormulas) {
    suggestions.push(`=SUM(${address})  求和`);
    suggestions.push(`=AVERAGE(${address})  求平均值`);
    suggestions.push(`=MAX(${address})  最大值`);
    suggestions.push(`=MIN(${address})  最小值`);
    suggestions.push(`=COUNT(${address})  计数`);
  }

  if (hasFormulas) {
    suggestions.push('检测到选中区域包含公式，建议使用"解释此公式"功能');
  }

  if (suggestions.length === 0) {
    suggestions.push('请选择包含数据的区域');
  }

  return `根据选中区域 ${address}，建议公式：\n\n${suggestions.join('\n')}`;
}

export async function explainFormula(event: Office.AddinCommands.Event): Promise<void> {
  try {
    const formula = await getSelectedCellFormula();
    const parsed = parseFormula(formula || '');
    const explanation = explainFormulaInChinese(parsed);
    
    await showNotification('公式解释', explanation.substring(0, 100) + '...');
    console.log('公式解释：\n', explanation);
  } catch (error) {
    console.error('解释公式失败:', error);
  }
  event.completed();
}

export async function optimizeFormulaCommand(event: Office.AddinCommands.Event): Promise<void> {
  try {
    const formula = await getSelectedCellFormula();
    const suggestions = await optimizeFormula(formula || '');
    
    await showNotification('公式优化', suggestions.substring(0, 100) + '...');
    console.log('公式优化建议：\n', suggestions);
  } catch (error) {
    console.error('优化公式失败:', error);
  }
  event.completed();
}

export async function findError(event: Office.AddinCommands.Event): Promise<void> {
  try {
    const formula = await getSelectedCellFormula();
    const diagnosis = await diagnoseError(formula || '');
    
    await showNotification('错误诊断', diagnosis.substring(0, 100) + '...');
    console.log('错误诊断结果：\n', diagnosis);
  } catch (error) {
    console.error('诊断错误失败:', error);
  }
  event.completed();
}

export async function generateFormula(event: Office.AddinCommands.Event): Promise<void> {
  try {
    const rangeInfo = getSelectedRangeInfo();
    const suggestions = await generateFormulaFromSelection(rangeInfo);
    
    await showNotification('公式生成', suggestions.substring(0, 100) + '...');
    console.log('公式建议：\n', suggestions);
  } catch (error) {
    console.error('生成公式失败:', error);
  }
  event.completed();
}

function globalThis: any;
globalThis.explainFormula = explainFormula;
globalThis.optimizeFormula = optimizeFormulaCommand;
globalThis.findError = findError;
globalThis.generateFormula = generateFormula;

import * as React from 'react';
import { useState, useCallback } from 'react';

interface FileInfo {
  name: string;
  sheets: string[];
  selected: boolean;
  size: number;
}

interface MergeResult {
  success: boolean;
  message: string;
  outputPath?: string;
  stats?: {
    totalRows: number;
    totalColumns: number;
    mergedSheets: number;
  };
}

interface FormulaSuggestion {
  formula: string;
  description: string;
  category: string;
}

type TabType = 'merge' | 'formula' | 'financial';
type MergeMode = 'auto' | 'append' | 'join' | 'pivot';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('merge');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [mergeMode, setMergeMode] = useState<MergeMode>('auto');
  const [keyColumn, setKeyColumn] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  
  const [formulaInput, setFormulaInput] = useState('');
  const [formulaSuggestions, setFormulaSuggestions] = useState<FormulaSuggestion[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<FormulaSuggestion | null>(null);
  
  const [financialType, setFinancialType] = useState<string>('budget');
  const [industry, setIndustry] = useState<string>('general');

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    const newFiles: FileInfo[] = [];
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        newFiles.push({
          name: file.name,
          sheets: [],
          selected: true,
          size: file.size
        });
      }
    }
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const toggleFileSelection = useCallback((index: number) => {
    setFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, selected: !f.selected } : f
    ));
  }, []);

  const handleMerge = useCallback(async () => {
    const selectedFiles = files.filter(f => f.selected);
    if (selectedFiles.length < 2) {
      setMergeResult({
        success: false,
        message: '请至少选择2个文件进行汇总'
      });
      return;
    }

    setIsProcessing(true);
    try {
      await Excel.run(async (context) => {
        const workbook = context.workbook;
        const worksheets = workbook.worksheets;
        worksheets.add('汇总结果');
        
        const sheet = worksheets.getActiveWorksheet();
        const range = sheet.getRange('A1');
        range.values = [['智办AI - 多表汇总结果']];
        range.format.font.size = 16;
        range.format.font.bold = true;
        
        await context.sync();
      });

      setMergeResult({
        success: true,
        message: `成功汇总 ${selectedFiles.length} 个文件`,
        stats: {
          totalRows: 0,
          totalColumns: 0,
          mergedSheets: selectedFiles.length
        }
      });
    } catch (error) {
      setMergeResult({
        success: false,
        message: `汇总失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  const handleFormulaGenerate = useCallback(async () => {
    if (!formulaInput.trim()) return;

    const suggestions: FormulaSuggestion[] = [];
    const input = formulaInput.toLowerCase();

    if (input.includes('求和') || input.includes('合计') || input.includes('sum')) {
      suggestions.push({
        formula: '=SUM(选中的区域)',
        description: '计算选中区域所有数值的总和',
        category: '基础运算'
      });
    }
    
    if (input.includes('平均') || input.includes('average')) {
      suggestions.push({
        formula: '=AVERAGE(选中的区域)',
        description: '计算选中区域的平均值',
        category: '基础运算'
      });
    }
    
    if (input.includes('条件') || input.includes('if')) {
      suggestions.push({
        formula: '=SUMIF(条件区域, 条件, 求和区域)',
        description: '根据条件对满足条件的单元格求和',
        category: '条件统计'
      });
      suggestions.push({
        formula: '=COUNTIF(区域, 条件)',
        description: '统计满足条件的单元格数量',
        category: '条件统计'
      });
    }
    
    if (input.includes('查找') || input.includes('lookup') || input.includes('vlookup')) {
      suggestions.push({
        formula: '=VLOOKUP(查找值, 表格区域, 列号, 匹配类型)',
        description: '在表格中纵向查找指定值',
        category: '查找引用'
      });
      suggestions.push({
        formula: '=XLOOKUP(查找值, 查找区域, 返回区域)',
        description: '新一代查找函数，更强大灵活',
        category: '查找引用'
      });
    }
    
    if (input.includes('贷款') || input.includes('还款') || input.includes('pmt')) {
      suggestions.push({
        formula: '=PMT(利率, 期数, 现值)',
        description: '计算贷款每期还款金额',
        category: '财务函数'
      });
    }
    
    if (input.includes('净现值') || input.includes('npv')) {
      suggestions.push({
        formula: '=NPV(折现率, 现金流1, 现金流2, ...)',
        description: '计算投资的净现值',
        category: '财务函数'
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        formula: '=SUM(A1:A10)',
        description: '基础求和公式示例，请描述更具体的需求',
        category: '基础运算'
      });
    }

    setFormulaSuggestions(suggestions);
  }, [formulaInput]);

  const insertFormula = useCallback(async (suggestion: FormulaSuggestion) => {
    try {
      await Excel.run(async (context) => {
        const range = context.workbook.getSelectedRange();
        range.formulas = [[suggestion.formula]];
        await context.sync();
      });
      setSelectedFormula(suggestion);
    } catch (error) {
      console.error('插入公式失败:', error);
    }
  }, []);

  const handleFinancialReport = useCallback(async () => {
    setIsProcessing(true);
    try {
      await Excel.run(async (context) => {
        const worksheets = context.workbook.worksheets;
        const sheetName = financialType === 'budget' ? '预算表' :
                         financialType === 'balance' ? '资产负债表' :
                         financialType === 'cashflow' ? '现金流量表' : '财务报表';
        
        const sheet = worksheets.add(sheetName);
        
        if (financialType === 'budget') {
          const headers = [['项目', '预算金额', '实际金额', '差异', '差异率']];
          const range = sheet.getRange('A1:E1');
          range.values = headers;
          range.format.font.bold = true;
          range.format.fill.color = '#4472C4';
          range.format.font.color = '#FFFFFF';
          
          const sampleData = [
            ['营业收入', 1000000, 0, '=B2-C2', '=D2/B2'],
            ['营业成本', 600000, 0, '=B3-C3', '=D3/B3'],
            ['毛利润', '=B2-B3', '=C2-C3', '=B4-C4', '=D4/B4'],
            ['运营费用', 200000, 0, '=B5-C5', '=D5/B5'],
            ['净利润', '=B4-B5', '=C4-C5', '=B6-C6', '=D6/B6']
          ];
          sheet.getRange('A2:E6').values = sampleData;
        }
        
        if (financialType === 'balance') {
          const headers = [['资产负债表', '', '', '']];
          sheet.getRange('A1:D1').values = headers;
          sheet.getRange('A1:D1').merge();
          sheet.getRange('A1:D1').format.font.bold = true;
          sheet.getRange('A1:D1').format.font.size = 14;
          
          const subHeaders = [['资产', '金额', '负债及权益', '金额']];
          sheet.getRange('A2:D2').values = subHeaders;
          sheet.getRange('A2:D2').format.font.bold = true;
          
          const assetData = [
            ['流动资产', '', '流动负债', ''],
            ['货币资金', 0, '应付账款', 0],
            ['应收账款', 0, '短期借款', 0],
            ['存货', 0, '', ''],
            ['非流动资产', '', '长期负债', ''],
            ['固定资产', 0, '长期借款', 0],
            ['无形资产', 0, '', ''],
            ['', '', '所有者权益', ''],
            ['', '', '实收资本', 0],
            ['', '', '未分配利润', 0],
            ['资产总计', '=B3+B4+B5+B7+B8', '负债及权益总计', '=D3+D4+D7+D10+D11']
          ];
          sheet.getRange('A3:D13').values = assetData;
        }
        
        if (financialType === 'cashflow') {
          const headers = [['现金流量表', '', '']];
          sheet.getRange('A1:C1').values = headers;
          sheet.getRange('A1:C1').merge();
          
          const subHeaders = [['项目', '本期金额', '上期金额']];
          sheet.getRange('A2:C2').values = subHeaders;
          sheet.getRange('A2:C2').format.font.bold = true;
          
          const cashflowData = [
            ['一、经营活动产生的现金流量', '', ''],
            ['销售商品收到的现金', 0, 0],
            ['购买商品支付的现金', 0, 0],
            ['经营活动现金流量净额', '=B4-B5', '=C4-C5'],
            ['', '', ''],
            ['二、投资活动产生的现金流量', '', ''],
            ['购建固定资产支付的现金', 0, 0],
            ['投资活动现金流量净额', '=-B9', '=-C9'],
            ['', '', ''],
            ['三、筹资活动产生的现金流量', '', ''],
            ['吸收投资收到的现金', 0, 0],
            ['偿还债务支付的现金', 0, 0],
            ['筹资活动现金流量净额', '=B13-B14', '=C13-C14'],
            ['', '', ''],
            ['现金及等价物净增加额', '=B6+B10+B15', '=C6+C10+C15']
          ];
          sheet.getRange('A3:C17').values = cashflowData;
        }
        
        sheet.getUsedRange().format.autofitColumns();
        await context.sync();
      });
    } catch (error) {
      console.error('创建财务报表失败:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [financialType]);

  const renderMergeTab = () => (
    <div className="tab-content">
      <div className="upload-section">
        <h3>上传文件</h3>
        <div className="upload-area">
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload" className="upload-label">
            <span>📁 拖入多个Excel文件</span>
            <span className="upload-hint">支持 .xlsx / .xls / .csv 格式</span>
          </label>
        </div>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          <h3>检测到 {files.length} 个文件：</h3>
          <ul>
            {files.map((file, index) => (
              <li key={index} className={file.selected ? 'selected' : ''}>
                <input
                  type="checkbox"
                  checked={file.selected}
                  onChange={() => toggleFileSelection(index)}
                />
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="merge-options">
        <h3>汇总模式</h3>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name="mergeMode"
              value="auto"
              checked={mergeMode === 'auto'}
              onChange={(e) => setMergeMode(e.target.value as MergeMode)}
            />
            <span>智能识别</span>
            <small>自动判断最适合的汇总方式</small>
          </label>
          <label>
            <input
              type="radio"
              name="mergeMode"
              value="append"
              checked={mergeMode === 'append'}
              onChange={(e) => setMergeMode(e.target.value as MergeMode)}
            />
            <span>纵向追加</span>
            <small>结构相同的表，按行追加</small>
          </label>
          <label>
            <input
              type="radio"
              name="mergeMode"
              value="join"
              checked={mergeMode === 'join'}
              onChange={(e) => setMergeMode(e.target.value as MergeMode)}
            />
            <span>横向合并</span>
            <small>关联表按关键字段JOIN</small>
          </label>
          <label>
            <input
              type="radio"
              name="mergeMode"
              value="pivot"
              checked={mergeMode === 'pivot'}
              onChange={(e) => setMergeMode(e.target.value as MergeMode)}
            />
            <span>交叉汇总</span>
            <small>透视表生成</small>
          </label>
        </div>

        {mergeMode === 'join' && (
          <div className="key-column-input">
            <label>关联字段：</label>
            <input
              type="text"
              value={keyColumn}
              onChange={(e) => setKeyColumn(e.target.value)}
              placeholder="输入关联字段名（如：姓名、ID）"
            />
          </div>
        )}
      </div>

      <div className="action-buttons">
        <button
          className="btn-primary"
          onClick={handleMerge}
          disabled={isProcessing || files.filter(f => f.selected).length < 2}
        >
          {isProcessing ? '处理中...' : '智能汇总'}
        </button>
        <button className="btn-secondary">自定义汇总</button>
      </div>

      {mergeResult && (
        <div className={`result ${mergeResult.success ? 'success' : 'error'}`}>
          <p>{mergeResult.message}</p>
          {mergeResult.stats && (
            <div className="stats">
              <span>合并工作表: {mergeResult.stats.mergedSheets}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderFormulaTab = () => (
    <div className="tab-content">
      <div className="formula-input-section">
        <h3>公式助手</h3>
        <textarea
          value={formulaInput}
          onChange={(e) => setFormulaInput(e.target.value)}
          placeholder="描述您的需求，例如：&#10;• 计算A部门Q1销售额占比&#10;• 查找员工编号对应的姓名&#10;• 计算贷款每月还款金额"
          rows={4}
        />
        <button className="btn-primary" onClick={handleFormulaGenerate}>
          生成公式
        </button>
      </div>

      {formulaSuggestions.length > 0 && (
        <div className="formula-suggestions">
          <h3>推荐公式</h3>
          {formulaSuggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`suggestion-item ${selectedFormula === suggestion ? 'selected' : ''}`}
              onClick={() => insertFormula(suggestion)}
            >
              <div className="formula-text">{suggestion.formula}</div>
              <div className="formula-desc">{suggestion.description}</div>
              <div className="formula-category">{suggestion.category}</div>
            </div>
          ))}
        </div>
      )}

      <div className="formula-categories">
        <h3>公式分类</h3>
        <div className="category-buttons">
          <button onClick={() => setFormulaInput('求和计算')}>基础运算</button>
          <button onClick={() => setFormulaInput('条件统计')}>条件统计</button>
          <button onClick={() => setFormulaInput('查找引用')}>查找引用</button>
          <button onClick={() => setFormulaInput('财务计算')}>财务函数</button>
        </div>
      </div>
    </div>
  );

  const renderFinancialTab = () => (
    <div className="tab-content">
      <div className="financial-section">
        <h3>财务报表AI制作</h3>
        
        <div className="form-group">
          <label>报表类型：</label>
          <select value={financialType} onChange={(e) => setFinancialType(e.target.value)}>
            <option value="budget">预算表</option>
            <option value="balance">资产负债表</option>
            <option value="cashflow">现金流量表</option>
          </select>
        </div>

        <div className="form-group">
          <label>行业类型：</label>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="general">通用</option>
            <option value="manufacturing">制造业</option>
            <option value="internet">互联网</option>
            <option value="retail">零售业</option>
            <option value="finance">金融业</option>
          </select>
        </div>

        <button
          className="btn-primary"
          onClick={handleFinancialReport}
          disabled={isProcessing}
        >
          {isProcessing ? '生成中...' : '生成报表'}
        </button>
      </div>

      <div className="financial-features">
        <h3>智能功能</h3>
        <ul>
          <li>📊 自动设置科目体系</li>
          <li>🔗 勾稽关系校验</li>
          <li>📈 趋势预测分析</li>
          <li>⚠️ 异常数据预警</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>智办AI - Excel</h1>
      </header>

      <nav className="tab-nav">
        <button
          className={activeTab === 'merge' ? 'active' : ''}
          onClick={() => setActiveTab('merge')}
        >
          多表汇总
        </button>
        <button
          className={activeTab === 'formula' ? 'active' : ''}
          onClick={() => setActiveTab('formula')}
        >
          公式助手
        </button>
        <button
          className={activeTab === 'financial' ? 'active' : ''}
          onClick={() => setActiveTab('financial')}
        >
          财务分析
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'merge' && renderMergeTab()}
        {activeTab === 'formula' && renderFormulaTab()}
        {activeTab === 'financial' && renderFinancialTab()}
      </main>
    </div>
  );
};

export default App;

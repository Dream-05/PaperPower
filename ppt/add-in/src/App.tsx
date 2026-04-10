import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';

interface Asset {
  id: string;
  url: string;
  thumbnail: string;
  type: string;
  selected: boolean;
  usage?: string;
}

interface PagePreview {
  index: number;
  title: string;
  type: string;
  thumbnail?: string;
}

type StepType = 'input' | 'assets' | 'preview' | 'complete';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<StepType>('input');
  const [userInput, setUserInput] = useState('');
  const [style, setStyle] = useState('tech');
  const [pageCount, setPageCount] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [generatedPath, setGeneratedPath] = useState('');

  const styles = [
    { id: 'tech', name: '科技风', color: '#2196F3' },
    { id: 'business', name: '商务风', color: '#FF5722' },
    { id: 'minimal', name: '极简风', color: '#607D8B' },
    { id: 'creative', name: '创意风', color: '#9C27B0' },
    { id: 'academic', name: '学术风', color: '#4CAF50' },
  ];

  const handleGenerate = useCallback(async () => {
    if (!userInput.trim()) return;
    
    setIsProcessing(true);
    
    try {
      await PowerPoint.run(async (context) => {
        const presentation = context.presentation;
        const slides = presentation.slides;
        
        const slide = slides.add();
        const titleShape = slide.shapes.addTextBox(50, 50, 600, 100);
        titleShape.textFrame.textRange.text = userInput;
        titleShape.textFrame.textRange.font.size = 36;
        titleShape.textFrame.textRange.font.bold = true;
        
        await context.sync();
      });
      
      const mockAssets: Asset[] = Array.from({ length: 12 }, (_, i) => ({
        id: `asset_${i}`,
        url: `https://picsum.photos/800/600?random=${i}`,
        thumbnail: `https://picsum.photos/200/150?random=${i}`,
        type: i < 4 ? 'background' : i < 8 ? 'photo' : 'icon',
        selected: false,
      }));
      
      setSearchResults(mockAssets);
      setSearchKeyword(userInput.split(' ').slice(0, 3).join(' '));
      setCurrentStep('assets');
      
    } catch (error) {
      console.error('生成失败:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [userInput]);

  const toggleAssetSelection = useCallback((asset: Asset) => {
    setSearchResults(prev => prev.map(a => 
      a.id === asset.id ? { ...a, selected: !a.selected } : a
    ));
    
    setSelectedAssets(prev => {
      if (prev.find(a => a.id === asset.id)) {
        return prev.filter(a => a.id !== asset.id);
      }
      return [...prev, asset];
    });
  }, []);

  const handleSearchMore = useCallback(async () => {
    setIsProcessing(true);
    
    const newAssets: Asset[] = Array.from({ length: 8 }, (_, i) => ({
      id: `asset_new_${Date.now()}_${i}`,
      url: `https://picsum.photos/800/600?random=${Date.now() + i}`,
      thumbnail: `https://picsum.photos/200/150?random=${Date.now() + i}`,
      type: 'photo',
      selected: false,
    }));
    
    setSearchResults(prev => [...prev, ...newAssets]);
    setIsProcessing(false);
  }, []);

  const handleConfirmAssets = useCallback(async () => {
    setIsProcessing(true);
    
    const mockPages: PagePreview[] = [
      { index: 0, title: '封面', type: 'cover' },
      { index: 1, title: '目录', type: 'toc' },
      { index: 2, title: '背景介绍', type: 'content' },
      { index: 3, title: '核心内容', type: 'content' },
      { index: 4, title: '详细说明', type: 'content' },
      { index: 5, title: '案例分析', type: 'content' },
      { index: 6, title: '总结展望', type: 'content' },
      { index: 7, title: '封底', type: 'end' },
    ];
    
    setPages(mockPages);
    setCurrentStep('preview');
    setIsProcessing(false);
  }, [selectedAssets]);

  const handleRegeneratePage = useCallback((pageIndex: number) => {
    console.log(`重新生成第 ${pageIndex + 1} 页`);
  }, []);

  const handleFinalGenerate = useCallback(async () => {
    setIsProcessing(true);
    
    try {
      setGeneratedPath(`/output/ppt/${userInput.replace(/\s+/g, '_')}.pptx`);
      setCurrentStep('complete');
    } finally {
      setIsProcessing(false);
    }
  }, [userInput]);

  const handleUploadImage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const newAsset: Asset = {
        id: `upload_${Date.now()}_${file.name}`,
        url: URL.createObjectURL(file),
        thumbnail: URL.createObjectURL(file),
        type: 'photo',
        selected: true,
      };
      
      setSelectedAssets(prev => [...prev, newAsset]);
    });
  }, []);

  const renderStepIndicator = () => (
    <div className="step-indicator">
      {['input', 'assets', 'preview', 'complete'].map((step, index) => (
        <div
          key={step}
          className={`step ${currentStep === step ? 'active' : ''} ${
            ['input', 'assets', 'preview', 'complete'].indexOf(currentStep) > index ? 'completed' : ''
          }`}
        >
          <div className="step-number">{index + 1}</div>
          <div className="step-label">
            {step === 'input' && '输入需求'}
            {step === 'assets' && '选择素材'}
            {step === 'preview' && '预览调整'}
            {step === 'complete' && '生成完成'}
          </div>
        </div>
      ))}
    </div>
  );

  const renderInputStep = () => (
    <div className="step-content">
      <div className="input-section">
        <h3>描述您的PPT需求</h3>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="例如：科技风项目介绍PPT，包含背景、解决方案、技术优势、团队介绍等内容"
          rows={4}
        />
      </div>

      <div className="style-section">
        <h3>选择风格</h3>
        <div className="style-options">
          {styles.map((s) => (
            <div
              key={s.id}
              className={`style-option ${style === s.id ? 'selected' : ''}`}
              onClick={() => setStyle(s.id)}
            >
              <div className="style-preview" style={{ backgroundColor: s.color }} />
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="options-section">
        <h3>其他选项</h3>
        <div className="option-row">
          <label>页数：</label>
          <input
            type="number"
            value={pageCount}
            onChange={(e) => setPageCount(parseInt(e.target.value) || 10)}
            min={5}
            max={50}
          />
          <span className="hint">（建议8-15页）</span>
        </div>
      </div>

      <button
        className="btn-primary btn-large"
        onClick={handleGenerate}
        disabled={isProcessing || !userInput.trim()}
      >
        {isProcessing ? '处理中...' : '开始生成'}
      </button>
    </div>
  );

  const renderAssetsStep = () => (
    <div className="step-content">
      <div className="search-info">
        <h3>已搜索 "{searchKeyword}"</h3>
        <p>找到 {searchResults.length} 张相关素材</p>
      </div>

      <div className="asset-grid">
        {searchResults.map((asset) => (
          <div
            key={asset.id}
            className={`asset-card ${asset.selected ? 'selected' : ''}`}
            onClick={() => toggleAssetSelection(asset)}
          >
            <img src={asset.thumbnail} alt="" />
            {asset.selected && <div className="selected-badge">✓</div>}
            <div className="asset-type">{asset.type}</div>
          </div>
        ))}
      </div>

      <div className="upload-section">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleUploadImage}
          style={{ display: 'none' }}
          id="image-upload"
        />
        <label htmlFor="image-upload" className="btn-secondary">
          + 上传本地图片
        </label>
      </div>

      <div className="selection-summary">
        <p>已选 {selectedAssets.length} 张素材</p>
        {selectedAssets.length > 0 && (
          <div className="usage-suggestion">
            <p>预计用于：</p>
            <ul>
              {selectedAssets.slice(0, 3).map((asset, i) => (
                <li key={asset.id}>
                  {i === 0 && '封面背景'}
                  {i === 1 && '内容页配图'}
                  {i === 2 && '数据展示页'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="action-buttons">
        <button className="btn-secondary" onClick={() => setCurrentStep('input')}>
          返回修改
        </button>
        <button className="btn-secondary" onClick={handleSearchMore} disabled={isProcessing}>
          搜索更多
        </button>
        <button
          className="btn-primary"
          onClick={handleConfirmAssets}
          disabled={isProcessing || selectedAssets.length === 0}
        >
          确认素材
        </button>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="step-content">
      <div className="preview-header">
        <h3>PPT预览</h3>
        <p>共 {pages.length} 页，点击页面可重新生成</p>
      </div>

      <div className="page-grid">
        {pages.map((page) => (
          <div
            key={page.index}
            className="page-card"
            onClick={() => handleRegeneratePage(page.index)}
          >
            <div className="page-thumbnail">
              <div className="page-placeholder">
                {page.type === 'cover' && '封面'}
                {page.type === 'toc' && '目录'}
                {page.type === 'content' && '内容'}
                {page.type === 'end' && '封底'}
              </div>
            </div>
            <div className="page-info">
              <span className="page-number">第 {page.index + 1} 页</span>
              <span className="page-title">{page.title}</span>
            </div>
            <button className="btn-regenerate">重新生成</button>
          </div>
        ))}
      </div>

      <div className="style-switch">
        <label>切换风格：</label>
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="action-buttons">
        <button className="btn-secondary" onClick={() => setCurrentStep('assets')}>
          返回修改素材
        </button>
        <button
          className="btn-primary btn-large"
          onClick={handleFinalGenerate}
          disabled={isProcessing}
        >
          {isProcessing ? '生成中...' : '生成PPT'}
        </button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="step-content complete-step">
      <div className="success-icon">✓</div>
      <h2>PPT生成完成！</h2>
      <p className="file-path">{generatedPath}</p>

      <div className="stats">
        <div className="stat-item">
          <span className="stat-value">{pages.length}</span>
          <span className="stat-label">页数</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{selectedAssets.length}</span>
          <span className="stat-label">素材</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{styles.find(s => s.id === style)?.name}</span>
          <span className="stat-label">风格</span>
        </div>
      </div>

      <div className="action-buttons">
        <button className="btn-secondary" onClick={() => setCurrentStep('input')}>
          创建新PPT
        </button>
        <button className="btn-primary">
          打开文件
        </button>
      </div>

      <div className="feedback-section">
        <p>对生成的PPT满意吗？</p>
        <div className="feedback-buttons">
          <button className="feedback-btn">👍 满意</button>
          <button className="feedback-btn">👎 需改进</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>智办AI - PPT智能生成</h1>
      </header>

      {renderStepIndicator()}

      <main className="main-content">
        {currentStep === 'input' && renderInputStep()}
        {currentStep === 'assets' && renderAssetsStep()}
        {currentStep === 'preview' && renderPreviewStep()}
        {currentStep === 'complete' && renderCompleteStep()}
      </main>
    </div>
  );
};

export default App;

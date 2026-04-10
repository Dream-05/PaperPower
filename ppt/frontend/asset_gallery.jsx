import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';

interface Asset {
  id: string;
  url: string;
  thumbnail: string;
  type: 'background' | 'photo' | 'icon' | 'illustration';
  style: string;
  width: number;
  height: number;
  tags: string[];
  qualityScore: number;
  usageCount: number;
  selected: boolean;
  recommendedUsage?: string;
}

interface AssetGalleryProps {
  keywords: string[];
  style: string;
  onSelectionChange: (selectedAssets: Asset[]) => void;
  maxSelection?: number;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'relevance' | 'quality' | 'popularity' | 'newest';
type FilterType = 'all' | 'background' | 'photo' | 'icon' | 'illustration';

const AssetGallery: React.FC<AssetGalleryProps> = ({
  keywords,
  style,
  onSelectionChange,
  maxSelection = 10,
}) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  useEffect(() => {
    loadAssets();
  }, [keywords, style]);

  useEffect(() => {
    filterAndSortAssets();
  }, [assets, filterType, sortBy, searchQuery]);

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    
    const mockAssets: Asset[] = Array.from({ length: 24 }, (_, i) => ({
      id: `asset_${i}`,
      url: `https://picsum.photos/800/600?random=${i}`,
      thumbnail: `https://picsum.photos/200/150?random=${i}`,
      type: i < 6 ? 'background' : i < 14 ? 'photo' : i < 20 ? 'icon' : 'illustration',
      style: style,
      width: 800,
      height: 600,
      tags: keywords.slice(0, 3),
      qualityScore: Math.random() * 0.5 + 0.5,
      usageCount: Math.floor(Math.random() * 100),
      selected: false,
      recommendedUsage: i < 6 ? '封面背景' : i < 10 ? '内容配图' : '图标装饰',
    }));
    
    setAssets(mockAssets);
    setIsLoading(false);
  }, [keywords, style]);

  const filterAndSortAssets = useCallback(() => {
    let result = [...assets];
    
    if (filterType !== 'all') {
      result = result.filter(a => a.type === filterType);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    
    switch (sortBy) {
      case 'quality':
        result.sort((a, b) => b.qualityScore - a.qualityScore);
        break;
      case 'popularity':
        result.sort((a, b) => b.usageCount - a.usageCount);
        break;
      case 'newest':
        result.sort((a, b) => b.id.localeCompare(a.id));
        break;
      default:
        break;
    }
    
    setFilteredAssets(result);
  }, [assets, filterType, sortBy, searchQuery]);

  const toggleSelection = useCallback((asset: Asset) => {
    const isSelected = selectedAssets.find(a => a.id === asset.id);
    
    if (isSelected) {
      const newSelected = selectedAssets.filter(a => a.id !== asset.id);
      setSelectedAssets(newSelected);
      onSelectionChange(newSelected);
    } else {
      if (selectedAssets.length >= maxSelection) {
        alert(`最多选择 ${maxSelection} 张素材`);
        return;
      }
      const newSelected = [...selectedAssets, asset];
      setSelectedAssets(newSelected);
      onSelectionChange(newSelected);
    }
    
    setAssets(prev => prev.map(a => ({
      ...a,
      selected: a.id === asset.id ? !a.selected : a.selected,
    })));
  }, [selectedAssets, maxSelection, onSelectionChange]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const newAsset: Asset = {
        id: `upload_${Date.now()}_${file.name}`,
        url: URL.createObjectURL(file),
        thumbnail: URL.createObjectURL(file),
        type: 'photo',
        style: style,
        width: 800,
        height: 600,
        tags: ['用户上传'],
        qualityScore: 0.8,
        usageCount: 0,
        selected: true,
      };
      
      setAssets(prev => [newAsset, ...prev]);
      setSelectedAssets(prev => [...prev, newAsset]);
      onSelectionChange([...selectedAssets, newAsset]);
    });
  }, [style, selectedAssets, onSelectionChange]);

  const renderAssetCard = (asset: Asset) => {
    const isSelected = selectedAssets.find(a => a.id === asset.id);
    
    return (
      <div
        key={asset.id}
        className={`asset-card ${isSelected ? 'selected' : ''}`}
        onClick={() => toggleSelection(asset)}
        onMouseEnter={() => setPreviewAsset(asset)}
        onMouseLeave={() => setPreviewAsset(null)}
      >
        <img src={asset.thumbnail} alt="" loading="lazy" />
        
        {isSelected && (
          <div className="selection-overlay">
            <span className="check-mark">✓</span>
          </div>
        )}
        
        <div className="asset-meta">
          <span className="asset-type">{asset.type}</span>
          <span className="quality-score">{(asset.qualityScore * 100).toFixed(0)}%</span>
        </div>
        
        {asset.recommendedUsage && (
          <div className="recommended-usage">
            推荐：{asset.recommendedUsage}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="asset-gallery">
      <div className="gallery-header">
        <div className="search-bar">
          <input
            type="text"
            placeholder="搜索素材..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)}>
            <option value="all">全部类型</option>
            <option value="background">背景</option>
            <option value="photo">照片</option>
            <option value="icon">图标</option>
            <option value="illustration">插画</option>
          </select>
          
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="relevance">相关度</option>
            <option value="quality">质量评分</option>
            <option value="popularity">使用次数</option>
            <option value="newest">最新添加</option>
          </select>
          
          <div className="view-toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              ⊞
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              ☰
            </button>
          </div>
        </div>
      </div>
      
      <div className="upload-area">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleUpload}
          style={{ display: 'none' }}
          id="asset-upload"
        />
        <label htmlFor="asset-upload" className="upload-btn">
          + 上传本地图片
        </label>
      </div>
      
      <div className="selection-info">
        已选择 {selectedAssets.length} / {maxSelection} 张素材
      </div>
      
      {isLoading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>正在搜索素材...</p>
        </div>
      ) : (
        <div className={`assets-container ${viewMode}`}>
          {filteredAssets.map(renderAssetCard)}
        </div>
      )}
      
      {filteredAssets.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>未找到匹配的素材</p>
          <button onClick={loadAssets}>重新搜索</button>
        </div>
      )}
      
      {previewAsset && (
        <div className="preview-tooltip">
          <img src={previewAsset.url} alt="" />
          <div className="preview-info">
            <p>类型：{previewAsset.type}</p>
            <p>尺寸：{previewAsset.width} × {previewAsset.height}</p>
            <p>质量：{(previewAsset.qualityScore * 100).toFixed(0)}%</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetGallery;

import { useState, useEffect } from 'react'

export interface PageSetup {
  size: 'a4' | 'a3' | 'letter' | 'legal' | 'custom'
  orientation: 'portrait' | 'landscape'
  width: number
  height: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  header: number
  footer: number
  gutter: number
  mirrorMargins: boolean
}

export const pageSizes = [
  { id: 'a4', label: 'A4', width: 210, height: 297 },
  { id: 'a3', label: 'A3', width: 297, height: 420 },
  { id: 'letter', label: 'Letter', width: 216, height: 279 },
  { id: 'legal', label: 'Legal', width: 216, height: 356 },
  { id: 'custom', label: '自定义', width: 0, height: 0 },
]

export const marginPresets = [
  { id: 'normal', label: '普通', top: 25.4, bottom: 25.4, left: 31.7, right: 31.7 },
  { id: 'narrow', label: '窄', top: 12.7, bottom: 12.7, left: 12.7, right: 12.7 },
  { id: 'wide', label: '宽', top: 25, bottom: 25, left: 50, right: 50 },
  { id: 'custom', label: '自定义', top: 0, bottom: 0, left: 0, right: 0 },
]

export const defaultPageSetup: PageSetup = {
  size: 'a4',
  orientation: 'portrait',
  width: 210,
  height: 297,
  marginTop: 25.4,
  marginBottom: 25.4,
  marginLeft: 31.7,
  marginRight: 31.7,
  header: 12.7,
  footer: 12.7,
  gutter: 0,
  mirrorMargins: false
}

interface PageSetupDialogProps {
  isOpen: boolean
  onClose: () => void
  onApply: (setup: PageSetup) => void
  currentSetup?: PageSetup
}

export function PageSetupDialog({ isOpen, onClose, onApply, currentSetup = defaultPageSetup }: PageSetupDialogProps) {
  const [size, setSize] = useState(currentSetup.size)
  const [orientation, setOrientation] = useState(currentSetup.orientation)
  const [width, setWidth] = useState(currentSetup.width)
  const [height, setHeight] = useState(currentSetup.height)
  const [marginTop, setMarginTop] = useState(currentSetup.marginTop)
  const [marginBottom, setMarginBottom] = useState(currentSetup.marginBottom)
  const [marginLeft, setMarginLeft] = useState(currentSetup.marginLeft)
  const [marginRight, setMarginRight] = useState(currentSetup.marginRight)
  const [header, setHeader] = useState(currentSetup.header)
  const [footer, setFooter] = useState(currentSetup.footer)
  const [gutter, setGutter] = useState(currentSetup.gutter)
  const [mirrorMargins, setMirrorMargins] = useState(currentSetup.mirrorMargins)
  const [selectedMarginPreset, setSelectedMarginPreset] = useState('normal')
  const [activeTab, setActiveTab] = useState<'margins' | 'paper' | 'layout'>('margins')
  
  useEffect(() => {
    const preset = marginPresets.find(p => 
      p.top === marginTop && p.bottom === marginBottom && 
      p.left === marginLeft && p.right === marginRight
    )
    if (preset) {
      setSelectedMarginPreset(preset.id)
    }
  }, [marginTop, marginBottom, marginLeft, marginRight])
  
  const handleSizeChange = (sizeId: string) => {
    setSize(sizeId as PageSetup['size'])
    const pageSize = pageSizes.find(p => p.id === sizeId)
    if (pageSize && sizeId !== 'custom') {
      if (orientation === 'portrait') {
        setWidth(pageSize.width)
        setHeight(pageSize.height)
      } else {
        setWidth(pageSize.height)
        setHeight(pageSize.width)
      }
    }
  }
  
  const handleOrientationChange = (newOrientation: 'portrait' | 'landscape') => {
    setOrientation(newOrientation)
    const currentWidth = width
    const currentHeight = height
    setWidth(currentHeight)
    setHeight(currentWidth)
  }
  
  const handleMarginPresetChange = (presetId: string) => {
    setSelectedMarginPreset(presetId)
    const preset = marginPresets.find(p => p.id === presetId)
    if (preset && presetId !== 'custom') {
      setMarginTop(preset.top)
      setMarginBottom(preset.bottom)
      setMarginLeft(preset.left)
      setMarginRight(preset.right)
    }
  }
  
  const handleApply = () => {
    onApply({
      size,
      orientation,
      width,
      height,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      header,
      footer,
      gutter,
      mirrorMargins
    })
    onClose()
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[90vh] overflow-hidden">
        <div className="flex border-b">
          {[
            { id: 'margins', label: '页边距' },
            { id: 'paper', label: '纸张' },
            { id: 'layout', label: '版式' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-6 py-3 text-sm ${
                activeTab === tab.id 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'margins' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">页边距预设</label>
                <div className="grid grid-cols-4 gap-2">
                  {marginPresets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleMarginPresetChange(preset.id)}
                      className={`p-3 text-sm border rounded ${
                        selectedMarginPreset === preset.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">上边距</label>
                  <input
                    type="number"
                    value={marginTop}
                    onChange={e => setMarginTop(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">下边距</label>
                  <input
                    type="number"
                    value={marginBottom}
                    onChange={e => setMarginBottom(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">左边距</label>
                  <input
                    type="number"
                    value={marginLeft}
                    onChange={e => setMarginLeft(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">右边距</label>
                  <input
                    type="number"
                    value={marginRight}
                    onChange={e => setMarginRight(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">装订线</label>
                <input
                  type="number"
                  value={gutter}
                  onChange={e => setGutter(parseFloat(e.target.value) || 0)}
                  className="w-48 h-8 px-2 border border-gray-300 rounded text-sm"
                />
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mirrorMargins}
                  onChange={e => setMirrorMargins(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">对称页边距</span>
              </label>
            </div>
          )}
          
          {activeTab === 'paper' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">纸张大小</label>
                <div className="grid grid-cols-3 gap-2">
                  {pageSizes.map(pageSize => (
                    <button
                      key={pageSize.id}
                      onClick={() => handleSizeChange(pageSize.id)}
                      className={`p-3 text-sm border rounded ${
                        size === pageSize.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {pageSize.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {size === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">宽度</label>
                    <input
                      type="number"
                      value={width}
                      onChange={e => setWidth(parseFloat(e.target.value) || 0)}
                      className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">高度</label>
                    <input
                      type="number"
                      value={height}
                      onChange={e => setHeight(parseFloat(e.target.value) || 0)}
                      className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">方向</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleOrientationChange('portrait')}
                    className={`flex-1 p-4 border rounded flex flex-col items-center ${
                      orientation === 'portrait' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="w-8 h-12 border-2 border-gray-400 mb-2" />
                    <span className="text-sm">纵向</span>
                  </button>
                  <button
                    onClick={() => handleOrientationChange('landscape')}
                    className={`flex-1 p-4 border rounded flex flex-col items-center ${
                      orientation === 'landscape' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="w-12 h-8 border-2 border-gray-400 mb-2" />
                    <span className="text-sm">横向</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'layout' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">页眉</label>
                  <input
                    type="number"
                    value={header}
                    onChange={e => setHeader(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">页脚</label>
                  <input
                    type="number"
                    value={footer}
                    onChange={e => setFooter(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600 mb-2">预览</p>
                <div 
                  className="bg-white border mx-auto relative"
                  style={{
                    width: orientation === 'portrait' ? '120px' : '170px',
                    height: orientation === 'portrait' ? '170px' : '120px',
                    padding: `${marginTop / 5}px ${marginRight / 5}px ${marginBottom / 5}px ${marginLeft / 5}px`
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                    {size.toUpperCase()} {orientation === 'portrait' ? '纵向' : '横向'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

export function getPageStyle(setup: PageSetup): React.CSSProperties {
  return {
    width: `${setup.width}mm`,
    minHeight: `${setup.height}mm`,
    padding: `${setup.marginTop}mm ${setup.marginRight}mm ${setup.marginBottom}mm ${setup.marginLeft}mm`
  }
}

export function getPrintCSS(setup: PageSetup): string {
  return `
    @page {
      size: ${setup.width}mm ${setup.height}mm;
      margin: ${setup.marginTop}mm ${setup.marginRight}mm ${setup.marginBottom}mm ${setup.marginLeft}mm;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      
      .page {
        page-break-after: always;
        width: ${setup.width}mm;
        min-height: ${setup.height}mm;
        padding: ${setup.marginTop}mm ${setup.marginRight}mm ${setup.marginBottom}mm ${setup.marginLeft}mm;
        box-sizing: border-box;
      }
      
      .page:last-child {
        page-break-after: auto;
      }
    }
  `
}

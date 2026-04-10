import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog } from './Dialog'

export interface ImageConfig {
  src: string
  alt: string
  width: string
  height: string
  alignment: 'left' | 'center' | 'right'
  wrapText: boolean
  border: boolean
  shadow: boolean
  caption: string
  figureNumber?: number
  autoCaption?: boolean
}

export const defaultImageConfig: ImageConfig = {
  src: '',
  alt: '',
  width: 'auto',
  height: 'auto',
  alignment: 'center',
  wrapText: false,
  border: false,
  shadow: false,
  caption: ''
}

export const imageSizes = [
  { id: 'original', label: '原始大小', width: 'auto', height: 'auto' },
  { id: 'small', label: '小 (200px)', width: '200px', height: 'auto' },
  { id: 'medium', label: '中 (400px)', width: '400px', height: 'auto' },
  { id: 'large', label: '大 (600px)', width: '600px', height: 'auto' },
  { id: 'full', label: '适应页面', width: '100%', height: 'auto' },
  { id: 'custom', label: '自定义', width: '', height: '' },
]

interface ImageInsertDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (config: ImageConfig) => void
}

export function ImageInsertDialog({ isOpen, onClose, onInsert }: ImageInsertDialogProps) {
  const [src, setSrc] = useState('')
  const [alt, setAlt] = useState('')
  const [width, setWidth] = useState('auto')
  const [height, setHeight] = useState('auto')
  const [customWidth, setCustomWidth] = useState('400')
  const [customHeight, setCustomHeight] = useState('auto')
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('center')
  const [border, setBorder] = useState(false)
  const [shadow, setShadow] = useState(false)
  const [caption, setCaption] = useState('')
  const [selectedSize, setSelectedSize] = useState('medium')
  const [previewError, setPreviewError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'search'>('upload')
  const [autoCaption, setAutoCaption] = useState(true)
  const [figureNumber, setFigureNumber] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setSrc(event.target?.result as string)
        setPreviewError(false)
      }
      reader.readAsDataURL(file)
    }
  }
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    try {
      // 使用图片生成API搜索相关图片
      const results: string[] = []
      
      // 生成4个不同角度的图片
      const angles = ['相关场景', '数据分析', '概念图', '解决方案']
      for (const angle of angles) {
        const prompt = `${searchQuery} ${angle}`
        const encodedPrompt = encodeURIComponent(prompt)
        const imageUrl = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodedPrompt}&image_size=landscape_16_9`
        results.push(imageUrl)
      }
      
      setSearchResults(results)
    } catch (error) {
      console.error('搜索图片失败:', error)
    } finally {
      setIsSearching(false)
    }
  }
  
  const handleSelectSearchResult = (imageUrl: string) => {
    setSrc(imageUrl)
    setAlt(searchQuery)
    setPreviewError(false)
  }
  
  const handleSizeChange = (sizeId: string) => {
    setSelectedSize(sizeId)
    const size = imageSizes.find(s => s.id === sizeId)
    if (size && sizeId !== 'custom') {
      setWidth(size.width)
      setHeight(size.height)
    }
  }
  
  const handleInsert = () => {
    const finalWidth = selectedSize === 'custom' ? `${customWidth}px` : width
    const finalHeight = selectedSize === 'custom' ? (customHeight === 'auto' ? 'auto' : `${customHeight}px`) : height
    
    const finalCaption = autoCaption 
      ? `图${figureNumber}：${caption || alt || '相关图片'}`
      : caption
    
    onInsert({
      src,
      alt,
      width: finalWidth,
      height: finalHeight,
      alignment,
      wrapText: false,
      border,
      shadow,
      caption: finalCaption,
      figureNumber,
      autoCaption
    })
    onClose()
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-[500px] max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium mb-4">插入图片</h3>
        
        <div className="mb-4">
          <div className="flex border-b border-gray-200 mb-4">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 text-sm ${activeTab === 'upload' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              上传图片
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 text-sm ${activeTab === 'search' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              搜索图片
            </button>
          </div>
          
          {activeTab === 'upload' ? (
            <div>
              <label className="block text-sm text-gray-600 mb-2">选择图片</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  选择文件
                </button>
                <input
                  type="text"
                  placeholder="或输入图片URL"
                  value={src.startsWith('data:') ? '' : src}
                  onChange={e => { setSrc(e.target.value); setPreviewError(false) }}
                  className="flex-1 h-10 px-2 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-600 mb-2">搜索图片</label>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="输入关键词搜索图片"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 h-10 px-2 border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {isSearching ? '搜索中...' : '搜索'}
                </button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {searchResults.map((imageUrl, index) => (
                    <div key={index} className="border border-gray-200 rounded overflow-hidden cursor-pointer hover:border-blue-500">
                      <img
                        src={imageUrl}
                        alt={`搜索结果 ${index + 1}`}
                        className="w-full h-24 object-cover"
                        onClick={() => handleSelectSearchResult(imageUrl)}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {searchResults.length === 0 && searchQuery.trim() && !isSearching && (
                <p className="text-sm text-gray-500">暂无搜索结果</p>
              )}
            </div>
          )}
        </div>
        
        {src && (
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-2">预览</label>
            <div className="border border-gray-200 rounded p-2 flex justify-center bg-gray-50 min-h-[100px]">
              <img
                src={src}
                alt="预览"
                className="max-h-[200px] object-contain"
                onError={() => setPreviewError(true)}
                style={{ display: previewError ? 'none' : 'block' }}
              />
              {previewError && (
                <span className="text-red-500 text-sm">图片加载失败</span>
              )}
            </div>
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">替代文本</label>
          <input
            type="text"
            value={alt}
            onChange={e => setAlt(e.target.value)}
            placeholder="图片描述（可选）"
            className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">图片大小</label>
          <div className="grid grid-cols-3 gap-2">
            {imageSizes.map(size => (
              <button
                key={size.id}
                onClick={() => handleSizeChange(size.id)}
                className={`p-2 text-xs border rounded ${
                  selectedSize === size.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
          
          {selectedSize === 'custom' && (
            <div className="flex gap-2 mt-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">宽度</label>
                <input
                  type="text"
                  value={customWidth}
                  onChange={e => setCustomWidth(e.target.value)}
                  placeholder="400"
                  className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">高度</label>
                <input
                  type="text"
                  value={customHeight}
                  onChange={e => setCustomHeight(e.target.value)}
                  placeholder="auto"
                  className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">对齐方式</label>
          <div className="flex gap-2">
            <button
              onClick={() => setAlignment('left')}
              className={`flex-1 p-2 text-sm border rounded ${
                alignment === 'left' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              左对齐
            </button>
            <button
              onClick={() => setAlignment('center')}
              className={`flex-1 p-2 text-sm border rounded ${
                alignment === 'center' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              居中
            </button>
            <button
              onClick={() => setAlignment('right')}
              className={`flex-1 p-2 text-sm border rounded ${
                alignment === 'right' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              右对齐
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">图片样式</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={border}
                onChange={e => setBorder(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">边框</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={shadow}
                onChange={e => setShadow(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">阴影</span>
            </label>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoCaption}
                onChange={e => setAutoCaption(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-600">自动编号标注</span>
            </label>
            {autoCaption && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">图号:</label>
                <input
                  type="number"
                  min="1"
                  value={figureNumber}
                  onChange={e => setFigureNumber(parseInt(e.target.value) || 1)}
                  className="w-16 h-8 px-2 border border-gray-300 rounded text-sm"
                />
              </div>
            )}
          </div>
          
          <label className="block text-sm text-gray-600 mb-1">
            {autoCaption ? '图片说明（将显示为"图X：说明"）' : '图片说明'}
          </label>
          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder={autoCaption ? "例如：项目实施流程图" : "图片说明文字（可选）"}
            className="w-full h-8 px-2 border border-gray-300 rounded text-sm"
          />
          {autoCaption && caption && (
            <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-600">
              预览：图{figureNumber}：{caption}
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleInsert}
            disabled={!src}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
          >
            插入
          </button>
        </div>
      </div>
    </div>
  )
}

interface ImageResizeHandleProps {
  onResize: (delta: { width: number; height: number }) => void
  direction: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
}

export function ImageResizeHandle({ onResize, direction }: ImageResizeHandleProps) {
  const isCorner = direction.length === 2
  
  const getPosition = () => {
    switch (direction) {
      case 'nw': return 'top-0 left-0 cursor-nw-resize'
      case 'ne': return 'top-0 right-0 cursor-ne-resize'
      case 'sw': return 'bottom-0 left-0 cursor-sw-resize'
      case 'se': return 'bottom-0 right-0 cursor-se-resize'
      case 'n': return 'top-0 left-1/2 -translate-x-1/2 cursor-n-resize'
      case 's': return 'bottom-0 left-1/2 -translate-x-1/2 cursor-s-resize'
      case 'e': return 'right-0 top-1/2 -translate-y-1/2 cursor-e-resize'
      case 'w': return 'left-0 top-1/2 -translate-y-1/2 cursor-w-resize'
    }
  }
  
  return (
    <div
      className={`absolute w-3 h-3 bg-white border border-gray-400 rounded-sm ${getPosition()} ${isCorner ? '' : 'w-full h-2'}`}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        
        const startX = e.clientX
        const startY = e.clientY
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
          const deltaX = moveEvent.clientX - startX
          const deltaY = moveEvent.clientY - startY
          
          let widthDelta = 0
          let heightDelta = 0
          
          if (direction.includes('e')) widthDelta = deltaX
          if (direction.includes('w')) widthDelta = -deltaX
          if (direction.includes('s')) heightDelta = deltaY
          if (direction.includes('n')) heightDelta = -deltaY
          
          onResize({ width: widthDelta, height: heightDelta })
        }
        
        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove)
          document.removeEventListener('mouseup', handleMouseUp)
        }
        
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      }}
    />
  )
}

interface ImageEditorOverlayProps {
  image: HTMLImageElement
  onUpdate: (width: number, height: number) => void
  onDelete: () => void
  onDeselect: () => void
}

export function ImageEditorOverlay({ image, onUpdate, onDelete, onDeselect }: ImageEditorOverlayProps) {
  const [rect, setRect] = useState(image.getBoundingClientRect())
  const overlayRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const updateRect = () => setRect(image.getBoundingClientRect())
    updateRect()
    
    const observer = new ResizeObserver(updateRect)
    observer.observe(image)
    
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect)
    
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect)
    }
  }, [image])
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!overlayRef.current?.contains(e.target as Node) && e.target !== image) {
        onDeselect()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [image, onDeselect])
  
  const handleResize = useCallback((delta: { width: number; height: number }) => {
    const currentWidth = image.offsetWidth
    const currentHeight = image.offsetHeight
    
    const newWidth = Math.max(50, currentWidth + delta.width)
    const aspectRatio = currentWidth / currentHeight
    const newHeight = delta.height !== 0 ? Math.max(50, currentHeight + delta.height) : newWidth / aspectRatio
    
    onUpdate(newWidth, newHeight)
  }, [image, onUpdate])
  
  return (
    <div
      ref={overlayRef}
      className="fixed border-2 border-blue-500 pointer-events-auto z-10"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <ImageResizeHandle direction="nw" onResize={handleResize} />
      <ImageResizeHandle direction="ne" onResize={handleResize} />
      <ImageResizeHandle direction="sw" onResize={handleResize} />
      <ImageResizeHandle direction="se" onResize={handleResize} />
      
      <div className="absolute -top-8 left-0 right-0 flex justify-center gap-1">
        <button
          onClick={onDelete}
          className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
        >
          删除
        </button>
        <button
          onClick={async () => {
            const newWidth = await Dialog.prompt('请输入宽度:', image.offsetWidth.toString(), '调整尺寸')
            if (newWidth) {
              const newHeight = await Dialog.prompt('请输入高度:', image.offsetHeight.toString(), '调整尺寸')
              if (newHeight) {
                onUpdate(parseInt(newWidth), parseInt(newHeight))
              }
            }
          }}
          className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-800"
        >
          尺寸
        </button>
      </div>
    </div>
  )
}

export function generateImageHTML(config: ImageConfig): string {
  const { src, alt, width, height, alignment, border, shadow, caption, figureNumber, autoCaption } = config
  
  let style = ''
  if (width !== 'auto') style += `width: ${width}; `
  if (height !== 'auto') style += `height: ${height}; `
  if (border) style += 'border: 1px solid #ccc; padding: 4px; '
  if (shadow) style += 'box-shadow: 0 2px 8px rgba(0,0,0,0.1); '
  
  const alignStyle = alignment === 'center' 
    ? 'display: block; margin: 0 auto;' 
    : alignment === 'right' 
      ? 'float: right; margin-left: 10px;' 
      : 'float: left; margin-right: 10px;'
  
  const finalCaption = autoCaption && figureNumber 
    ? `图${figureNumber}：${caption || alt || '相关图片'}`
    : caption
  
  if (finalCaption) {
    return `<figure style="${alignStyle} text-align: center; margin: 10px 0;">
  <img src="${src}" alt="${alt}" style="${style} max-width: 100%;" />
  <figcaption style="font-size: 12px; color: #333; margin-top: 8px; text-align: center;">${finalCaption}</figcaption>
</figure>`
  }
  
  return `<img src="${src}" alt="${alt}" style="${style} ${alignStyle} max-width: 100%;" />`
}

export function insertImageAtCursor(config: ImageConfig): void {
  const html = generateImageHTML(config)
  document.execCommand('insertHTML', false, html)
}

export function getImageFromSelection(): HTMLImageElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  
  let node = selection.anchorNode
  while (node && node.nodeType !== Node.ELEMENT_NODE) {
    node = node.parentNode
  }
  
  if ((node as Element)?.tagName === 'IMG') {
    return node as HTMLImageElement
  }
  
  return null
}

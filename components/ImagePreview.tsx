import { useState } from 'react'

interface ImagePreviewProps {
  images: ImageItem[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
  onRemove: (id: string) => void
  onUpload: (file: File) => void
}

interface ImageItem {
  id: string
  url: string
  thumbnail: string
  description: string
  photographer: string
  source: string
  width: number
  height: number
}

export function ImagePreview({
  images,
  selectedIds,
  onToggleSelect,
  onRemove,
  onUpload
}: ImagePreviewProps) {
  const [viewingImage, setViewingImage] = useState<ImageItem | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        onUpload(file)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 图片网格 */}
      <div 
        className={`flex-1 overflow-y-auto p-4 ${dragOver ? 'bg-blue-50' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="grid grid-cols-2 gap-3">
          {images.map((image) => {
            const isSelected = selectedIds.includes(image.id)
            
            return (
              <div
                key={image.id}
                className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  isSelected 
                    ? 'border-blue-500 ring-2 ring-blue-200' 
                    : 'border-transparent hover:border-gray-300'
                }`}
                onClick={() => onToggleSelect(image.id)}
              >
                <img
                  src={image.thumbnail}
                  alt={image.description}
                  className="w-full h-28 object-cover"
                  loading="lazy"
                />
                
                {/* 悬停操作层 */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all">
                  {/* 放大按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setViewingImage(image)
                    }}
                    className="absolute top-2 left-2 w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-100"
                    title="放大查看"
                  >
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                  
                  {/* 删除按钮 */}
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemove(image.id)
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="从PPT中移除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  
                  {/* 选中标记 */}
                  {isSelected && (
                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  
                  {/* 图片信息 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="truncate font-medium">{image.description || '无描述'}</p>
                    <p className="text-gray-300 text-xs">{image.source}</p>
                  </div>
                </div>
              </div>
            )
          })}
          
          {/* 添加图片按钮 */}
          <label className="h-28 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs text-gray-500 mt-1 block">添加图片</span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUpload(file)
              }}
            />
          </label>
        </div>
        
        {images.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium">暂无图片</p>
            <p className="text-sm mt-1">输入主题开始搜索或拖拽图片到此处</p>
          </div>
        )}
      </div>
      
      {/* 底部统计 */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            共 {images.length} 张图片
          </span>
          <span className="text-blue-600 font-medium">
            已选 {selectedIds.length} 张
          </span>
        </div>
      </div>
      
      {/* 图片查看器 */}
      {viewingImage && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
          onClick={() => setViewingImage(null)}
        >
          <button
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white hover:bg-opacity-30"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <img
            src={viewingImage.url}
            alt={viewingImage.description}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          
          <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 rounded-lg p-4 text-white">
            <p className="font-medium">{viewingImage.description}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
              <span>来源: {viewingImage.source}</span>
              <span>摄影师: {viewingImage.photographer}</span>
              <span>{viewingImage.width} x {viewingImage.height}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSelect(viewingImage.id)
                  setViewingImage(null)
                }}
                className={`px-4 py-2 rounded-lg font-medium ${
                  selectedIds.includes(viewingImage.id)
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {selectedIds.includes(viewingImage.id) ? '取消选择' : '选择此图片'}
              </button>
              <a
                href={viewingImage.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
              >
                在新窗口打开
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

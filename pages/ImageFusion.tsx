import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { t } from '@/i18n'
import { useLanguageStore } from '@/store/languageStore'
import { useAppStore } from '@/store/appStore'
import logger from '@/utils/logger'
import { imageSearchEngine } from '@/utils/semanticImageSearch'

interface ImageFusionProps {
  initialQuery?: string
}

const ImageFusion = ({ initialQuery }: ImageFusionProps) => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { setLoading } = useAppStore()
  
  const [query, setQuery] = useState(searchParams.get('query') || initialQuery || '')
  const [images, setImages] = useState<Array<{
    id: string
    url: string
    thumbnail_url: string
    full_url?: string
    width: number
    height: number
    caption: string
    alt_text: string
    license: string
    source: string
    author?: string
    download_url?: string
  }>>([])
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [fusionResult, setFusionResult] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [fusionStyle, setFusionStyle] = useState('blend')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    if (query) {
      searchImages()
    }
  }, [query])
  
  const searchImages = async () => {
    if (!query.trim()) return

    setLoading(true)
    setFusionResult(null)
    try {
      const semantic = imageSearchEngine.expandQuery(query)
      const enhancedQuery = semantic.enhancedQuery !== query ? semantic.enhancedQuery : query

      const response = await fetch(`http://localhost:8000/api/images/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: enhancedQuery, per_page: 12, language: 'zh', original_query: query, category: semantic.primaryCategory })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.images && data.images.length > 0) {
          const searchResults = data.images.map((img: any, i: number) => ({
            id: img.id || `search_${i}`,
            url: img.url || img.thumbnail_url,
            thumbnail_url: img.thumbnail_url || img.url,
            full_url: img.full_url || img.url,
            width: img.width || 800,
            height: img.height || 600,
            caption: img.caption || `${query} - ${img.source} ${i + 1}`,
            alt_text: img.alt_text || query,
            license: img.license || 'Free to use',
            source: img.source || 'Image Search',
            author: img.author || '',
            download_url: img.download_url || img.url
          }))
          setImages(searchResults)
        } else {
          setImages(imageSearchEngine.generateFallback(query, 12))
        }
      } else {
        setImages(imageSearchEngine.generateFallback(query, 12))
      }
    } catch (error) {
      logger.error('图片搜索失败:', error)
      setImages(imageSearchEngine.generateFallback(query, 12))
    }
    setLoading(false)
  }

  const handleImageSelect = (imageId: string) => {
    setSelectedImages(prev => 
      prev.includes(imageId)
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    )
  }
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      // 处理文件上传
      const uploadedImages = Array.from(files).map((file, index) => {
        const url = URL.createObjectURL(file)
        return {
          id: `uploaded_${index}`,
          url,
          thumbnail_url: url,
          width: 800,
          height: 600,
          caption: file.name,
          alt_text: file.name,
          license: 'User Upload',
          source: 'User'
        }
      })
      setImages(prev => [...prev, ...uploadedImages])
    }
  }
  
  const handleFusion = async () => {
    if (selectedImages.length < 2) {
      alert('请至少选择两张图片进行融合')
      return
    }
    
    setIsProcessing(true)
    try {
      const selected = images.filter(img => selectedImages.includes(img.id))
      
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const ctx = canvas.getContext('2d')!
      
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      const loadedImages = await Promise.all(
        selected.map(img => {
          return new Promise<{ img: HTMLImageElement; data: typeof img }>((resolve) => {
            const image = new Image()
            image.crossOrigin = 'anonymous'
            image.onload = () => resolve({ img: image, data: img })
            image.onerror = () => resolve({ img: image, data: img })
            image.src = img.full_url || img.url || img.thumbnail_url
          })
        })
      )
      
      const validImages = loadedImages.filter(item => item.img.complete && item.img.naturalWidth > 0)
      
      if (validImages.length >= 2) {
        if (fusionStyle === 'blend') {
          const opacity = 1 / validImages.length
          validImages.forEach(({ img }) => {
            ctx.globalAlpha = opacity
            const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight)
            const w = img.naturalWidth * scale
            const h = img.naturalHeight * scale
            const x = (canvas.width - w) / 2
            const y = (canvas.height - h) / 2
            ctx.drawImage(img, x, y, w, h)
          })
        } else if (fusionStyle === 'overlay') {
          const baseImg = validImages[0].img
          const scale = Math.min(canvas.width / baseImg.naturalWidth, canvas.height / baseImg.naturalHeight)
          ctx.drawImage(baseImg, (canvas.width - baseImg.naturalWidth * scale) / 2, (canvas.height - baseImg.naturalHeight * scale) / 2, baseImg.naturalWidth * scale, baseImg.naturalHeight * scale)
          ctx.globalCompositeOperation = 'screen'
          validImages.slice(1).forEach(({ img }, i) => {
            ctx.globalAlpha = 0.6 - i * 0.15
            const s = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight) * 0.9
            ctx.drawImage(img, (canvas.width - img.naturalWidth * s) / 2, (canvas.height - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
          })
          ctx.globalCompositeOperation = 'source-over'
        } else if (fusionStyle === 'collage') {
          const cols = Math.ceil(Math.sqrt(validImages.length))
          const cellW = canvas.width / cols
          const cellH = canvas.height / Math.ceil(validImages.length / cols)
          validImages.forEach(({ img }, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const scale = Math.min(cellW / img.naturalWidth, cellH / img.naturalHeight) * 0.9
            const w = img.naturalWidth * scale
            const h = img.naturalHeight * scale
            const x = col * cellW + (cellW - w) / 2
            const y = row * cellH + (cellH - h) / 2
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 3
            ctx.strokeRect(col * cellW, row * cellH, cellW, cellH)
            ctx.drawImage(img, x, y, w, h)
          })
        } else if (fusionStyle === 'morph') {
          const centerX = canvas.width / 2
          const centerY = canvas.height / 2
          const maxRadius = Math.sqrt(centerX ** 2 + centerY ** 2)
          validImages.forEach(({ img }, i) => {
            const progress = i / Math.max(1, validImages.length - 1)
            const radius = maxRadius * (1 - progress * 0.6)
            ctx.save()
            ctx.beginPath()
            ctx.arc(centerX, centerY, Math.max(radius, 10), 0, Math.PI * 2)
            ctx.clip()
            const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight)
            ctx.globalAlpha = 0.85
            ctx.drawImage(img, (canvas.width - img.naturalWidth * scale) / 2, (canvas.height - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale)
            ctx.restore()
          })
        }
        ctx.globalAlpha = 1.0
        
        const dataUrl = canvas.toDataURL('image/png')
        setFusionResult(dataUrl)
      } else {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        gradient.addColorStop(0, '#667eea')
        gradient.addColorStop(0.5, '#764ba2')
        gradient.addColorStop(1, '#f093fb')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        ctx.font = '24px sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.fillText(`融合了 ${selected.length} 张图片`, canvas.width / 2, canvas.height / 2)
        
        const dataUrl = canvas.toDataURL('image/png')
        setFusionResult(dataUrl)
      }
    } catch (error) {
      logger.error('图片融合失败:', error)
    }
    setIsProcessing(false)
  }
  
  const handleDownload = () => {
    if (fusionResult) {
      if (fusionResult.startsWith('data:')) {
        const link = document.createElement('a')
        link.href = fusionResult
        link.download = `fusion_result_${Date.now()}.png`
        link.click()
      } else {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          ctx?.drawImage(img, 0, 0)
          const link = document.createElement('a')
          link.href = canvas.toDataURL('image/png')
          link.download = `fusion_result_${Date.now()}.png`
          link.click()
        }
        img.src = fusionResult
      }
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {t('imageFusion.title', language)}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700 transition-colors"
              >
                {t('common.back', language)}
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：图片搜索和选择 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 搜索栏 */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('imageFusion.searchPlaceholder', language)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={searchImages}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  {t('common.search', language)}
                </button>
              </div>
              
              {/* 文件上传 */}
              <div className="mt-4">
                <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                  <div className="text-center">
                    <svg className="w-10 h-10 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600">
                      {t('imageFusion.uploadHint', language)}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                </label>
              </div>
            </div>
            
            {/* 图片网格 */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {t('imageFusion.images', language)} ({images.length})
              </h2>
              
              {images.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>{t('imageFusion.noImages', language)}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`relative rounded-lg overflow-hidden shadow-sm transition-all duration-200 ${selectedImages.includes(image.id) ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}
                    >
                      <img
                        src={image.thumbnail_url}
                        alt={image.alt_text}
                        className="w-full h-40 object-cover cursor-pointer"
                        onClick={() => handleImageSelect(image.id)}
                      />
                      {selectedImages.includes(image.id) && (
                        <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                          ✓
                        </div>
                      )}
                      <div className="p-2 bg-white">
                        <p className="text-xs text-gray-600 truncate" title={image.caption}>{image.caption}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-500 font-medium">{image.source}</span>
                          {image.author && <span className="text-xs text-gray-400">by {image.author}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* 右侧：融合设置和结果 */}
          <div className="space-y-6">
            {/* 融合设置 */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {t('imageFusion.settings', language)}
              </h2>
              
              <div className="space-y-4">
                {/* 融合风格 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('imageFusion.fusionStyle', language)}
                  </label>
                  <select
                    value={fusionStyle}
                    onChange={(e) => setFusionStyle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="blend">{t('imageFusion.blendStyle', language)}</option>
                    <option value="overlay">{t('imageFusion.overlayStyle', language)}</option>
                    <option value="collage">{t('imageFusion.collageStyle', language)}</option>
                    <option value="morph">{t('imageFusion.morphStyle', language)}</option>
                  </select>
                </div>
                
                {/* 选中的图片 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('imageFusion.selectedImages', language)} ({selectedImages.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedImages.map((id) => {
                      const image = images.find(img => img.id === id)
                      return image ? (
                        <div key={id} className="relative w-12 h-12 rounded-md overflow-hidden">
                          <img
                            src={image.thumbnail_url}
                            alt={image.alt_text}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => handleImageSelect(id)}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
                
                {/* 融合按钮 */}
                <button
                  onClick={handleFusion}
                  disabled={selectedImages.length < 2 || isProcessing}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t('imageFusion.processing', language)}</span>
                    </div>
                  ) : (
                    t('imageFusion.fuseImages', language)
                  )}
                </button>
              </div>
            </div>
            
            {/* 融合结果 */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {t('imageFusion.result', language)}
              </h2>
              
              {fusionResult ? (
                <div className="space-y-4">
                  <div className="rounded-lg overflow-hidden shadow-sm">
                    <img
                      src={fusionResult}
                      alt="融合结果"
                      className="w-full h-64 object-cover"
                    />
                  </div>
                  <button
                    onClick={handleDownload}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                  >
                    {t('imageFusion.download', language)}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>{t('imageFusion.noResult', language)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ImageFusion
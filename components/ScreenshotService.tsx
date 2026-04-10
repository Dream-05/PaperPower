import { useState, useCallback } from 'react'

interface ScreenshotServiceProps {
  onSave: (imageData: string, description: string) => void
  onClose: () => void
}

export function ScreenshotService({ onSave, onClose }: ScreenshotServiceProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [description, setDescription] = useState('')

  const startCapture = useCallback(async () => {
    try {
      setIsCapturing(true)
      
      // 请求屏幕共享权限
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor'
        } as MediaTrackConstraints,
        audio: false
      })

      // 创建video元素来捕获帧
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()

      // 等待一帧
      await new Promise(resolve => setTimeout(resolve, 100))

      // 创建canvas并绘制当前帧
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        
        // 转换为base64图片
        const imageData = canvas.toDataURL('image/png')
        setCapturedImage(imageData)
      }

      // 停止所有轨道
      stream.getTracks().forEach(track => track.stop())
      setIsCapturing(false)
      
    } catch (error) {
      console.error('Screenshot failed:', error)
      setIsCapturing(false)
      alert('截图失败，请确保已授权屏幕共享权限')
    }
  }, [])

  const handleSave = useCallback(() => {
    if (capturedImage && description.trim()) {
      onSave(capturedImage, description.trim())
      setCapturedImage(null)
      setDescription('')
      onClose()
    }
  }, [capturedImage, description, onSave, onClose])

  const handleCancel = useCallback(() => {
    setCapturedImage(null)
    setDescription('')
    onClose()
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">截图保存</h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-4">
          {!capturedImage ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="w-24 h-24 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">点击下方按钮开始截图</p>
              <button
                onClick={startCapture}
                disabled={isCapturing}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
              >
                {isCapturing ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    正在捕获...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    开始截图
                  </>
                )}
              </button>
              <p className="text-sm text-gray-500 mt-4">
                提示：选择要捕获的屏幕或窗口，截图将自动保存到素材库
              </p>
            </div>
          ) : (
            <div>
              {/* 预览图片 */}
              <div className="mb-4">
                <img
                  src={capturedImage}
                  alt="截图预览"
                  className="w-full h-64 object-contain rounded-lg border border-gray-200"
                />
              </div>

              {/* 描述输入 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  图片描述
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="请输入图片描述..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setCapturedImage(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  重新截图
                </button>
                <button
                  onClick={handleSave}
                  disabled={!description.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  保存到素材库
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

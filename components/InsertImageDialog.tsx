import { useState, useCallback } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { t } from '@/i18n'

export interface ImageConfig {
  url: string
  width: number
  height: number
  x: number
  y: number
  alt: string
  fit: 'contain' | 'cover' | 'fill'
}

interface InsertImageDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (config: ImageConfig) => void
}

const defaultConfig: ImageConfig = {
  url: '',
  width: 400,
  height: 300,
  x: 0,
  y: 0,
  alt: '图片',
  fit: 'contain'
}

export function InsertImageDialog({ isOpen, onClose, onInsert }: InsertImageDialogProps) {
  const { language } = useLanguageStore()
  const [config, setConfig] = useState<ImageConfig>(defaultConfig)
  const [previewError, setPreviewError] = useState(false)

  const handleInsert = useCallback(() => {
    if (!config.url) return
    onInsert(config)
    onClose()
  }, [config, onInsert, onClose])

  const handleUrlChange = (url: string) => {
    setConfig({ ...config, url })
    setPreviewError(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
          <h3 className="text-xl font-bold text-white">{t('ppt.image.title', language)}</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('ppt.image.url', language)}
                </label>
                <input
                  type="text"
                  value={config.url}
                  onChange={e => handleUrlChange(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('ppt.image.alt', language)}
                </label>
                <input
                  type="text"
                  value={config.alt}
                  onChange={e => setConfig({ ...config, alt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('ppt.image.width', language)}
                  </label>
                  <input
                    type="number"
                    value={config.width}
                    onChange={e => setConfig({ ...config, width: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('ppt.image.height', language)}
                  </label>
                  <input
                    type="number"
                    value={config.height}
                    onChange={e => setConfig({ ...config, height: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('ppt.image.fit', language)}
                </label>
                <select
                  value={config.fit}
                  onChange={e => setConfig({ ...config, fit: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="contain">{t('ppt.image.fitContain', language)}</option>
                  <option value="cover">{t('ppt.image.fitCover', language)}</option>
                  <option value="fill">{t('ppt.image.fitFill', language)}</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700">{t('ppt.image.preview', language)}</h4>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 h-64 flex items-center justify-center">
                {config.url && !previewError ? (
                  <img
                    src={config.url}
                    alt={config.alt}
                    className="max-w-full max-h-full object-contain"
                    onError={() => setPreviewError(true)}
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>{previewError ? t('ppt.image.loadError', language) : t('ppt.image.noPreview', language)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {t('common.cancel', language)}
          </button>
          <button
            onClick={handleInsert}
            disabled={!config.url}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('ppt.image.insert', language)}
          </button>
        </div>
      </div>
    </div>
  )
}

export function generateImageHTML(config: ImageConfig): string {
  return `
    <div style="
      position: absolute;
      left: ${config.x}px;
      top: ${config.y}px;
      width: ${config.width}px;
      height: ${config.height}px;
    ">
      <img 
        src="${config.url}" 
        alt="${config.alt}"
        style="
          width: 100%;
          height: 100%;
          object-fit: ${config.fit};
        "
      />
    </div>
  `
}

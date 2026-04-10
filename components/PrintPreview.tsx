import { useState, useRef, useEffect, useCallback } from 'react'
import { PageSetup, defaultPageSetup, getPrintCSS } from './PageSetup'
import { SmartPagination as SmartPaginationComponent, PageContent, getPaginationStyles } from './SmartPagination'

interface PrintPreviewProps {
  isOpen: boolean
  onClose: () => void
  content: string
  pageSetup?: PageSetup
}

function SmartPagination({ content, pageSetup, editable, onPageChange }: {
  content: string
  pageSetup: PageSetup
  editable: boolean
  onPageChange: (pages: PageContent[]) => void
}) {
  return (
    <SmartPaginationComponent
      content={content}
      pageSetup={pageSetup}
      editable={editable}
      onPageChange={onPageChange}
    />
  )
}

export function PrintPreview({ 
  isOpen, 
  onClose, 
  content, 
  pageSetup = defaultPageSetup
}: PrintPreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [currentPage, setCurrentPage] = useState(1)
  const [pages, setPages] = useState<PageContent[]>([])
  const [printMode, setPrintMode] = useState<'single' | 'double'>('single')
  const previewRef = useRef<HTMLDivElement>(null)
  
  const totalPages = pages.length || 1
  
  const handlePrint = useCallback(() => {
    const printCSS = getPrintCSS(pageSetup)
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>打印预览</title>
        <style>
          ${printCSS}
          body {
            font-family: 'SimSun', serif;
            font-size: 12pt;
            line-height: 1.5;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          ${content}
        </div>
      </body>
      </html>
    `
    
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 250)
    }
  }, [content, pageSetup])
  
  const handleExportPDF = useCallback(() => {
    addNotification('info', '导出PDF', '正在生成PDF文件...')
    
    setTimeout(() => {
      handlePrint()
    }, 500)
  }, [handlePrint])
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-90 z-50 flex flex-col">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-medium">打印预览</h3>
          
          <div className="flex items-center gap-2 border-l pl-4">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
            >
              -
            </button>
            <select
              value={zoom}
              onChange={e => setZoom(parseInt(e.target.value))}
              className="h-8 px-2 border rounded text-sm"
            >
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={100}>100%</option>
              <option value={125}>125%</option>
              <option value={150}>150%</option>
              <option value={200}>200%</option>
            </select>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 10))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
            >
              +
            </button>
          </div>
          
          <div className="flex items-center gap-2 border-l pl-4">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50"
            >
              ◀
            </button>
            <span className="text-sm">
              第 {currentPage} 页，共 {totalPages} 页
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50"
            >
              ▶
            </button>
          </div>
          
          <div className="flex items-center gap-2 border-l pl-4">
            <button
              onClick={() => setPrintMode('single')}
              className={`px-3 py-1 text-sm rounded ${printMode === 'single' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
            >
              单页
            </button>
            <button
              onClick={() => setPrintMode('double')}
              className={`px-3 py-1 text-sm rounded ${printMode === 'double' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
            >
              双页
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            打印
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            导出PDF
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-gray-200 p-8 flex justify-center">
        <style>{getPaginationStyles()}</style>
        <div 
          ref={previewRef}
          className="smart-pagination"
          style={{ 
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center'
          }}
        >
          <SmartPagination
            content={content}
            pageSetup={pageSetup}
            editable={false}
            onPageChange={(newPages) => {
              setPages(newPages)
            }}
          />
        </div>
      </div>
      
      <div className="bg-white border-t px-4 py-2 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <span>纸张: {pageSetup.size.toUpperCase()}</span>
          <span>方向: {pageSetup.orientation === 'portrait' ? '纵向' : '横向'}</span>
          <span>边距: {pageSetup.marginTop}/{pageSetup.marginRight}/{pageSetup.marginBottom}/{pageSetup.marginLeft} mm</span>
        </div>
        <div className="flex items-center gap-4">
          <span>缩放: {zoom}%</span>
        </div>
      </div>
    </div>
  )
}

function addNotification(type: string, title: string, message: string) {
  console.log(`[${type}] ${title}: ${message}`)
}

interface QuickPrintOptions {
  copies: number
  collate: boolean
  color: boolean
  duplex: boolean
  paperSize: string
  orientation: 'portrait' | 'landscape'
  margins: 'normal' | 'narrow' | 'wide'
}

export const defaultPrintOptions: QuickPrintOptions = {
  copies: 1,
  collate: true,
  color: true,
  duplex: false,
  paperSize: 'a4',
  orientation: 'portrait',
  margins: 'normal'
}

interface QuickPrintDialogProps {
  isOpen: boolean
  onClose: () => void
  onPrint: (options: QuickPrintOptions) => void
}

export function QuickPrintDialog({ isOpen, onClose, onPrint }: QuickPrintDialogProps) {
  const [options, setOptions] = useState<QuickPrintOptions>(defaultPrintOptions)
  
  const handlePrint = () => {
    onPrint(options)
    onClose()
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-[400px]">
        <h3 className="text-lg font-medium mb-4">打印设置</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">打印份数</label>
            <input
              type="number"
              min="1"
              max="100"
              value={options.copies}
              onChange={e => setOptions({ ...options, copies: parseInt(e.target.value) || 1 })}
              className="w-full h-8 px-2 border border-gray-300 rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">纸张大小</label>
            <select
              value={options.paperSize}
              onChange={e => setOptions({ ...options, paperSize: e.target.value })}
              className="w-full h-8 px-2 border border-gray-300 rounded"
            >
              <option value="a4">A4</option>
              <option value="a3">A3</option>
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">方向</label>
            <div className="flex gap-2">
              <button
                onClick={() => setOptions({ ...options, orientation: 'portrait' })}
                className={`flex-1 p-2 border rounded ${options.orientation === 'portrait' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
              >
                纵向
              </button>
              <button
                onClick={() => setOptions({ ...options, orientation: 'landscape' })}
                className={`flex-1 p-2 border rounded ${options.orientation === 'landscape' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
              >
                横向
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">页边距</label>
            <select
              value={options.margins}
              onChange={e => setOptions({ ...options, margins: e.target.value as QuickPrintOptions['margins'] })}
              className="w-full h-8 px-2 border border-gray-300 rounded"
            >
              <option value="normal">普通</option>
              <option value="narrow">窄</option>
              <option value="wide">宽</option>
            </select>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.collate}
                onChange={e => setOptions({ ...options, collate: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">逐份打印</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.color}
                onChange={e => setOptions({ ...options, color: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">彩色打印</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.duplex}
                onChange={e => setOptions({ ...options, duplex: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">双面打印</span>
            </label>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            打印
          </button>
        </div>
      </div>
    </div>
  )
}

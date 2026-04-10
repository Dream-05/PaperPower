import { useState, useCallback } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { t } from '@/i18n'

export interface HeadingNode {
  id: string
  text: string
  level: number
  page?: number
  children?: HeadingNode[]
}

interface TableOfContentsConfig {
  maxLevel: number
  showPageNumbers: boolean
  dotLeader: boolean
  includeStyles: boolean
}

interface TableOfContentsDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (config: TableOfContentsConfig) => void
  headings: HeadingNode[]
}

const defaultConfig: TableOfContentsConfig = {
  maxLevel: 3,
  showPageNumbers: true,
  dotLeader: true,
  includeStyles: true
}

export function TableOfContentsDialog({ isOpen, onClose, onInsert, headings }: TableOfContentsDialogProps) {
  const { language } = useLanguageStore()
  const [config, setConfig] = useState<TableOfContentsConfig>(defaultConfig)

  const handleInsert = useCallback(() => {
    onInsert(config)
    onClose()
  }, [config, onInsert, onClose])

  if (!isOpen) return null

  const renderHeadingPreview = (node: HeadingNode, indent: number = 0): JSX.Element => {
    const style = {
      paddingLeft: `${indent * 16}px`,
      fontSize: `${14 - node.level * 2}px`,
      fontWeight: node.level === 1 ? 'bold' : node.level === 2 ? '600' : 'normal',
      color: node.level === 1 ? '#1a1a2e' : node.level === 2 ? '#4a4a6a' : '#6a6a8a'
    }

    return (
      <div key={node.id} style={style} className="py-1">
        <div className="flex items-center justify-between">
          <span>{node.text}</span>
          {config.showPageNumbers && (
            <span className="text-gray-400 text-xs">{node.page || '-'}</span>
          )}
        </div>
        {node.children && node.children.map(child => renderHeadingPreview(child, indent + 1))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
          <h3 className="text-xl font-bold text-white">{t('word.toc.title', language)}</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-700">{t('word.toc.settings', language)}</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('word.toc.maxLevel', language)}
                </label>
                <select
                  value={config.maxLevel}
                  onChange={e => setConfig({ ...config, maxLevel: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>{t('word.toc.level1', language)}</option>
                  <option value={2}>{t('word.toc.level1-2', language)}</option>
                  <option value={3}>{t('word.toc.level1-3', language)}</option>
                  <option value={4}>{t('word.toc.level1-4', language)}</option>
                  <option value={5}>{t('word.toc.level1-5', language)}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('word.toc.style', language)}
                </label>
                <select
                  value={config.dotLeader ? 'dots' : 'none'}
                  onChange={e => setConfig({ ...config, dotLeader: e.target.value === 'dots' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="dots">{t('word.toc.styleDots', language)}</option>
                  <option value="none">{t('word.toc.styleNone', language)}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.showPageNumbers}
                  onChange={e => setConfig({ ...config, showPageNumbers: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{t('word.toc.showPageNumbers', language)}</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.includeStyles}
                  onChange={e => setConfig({ ...config, includeStyles: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{t('word.toc.includeStyles', language)}</span>
              </label>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 mb-3">{t('word.toc.preview', language)}</h4>
            <div className="border border-gray-200 rounded-lg p-4 bg-white max-h-64 overflow-y-auto">
              {headings.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  {t('word.toc.noHeadings', language)}
                </p>
              ) : (
                headings.filter(h => h.level <= config.maxLevel).map(node => renderHeadingPreview(node))
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{t('word.toc.totalHeadings', language)}: {headings.length}</span>
              <span>{t('word.toc.levels', language)}: {Math.max(...headings.map(h => h.level), 0)}</span>
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
            disabled={headings.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('word.toc.insert', language)}
          </button>
        </div>
      </div>
    </div>
  )
}

export function generateTableOfContents(headings: HeadingNode[], config: TableOfContentsConfig): string {
  const filteredHeadings = headings.filter(h => h.level <= config.maxLevel)
  
  const generateHTML = (nodes: HeadingNode[], indent: number = 0): string => {
    return nodes.map(node => {
      const style = config.includeStyles ? `style="padding-left: ${indent * 16}px; font-size: ${14 - node.level * 2}px; font-weight: ${node.level === 1 ? 'bold' : node.level === 2 ? '600' : 'normal'}; margin: 8px 0;"` : ''
      const pageRef = config.showPageNumbers && node.page ? `<span style="float: right; color: #999;">${node.page}</span>` : ''
      return `<div ${style}><span>${node.text}</span>${pageRef}</div>${node.children ? generateHTML(node.children, indent + 1) : ''}`
    }).join('')
  }

  return `<div class="table-of-contents" style="font-family: 'SimSun', serif; padding: 40px 20px;"><h2 style="font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 32px;">${t('word.toc.title', 'zh')}</h2>${generateHTML(filteredHeadings)}</div>`
}

export function extractHeadingsFromContent(content: string): HeadingNode[] {
  const headings: HeadingNode[] = []
  const headingRegex = /<h([1-6])(?:[^>]*)>(.*?)<\/h\1>/gi
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1])
    const text = match[2].replace(/<[^>]*>/g, '').trim()
    if (text) {
      headings.push({ id: `heading-${headings.length}`, text, level, page: Math.floor(headings.length / 10) + 1 })
    }
  }

  return buildHeadingHierarchy(headings)
}

function buildHeadingHierarchy(headings: HeadingNode[]): HeadingNode[] {
  const result: HeadingNode[] = []
  const stack: { node: HeadingNode; level: number }[] = []

  for (const heading of headings) {
    const node: HeadingNode = { ...heading, children: [] }
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop()
    }
    if (stack.length === 0) {
      result.push(node)
    } else {
      const parent = stack[stack.length - 1].node
      if (!parent.children) parent.children = []
      parent.children.push(node)
    }
    stack.push({ node, level: heading.level })
  }

  const cleanChildren = (node: HeadingNode): HeadingNode => {
    if (!node.children || node.children.length === 0) {
      return { ...node, children: undefined }
    }
    return { ...node, children: node.children.map(cleanChildren) }
  }

  return result.map(cleanChildren)
}

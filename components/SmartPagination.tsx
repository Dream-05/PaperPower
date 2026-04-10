import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { PageSetup, defaultPageSetup } from './PageSetup'

export interface PageContent {
  id: string
  html: string
  pageNumber: number
}

interface SmartPaginationProps {
  content: string
  pageSetup?: PageSetup
  onPageChange?: (pages: PageContent[]) => void
  editable?: boolean
  onContentChange?: (html: string) => void
}

const MM_TO_PX = 3.7795275591

export function SmartPagination({
  content,
  pageSetup = defaultPageSetup,
  onPageChange,
  editable = false,
  onContentChange
}: SmartPaginationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<PageContent[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  
  const pageWidth = useMemo(() => pageSetup.width * MM_TO_PX, [pageSetup.width])
  const pageHeight = useMemo(() => pageSetup.height * MM_TO_PX, [pageSetup.height])
  const marginTop = useMemo(() => pageSetup.marginTop * MM_TO_PX, [pageSetup.marginTop])
  const marginBottom = useMemo(() => pageSetup.marginBottom * MM_TO_PX, [pageSetup.marginBottom])
  const marginLeft = useMemo(() => pageSetup.marginLeft * MM_TO_PX, [pageSetup.marginLeft])
  const marginRight = useMemo(() => pageSetup.marginRight * MM_TO_PX, [pageSetup.marginRight])
  
  const contentHeight = pageHeight - marginTop - marginBottom
  const contentWidth = pageWidth - marginLeft - marginRight

  const splitContentIntoPages = useCallback((html: string): PageContent[] => {
    if (!html) return []
    
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    tempDiv.style.cssText = `
      position: absolute;
      visibility: hidden;
      width: ${contentWidth}px;
      font-family: 'SimSun', serif;
      font-size: 12pt;
      line-height: 1.8;
    `
    document.body.appendChild(tempDiv)
    
    const resultPages: PageContent[] = []
    let currentPageElements: Element[] = []
    let currentHeight = 0
    let pageNumber = 1
    
    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ''
        if (text.trim()) {
          const span = document.createElement('span')
          span.textContent = text
          tempDiv.appendChild(span)
          const nodeHeight = span.getBoundingClientRect().height
          tempDiv.removeChild(span)
          
          if (currentHeight + nodeHeight > contentHeight) {
            if (currentPageElements.length > 0) {
              const pageHtml = currentPageElements.map(el => el.outerHTML || el.textContent || '').join('')
              resultPages.push({
                id: `page-${pageNumber}`,
                html: pageHtml,
                pageNumber
              })
              pageNumber++
              currentPageElements = []
              currentHeight = 0
            }
          }
          
          const textSpan = document.createElement('span')
          textSpan.textContent = text
          currentPageElements.push(textSpan)
          currentHeight += nodeHeight
        }
        return
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) return
      
      const element = node as Element
      const clone = element.cloneNode(true) as Element
      
      tempDiv.innerHTML = ''
      tempDiv.appendChild(clone)
      const nodeHeight = tempDiv.getBoundingClientRect().height
      
      if (nodeHeight > contentHeight) {
        const tagName = element.tagName.toLowerCase()
        
        if (['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          if (currentHeight > 0) {
            const pageHtml = currentPageElements.map(el => el.outerHTML || el.textContent || '').join('')
            resultPages.push({
              id: `page-${pageNumber}`,
              html: pageHtml,
              pageNumber
            })
            pageNumber++
            currentPageElements = []
            currentHeight = 0
          }
          
          currentPageElements.push(element.cloneNode(true) as Element)
          currentHeight = nodeHeight
        } else if (['table', 'img', 'ul', 'ol'].includes(tagName)) {
          if (currentHeight > 0) {
            const pageHtml = currentPageElements.map(el => el.outerHTML || el.textContent || '').join('')
            resultPages.push({
              id: `page-${pageNumber}`,
              html: pageHtml,
              pageNumber
            })
            pageNumber++
            currentPageElements = []
            currentHeight = 0
          }
          
          currentPageElements.push(element.cloneNode(true) as Element)
          currentHeight = nodeHeight
        } else {
          currentPageElements.push(element.cloneNode(true) as Element)
          currentHeight += nodeHeight
        }
      } else if (currentHeight + nodeHeight > contentHeight) {
        const pageHtml = currentPageElements.map(el => el.outerHTML || el.textContent || '').join('')
        resultPages.push({
          id: `page-${pageNumber}`,
          html: pageHtml,
          pageNumber
        })
        pageNumber++
        currentPageElements = [element.cloneNode(true) as Element]
        currentHeight = nodeHeight
      } else {
        currentPageElements.push(element.cloneNode(true) as Element)
        currentHeight += nodeHeight
      }
    }
    
    const walkNodes = (parent: Node): void => {
      const children = Array.from(parent.childNodes)
      children.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as Element
          const tagName = element.tagName.toLowerCase()
          
          if (['style', 'script', 'meta', 'link'].includes(tagName)) {
            return
          }
          
          if (element.classList.contains('page-container') || 
              element.classList.contains('content-area') ||
              element.classList.contains('section')) {
            walkNodes(element)
          } else {
            processNode(child)
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          processNode(child)
        }
      })
    }
    
    walkNodes(tempDiv)
    
    if (currentPageElements.length > 0) {
      const pageHtml = currentPageElements.map(el => el.outerHTML || el.textContent || '').join('')
      resultPages.push({
        id: `page-${pageNumber}`,
        html: pageHtml,
        pageNumber
      })
    }
    
    document.body.removeChild(tempDiv)
    
    return resultPages.length > 0 ? resultPages : [{ id: 'page-1', html: content, pageNumber: 1 }]
  }, [content, contentHeight, contentWidth])

  useEffect(() => {
    if (content) {
      const newPages = splitContentIntoPages(content)
      setPages(newPages)
      onPageChange?.(newPages)
    }
  }, [content, splitContentIntoPages, onPageChange])

  const pageStyle: React.CSSProperties = useMemo(() => ({
    width: `${pageSetup.width}mm`,
    minHeight: `${pageSetup.height}mm`,
    padding: `${pageSetup.marginTop}mm ${pageSetup.marginRight}mm ${pageSetup.marginBottom}mm ${pageSetup.marginLeft}mm`,
    boxSizing: 'border-box',
    position: 'relative',
    background: 'white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    marginBottom: '20px',
    overflow: 'visible'
  }), [pageSetup])

  const contentStyle: React.CSSProperties = useMemo(() => ({
    height: '100%',
    overflow: 'visible',
    fontFamily: "'SimSun', serif",
    fontSize: '12pt',
    lineHeight: '1.8',
    wordWrap: 'break-word',
    whiteSpace: 'normal'
  }), [])

  const handlePageClick = useCallback((pageNum: number) => {
    setCurrentPage(pageNum)
  }, [])

  const handleContentEdit = useCallback((e: React.FormEvent<HTMLDivElement>, pageIndex: number) => {
    const target = e.target as HTMLDivElement
    const newHtml = target.innerHTML
    
    setPages(prev => {
      const newPages = [...prev]
      newPages[pageIndex] = { ...newPages[pageIndex], html: newHtml }
      
      const fullContent = newPages.map(p => p.html).join('')
      onContentChange?.(fullContent)
      
      return newPages
    })
  }, [onContentChange])

  return (
    <div ref={containerRef} className="smart-pagination">
      <div className="pages-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {pages.map((page, index) => (
          <div
            key={page.id}
            className="page-wrapper"
            style={pageStyle}
            onClick={() => handlePageClick(page.pageNumber)}
          >
            <div
              className="page-content"
              style={contentStyle}
              contentEditable={editable}
              suppressContentEditableWarning
              onBlur={(e) => handleContentEdit(e, index)}
              dangerouslySetInnerHTML={{ __html: page.html }}
            />
            <div className="page-footer" style={{
              position: 'absolute',
              bottom: `${pageSetup.marginBottom / 2}mm`,
              right: `${pageSetup.marginRight}mm`,
              fontSize: '10pt',
              color: '#666'
            }}>
              {page.pageNumber}
            </div>
          </div>
        ))}
      </div>
      
      {pages.length > 1 && (
        <div className="page-navigation" style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          zIndex: 100
        }}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            style={{
              padding: '4px 8px',
              border: 'none',
              background: 'transparent',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage <= 1 ? 0.5 : 1
            }}
          >
            ◀
          </button>
          <span style={{ fontSize: '12px' }}>
            {currentPage} / {pages.length}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(pages.length, currentPage + 1))}
            disabled={currentPage >= pages.length}
            style={{
              padding: '4px 8px',
              border: 'none',
              background: 'transparent',
              cursor: currentPage >= pages.length ? 'not-allowed' : 'pointer',
              opacity: currentPage >= pages.length ? 0.5 : 1
            }}
          >
            ▶
          </button>
        </div>
      )}
    </div>
  )
}

export function useSmartPagination(content: string, pageSetup: PageSetup = defaultPageSetup) {
  const [pages, setPages] = useState<PageContent[]>([])
  const measureRef = useRef<HTMLDivElement | null>(null)
  
  const pageWidth = pageSetup.width * MM_TO_PX
  const pageHeight = pageSetup.height * MM_TO_PX
  const marginTop = pageSetup.marginTop * MM_TO_PX
  const marginBottom = pageSetup.marginBottom * MM_TO_PX
  const marginLeft = pageSetup.marginLeft * MM_TO_PX
  const marginRight = pageSetup.marginRight * MM_TO_PX
  
  const contentHeight = pageHeight - marginTop - marginBottom
  const contentWidth = pageWidth - marginLeft - marginRight

  useEffect(() => {
    if (!content) {
      setPages([])
      return
    }

    if (!measureRef.current) {
      measureRef.current = document.createElement('div')
      measureRef.current.style.cssText = `
        position: absolute;
        visibility: hidden;
        pointer-events: none;
        left: -9999px;
        top: -9999px;
      `
      document.body.appendChild(measureRef.current)
    }

    const measure = measureRef.current
    measure.innerHTML = content
    measure.style.width = `${contentWidth}px`
    measure.style.fontFamily = "'SimSun', serif"
    measure.style.fontSize = '12pt'
    measure.style.lineHeight = '1.8'

    const resultPages: PageContent[] = []
    const elements = Array.from(measure.children)
    let currentPageContent: Element[] = []
    let currentHeight = 0
    let pageNumber = 1

    const flushPage = () => {
      if (currentPageContent.length > 0) {
        const wrapper = document.createElement('div')
        currentPageContent.forEach(el => wrapper.appendChild(el.cloneNode(true)))
        resultPages.push({
          id: `page-${pageNumber}`,
          html: wrapper.innerHTML,
          pageNumber
        })
        pageNumber++
        currentPageContent = []
        currentHeight = 0
      }
    }

    elements.forEach(element => {
      const clone = element.cloneNode(true) as Element
      measure.innerHTML = ''
      measure.appendChild(clone)
      const elementHeight = measure.getBoundingClientRect().height

      if (elementHeight > contentHeight) {
        flushPage()
        
        const tagName = element.tagName.toLowerCase()
        if (['table', 'img', 'ul', 'ol', 'div'].includes(tagName)) {
          currentPageContent.push(element.cloneNode(true) as Element)
          currentHeight = elementHeight
        } else {
          const chunks = splitElementByHeight(element, contentHeight, contentWidth)
          chunks.forEach((chunk, idx) => {
            if (idx > 0) flushPage()
            currentPageContent.push(chunk)
            currentHeight = measure.getBoundingClientRect().height
          })
        }
      } else if (currentHeight + elementHeight > contentHeight) {
        flushPage()
        currentPageContent.push(element.cloneNode(true) as Element)
        currentHeight = elementHeight
      } else {
        currentPageContent.push(element.cloneNode(true) as Element)
        currentHeight += elementHeight
      }
    })

    flushPage()

    if (resultPages.length === 0) {
      resultPages.push({
        id: 'page-1',
        html: content,
        pageNumber: 1
      })
    }

    setPages(resultPages)
  }, [content, contentHeight, contentWidth, pageSetup])

  useEffect(() => {
    return () => {
      if (measureRef.current && measureRef.current.parentNode) {
        measureRef.current.parentNode.removeChild(measureRef.current)
        measureRef.current = null
      }
    }
  }, [])

  return pages
}

function splitElementByHeight(element: Element, maxHeight: number, width: number): Element[] {
  const tagName = element.tagName.toLowerCase()
  
  if (tagName === 'p' || tagName === 'div') {
    const text = element.textContent || ''
    const words = text.split(/(\s+)/)
    const chunks: Element[] = []
    let currentChunk = document.createElement(tagName)
    let currentText = ''
    
    const measure = document.createElement('div')
    measure.style.cssText = `
      position: absolute;
      visibility: hidden;
      width: ${width}px;
      font-family: 'SimSun', serif;
      font-size: 12pt;
      line-height: 1.8;
    `
    document.body.appendChild(measure)
    
    for (let i = 0; i < words.length; i++) {
      const testText = currentText + words[i]
      measure.textContent = testText
      const height = measure.getBoundingClientRect().height
      
      if (height > maxHeight && currentText) {
        currentChunk.textContent = currentText.trim()
        Array.from(element.attributes).forEach(attr => {
          currentChunk.setAttribute(attr.name, attr.value)
        })
        chunks.push(currentChunk)
        currentChunk = document.createElement(tagName)
        currentText = words[i]
      } else {
        currentText = testText
      }
    }
    
    if (currentText.trim()) {
      currentChunk.textContent = currentText.trim()
      Array.from(element.attributes).forEach(attr => {
        currentChunk.setAttribute(attr.name, attr.value)
      })
      chunks.push(currentChunk)
    }
    
    document.body.removeChild(measure)
    return chunks.length > 0 ? chunks : [element]
  }
  
  return [element]
}

export function getPaginationStyles(): string {
  return `
    .smart-pagination {
      background: #e8e8e8;
      padding: 20px;
      min-height: 100vh;
    }
    
    .smart-pagination .page-wrapper {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    @media print {
      .smart-pagination {
        background: white;
        padding: 0;
      }
      
      .smart-pagination .page-wrapper {
        page-break-after: always;
        break-after: page;
        box-shadow: none;
        margin-bottom: 0;
      }
      
      .smart-pagination .page-wrapper:last-child {
        page-break-after: avoid;
        break-after: avoid;
      }
      
      .page-navigation {
        display: none !important;
      }
    }
    
    .smart-pagination .page-content {
      outline: none;
    }
    
    .smart-pagination .page-content:focus {
      outline: 2px solid #2b5797;
      outline-offset: -2px;
    }
    
    .smart-pagination .page-content h1 {
      text-align: center;
      font-size: 24pt;
      font-weight: bold;
      margin: 40px 0 30px 0;
      color: #2c3e50;
    }
    
    .smart-pagination .page-content h2 {
      text-align: left;
      font-size: 18pt;
      font-weight: bold;
      margin: 30px 0 20px 0;
      color: #34495e;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 8px;
    }
    
    .smart-pagination .page-content h3 {
      text-align: left;
      font-size: 14pt;
      font-weight: bold;
      margin: 20px 0 15px 0;
      color: #555;
    }
    
    .smart-pagination .page-content p {
      text-indent: 2em;
      margin: 12px 0;
      line-height: 1.8;
      text-align: justify;
    }
    
    .smart-pagination .page-content ul,
    .smart-pagination .page-content ol {
      margin-left: 3em;
      margin-top: 10px;
      margin-bottom: 15px;
    }
    
    .smart-pagination .page-content li {
      margin: 8px 0;
      line-height: 1.6;
    }
    
    .smart-pagination .page-content img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 25px auto;
    }
    
    .smart-pagination .page-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    .smart-pagination .page-content table,
    .smart-pagination .page-content th,
    .smart-pagination .page-content td {
      border: 1px solid #ddd;
    }
    
    .smart-pagination .page-content th {
      background-color: #f2f2f2;
      padding: 12px;
      text-align: center;
      font-weight: bold;
    }
    
    .smart-pagination .page-content td {
      padding: 10px;
      text-align: left;
    }
  `
}

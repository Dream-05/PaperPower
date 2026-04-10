const ALLOWED_TAGS = [
  'p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup',
  'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'blockquote', 'pre', 'code', 'hr', 'font', 'center'
]

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'title', 'target', 'rel'],
  'img': ['src', 'alt', 'title', 'width', 'height'],
  'font': ['color', 'size', 'face'],
  'span': ['style', 'class'],
  'div': ['style', 'class', 'align'],
  'p': ['style', 'class', 'align'],
  'table': ['style', 'class', 'border', 'cellpadding', 'cellspacing', 'width'],
  'td': ['style', 'class', 'colspan', 'rowspan', 'width', 'align', 'valign'],
  'th': ['style', 'class', 'colspan', 'rowspan', 'width', 'align', 'valign'],
  'tr': ['style', 'class'],
  'h1': ['style', 'class', 'align'],
  'h2': ['style', 'class', 'align'],
  'h3': ['style', 'class', 'align'],
  'h4': ['style', 'class', 'align'],
  'h5': ['style', 'class', 'align'],
  'h6': ['style', 'class', 'align'],
  'blockquote': ['style', 'class'],
  'pre': ['style', 'class'],
  'code': ['style', 'class'],
  'hr': ['style', 'class', 'width', 'size', 'noshade'],
  'center': ['style', 'class']
}

const ALLOWED_STYLE_PROPERTIES = [
  'color', 'background-color', 'font-size', 'font-family', 'font-weight',
  'font-style', 'text-decoration', 'text-align', 'line-height',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'border', 'border-color', 'border-width', 'border-style',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'display', 'vertical-align', 'white-space', 'word-wrap', 'word-break'
]

function sanitizeStyle(style: string): string {
  const styles = style.split(';').filter(s => s.trim())
  const sanitizedStyles: string[] = []
  
  for (const s of styles) {
    const [property, value] = s.split(':').map(part => part.trim())
    if (property && value && ALLOWED_STYLE_PROPERTIES.includes(property.toLowerCase())) {
      if (!value.includes('expression') && 
          !value.includes('javascript') && 
          !value.includes('vbscript') &&
          !value.includes('url(') &&
          !value.includes('import(')) {
        sanitizedStyles.push(`${property}: ${value}`)
      }
    }
  }
  
  return sanitizedStyles.join('; ')
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase()
  
  if (trimmed.startsWith('javascript:') || 
      trimmed.startsWith('vbscript:') || 
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:')) {
    return ''
  }
  
  return url
}

export function sanitizeHtml(html: string): string {
  if (!html) return ''
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  function sanitizeNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true)
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()
      
      if (!ALLOWED_TAGS.includes(tagName)) {
        const fragment = document.createDocumentFragment()
        for (const child of Array.from(element.childNodes)) {
          const sanitizedChild = sanitizeNode(child)
          if (sanitizedChild) {
            fragment.appendChild(sanitizedChild)
          }
        }
        return fragment
      }
      
      const newElement = document.createElement(tagName)
      
      const allowedAttrs = ALLOWED_ATTRIBUTES[tagName] || []
      for (const attr of Array.from(element.attributes)) {
        const attrName = attr.name.toLowerCase()
        
        if (allowedAttrs.includes(attrName)) {
          let attrValue = attr.value
          
          if (attrName === 'href' || attrName === 'src') {
            attrValue = sanitizeUrl(attrValue)
            if (!attrValue) continue
          }
          
          if (attrName === 'style') {
            attrValue = sanitizeStyle(attrValue)
            if (!attrValue) continue
          }
          
          if (attrName === 'target') {
            attrValue = '_blank'
            newElement.setAttribute('rel', 'noopener noreferrer')
          }
          
          newElement.setAttribute(attrName, attrValue)
        }
      }
      
      for (const child of Array.from(element.childNodes)) {
        const sanitizedChild = sanitizeNode(child)
        if (sanitizedChild) {
          newElement.appendChild(sanitizedChild)
        }
      }
      
      return newElement
    }
    
    return null
  }
  
  const result = document.createDocumentFragment()
  for (const child of Array.from(tempDiv.childNodes)) {
    const sanitizedChild = sanitizeNode(child)
    if (sanitizedChild) {
      result.appendChild(sanitizedChild)
    }
  }
  
  const resultDiv = document.createElement('div')
  resultDiv.appendChild(result)
  
  return resultDiv.innerHTML
}

export function stripHtml(html: string): string {
  if (!html) return ''
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  return tempDiv.textContent || tempDiv.innerText || ''
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  
  return text.replace(/[&<>"']/g, char => map[char])
}

export function unescapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&#39;': "'"
  }
  
  return text.replace(/&(amp|lt|gt|quot|#039|#39);/g, entity => map[entity] || entity)
}

export function isHtmlSafe(html: string): boolean {
  const sanitized = sanitizeHtml(html)
  return sanitized === html
}

export function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    if (obj.includes('<') && obj.includes('>')) {
      return sanitizeHtml(obj)
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item))
  }

  if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value)
    }
    return result
  }

  return obj
}

export function renderMarkdown(text: string): string {
  if (!text) return ''
  let html = escapeHtml(text)
  html = html.replace(/\n{3,}/g, '\n\n')
  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => `<pre><code>${code.trim()}</code></pre>`)
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, src) => {
    const safeSrc = sanitizeUrl(src)
    return safeSrc ? `<img src="${safeSrc}" alt="${alt}" style="max-width:100%;border-radius:8px;margin:8px 0;" />` : `[图片: ${alt}]`
  })
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, url) => {
    const safeUrl = sanitizeUrl(url)
    return safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${linkText}</a>` : `[${linkText}]`
  })
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:1.1rem;font-weight:700;margin:16px 0 8px;">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1.25rem;font-weight:700;margin:20px 0 10px;">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:1.5rem;font-weight:700;margin:24px 0 12px;">$1</h1>')
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>')
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #d1d5db;padding-left:12px;color:#6b7280;margin:8px 0;">$1</blockquote>')
  html = html.replace(/^\| (.+) \|$/gm, (_match, rowContent) => {
    const cells = rowContent.split(' | ').map(cell => cell.trim())
    const isHeaderRow = cells.every(c => /^[-:]+$/.test(c) || c === '')
    if (isHeaderRow) return ''
    const tag = 'td'
    return `<tr>${cells.map(c => `<${tag} style="border:1px solid #e5e7eb;padding:8px 12px;">${c}</${tag}>`).join('')}</tr>`
  })
  const lines = html.split('\n')
  let inTable = false
  let listType: 'ul' | 'ol' | null = null
  const resultLines: string[] = []

  function closeList() {
    if (listType) {
      resultLines.push(listType === 'ul' ? '</ul>' : '</ol>')
      listType = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\| .+ \|$/.test(line)) {
      closeList()
      if (!inTable) {
        inTable = true
        resultLines.push('<table style="border-collapse:collapse;width:100%;margin:12px 0;">')
      }
      if (line.includes('---')) continue
      resultLines.push(line)
      if (i + 1 >= lines.length || !/^\| .+ \|$/.test(lines[i + 1])) {
        resultLines.push('</table>')
        inTable = false
      }
    } else if (/^[-*] /.test(line)) {
      if (listType !== 'ul') {
        closeList()
        listType = 'ul'
        resultLines.push('<ul style="padding-left:20px;margin:8px 0;">')
      }
      resultLines.push(`<li style="margin:4px 0;">${line.replace(/^[-*] /, '')}</li>`)
    } else if (/^\d+\. /.test(line)) {
      if (listType !== 'ol') {
        closeList()
        listType = 'ol'
        resultLines.push('<ol style="padding-left:20px;margin:8px 0;">')
      }
      resultLines.push(`<li style="margin:4px 0;">${line.replace(/^\d+\. /, '')}</li>`)
    } else {
      closeList()
      if (line.trim()) {
        resultLines.push(`<p style="margin:6px 0;line-height:1.6;">${line}</p>`)
      }
    }
  }
  closeList()
  if (inTable) resultLines.push('</table>')
  html = resultLines.join('\n')
  return sanitizeHtml(html)
}

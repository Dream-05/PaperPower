import { useState, useEffect } from 'react'

export interface TableConfig {
  rows: number
  cols: number
  width: string
  borderStyle: string
  borderColor: string
  cellPadding: number
  headerRow: boolean
}

export interface TableCell {
  content: string
  rowSpan: number
  colSpan: number
}

export const defaultTableConfig: TableConfig = {
  rows: 3,
  cols: 3,
  width: '100%',
  borderStyle: 'solid',
  borderColor: '#000000',
  cellPadding: 5,
  headerRow: true
}

export const tableStyles = [
  { id: 'normal', label: '普通表格', style: 'border-collapse: collapse; width: 100%;' },
  { id: 'grid', label: '网格型', style: 'border-collapse: collapse; width: 100%; border: 1px solid #000;' },
  { id: 'light', label: '浅色边框', style: 'border-collapse: collapse; width: 100%; border: 1px solid #ccc;' },
  { id: 'professional', label: '专业型', style: 'border-collapse: collapse; width: 100%; border-top: 2px solid #000; border-bottom: 2px solid #000;' },
  { id: 'elegant', label: '典雅型', style: 'border-collapse: collapse; width: 100%; border: 2px double #000;' },
  { id: 'none', label: '无边框', style: 'border-collapse: collapse; width: 100%;' },
]

interface TableInsertDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (config: TableConfig) => void
}

export function TableInsertDialog({ isOpen, onClose, onInsert }: TableInsertDialogProps) {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [width, setWidth] = useState('100%')
  const [headerRow, setHeaderRow] = useState(true)
  const [selectedStyle, setSelectedStyle] = useState('normal')
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null)
  
  const handleInsert = () => {
    onInsert({
      rows,
      cols,
      width,
      borderStyle: selectedStyle,
      borderColor: '#000000',
      cellPadding: 5,
      headerRow
    })
    onClose()
  }
  
  const handleQuickSelect = (row: number, col: number) => {
    setRows(row)
    setCols(col)
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-[400px]">
        <h3 className="text-lg font-medium mb-4">插入表格</h3>
        
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">快速选择</label>
          <div className="grid grid-cols-8 gap-0.5 p-2 bg-gray-50 rounded">
            {Array.from({ length: 8 }).map((_, row) => (
              Array.from({ length: 8 }).map((_, col) => (
                <div
                  key={`${row}-${col}`}
                  className={`w-5 h-5 border cursor-pointer ${
                    hoverCell && row <= hoverCell.row && col <= hoverCell.col
                      ? 'bg-blue-100 border-blue-300'
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}
                  onMouseEnter={() => setHoverCell({ row, col })}
                  onClick={() => {
                    handleQuickSelect(row + 1, col + 1)
                    onInsert({
                      rows: row + 1,
                      cols: col + 1,
                      width: '100%',
                      borderStyle: 'normal',
                      borderColor: '#000000',
                      cellPadding: 5,
                      headerRow: true
                    })
                    onClose()
                  }}
                />
              ))
            ))}
          </div>
          {hoverCell && (
            <p className="text-xs text-gray-500 mt-1 text-center">
              {hoverCell.row + 1} × {hoverCell.col + 1} 表格
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">行数</label>
            <input
              type="number"
              min="1"
              max="100"
              value={rows}
              onChange={e => setRows(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              className="w-full h-8 px-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">列数</label>
            <input
              type="number"
              min="1"
              max="26"
              value={cols}
              onChange={e => setCols(Math.max(1, Math.min(26, parseInt(e.target.value) || 1)))}
              className="w-full h-8 px-2 border border-gray-300 rounded"
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">表格宽度</label>
          <select
            value={width}
            onChange={e => setWidth(e.target.value)}
            className="w-full h-8 px-2 border border-gray-300 rounded"
          >
            <option value="100%">自动 (100%)</option>
            <option value="50%">50%</option>
            <option value="75%">75%</option>
            <option value="fixed">固定宽度</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">表格样式</label>
          <div className="grid grid-cols-3 gap-2">
            {tableStyles.slice(0, 6).map(style => (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                className={`p-2 text-xs border rounded ${
                  selectedStyle === style.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={headerRow}
              onChange={e => setHeaderRow(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-600">包含标题行</span>
          </label>
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
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            插入
          </button>
        </div>
      </div>
    </div>
  )
}

interface TableContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  onClose: () => void
  onInsertRowAbove: () => void
  onInsertRowBelow: () => void
  onInsertColLeft: () => void
  onInsertColRight: () => void
  onDeleteRow: () => void
  onDeleteCol: () => void
  onDeleteTable: () => void
  onMergeCells: () => void
  onSplitCell: () => void
  canMerge: boolean
  canSplit: boolean
}

export function TableContextMenu({
  isOpen,
  position,
  onClose,
  onInsertRowAbove,
  onInsertRowBelow,
  onInsertColLeft,
  onInsertColRight,
  onDeleteRow,
  onDeleteCol,
  onDeleteTable,
  onMergeCells,
  onSplitCell,
  canMerge,
  canSplit
}: TableContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose()
    if (isOpen) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [isOpen, onClose])
  
  if (!isOpen) return null
  
  return (
    <div
      className="fixed bg-white border border-gray-200 rounded shadow-lg py-1 z-50 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-3 py-1 text-xs text-gray-400 border-b">行操作</div>
      <button
        onClick={() => { onInsertRowAbove(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
      >
        在上方插入行
      </button>
      <button
        onClick={() => { onInsertRowBelow(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
      >
        在下方插入行
      </button>
      <button
        onClick={() => { onDeleteRow(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 text-red-600"
      >
        删除行
      </button>
      
      <div className="px-3 py-1 text-xs text-gray-400 border-t border-b mt-1">列操作</div>
      <button
        onClick={() => { onInsertColLeft(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
      >
        在左侧插入列
      </button>
      <button
        onClick={() => { onInsertColRight(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
      >
        在右侧插入列
      </button>
      <button
        onClick={() => { onDeleteCol(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 text-red-600"
      >
        删除列
      </button>
      
      <div className="px-3 py-1 text-xs text-gray-400 border-t border-b mt-1">单元格</div>
      {canMerge && (
        <button
          onClick={() => { onMergeCells(); onClose() }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
        >
          合并单元格
        </button>
      )}
      {canSplit && (
        <button
          onClick={() => { onSplitCell(); onClose() }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
        >
          拆分单元格
        </button>
      )}
      
      <div className="border-t mt-1 pt-1">
        <button
          onClick={() => { onDeleteTable(); onClose() }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 text-red-600"
        >
          删除表格
        </button>
      </div>
    </div>
  )
}

export function generateTableHTML(config: TableConfig): string {
  const { rows, cols, width, borderStyle, headerRow } = config
  
  let style = `width: ${width}; border-collapse: collapse; `
  
  switch (borderStyle) {
    case 'grid':
      style += 'border: 1px solid #000;'
      break
    case 'light':
      style += 'border: 1px solid #ccc;'
      break
    case 'professional':
      style += 'border-top: 2px solid #000; border-bottom: 2px solid #000;'
      break
    case 'elegant':
      style += 'border: 2px double #000;'
      break
    case 'none':
      break
    default:
      style += 'border: 1px solid #000;'
  }
  
  let html = `<table style="${style}">\n`
  
  for (let i = 0; i < rows; i++) {
    html += '<tr>\n'
    for (let j = 0; j < cols; j++) {
      const isHeader = headerRow && i === 0
      const tag = isHeader ? 'th' : 'td'
      const cellStyle = `border: 1px solid #000; padding: 5px; ${isHeader ? 'background-color: #f0f0f0; font-weight: bold;' : ''}`
      html += `<${tag} style="${cellStyle}">&nbsp;</${tag}>\n`
    }
    html += '</tr>\n'
  }
  
  html += '</table>'
  return html
}

export function insertTableAtCursor(config: TableConfig): void {
  const html = generateTableHTML(config)
  document.execCommand('insertHTML', false, html)
}

export function getTableFromSelection(): HTMLTableElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  
  let node = selection.anchorNode
  while (node && node.nodeType !== Node.ELEMENT_NODE) {
    node = node.parentNode
  }
  
  while (node) {
    if ((node as Element).tagName === 'TABLE') {
      return node as HTMLTableElement
    }
    node = node.parentNode
  }
  
  return null
}

export function getCellFromSelection(): HTMLTableCellElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  
  let node = selection.anchorNode
  while (node && node.nodeType !== Node.ELEMENT_NODE) {
    node = node.parentNode
  }
  
  while (node) {
    const tagName = (node as Element).tagName
    if (tagName === 'TD' || tagName === 'TH') {
      return node as HTMLTableCellElement
    }
    node = node.parentNode
  }
  
  return null
}

export function getCellPosition(cell: HTMLTableCellElement): { row: number; col: number } {
  const row = cell.parentElement as HTMLTableRowElement
  const table = row?.parentElement as HTMLTableElement
  if (!table) return { row: -1, col: -1 }
  
  const rowIndex = Array.from(table.rows).indexOf(row)
  const colIndex = Array.from(row.cells).indexOf(cell)
  
  return { row: rowIndex, col: colIndex }
}

export function insertRow(table: HTMLTableElement, afterRow: number): void {
  const newRow = table.insertRow(afterRow + 1)
  const colCount = table.rows[0]?.cells.length || 0
  
  for (let i = 0; i < colCount; i++) {
    const cell = newRow.insertCell()
    cell.innerHTML = '&nbsp;'
    cell.style.border = '1px solid #000'
    cell.style.padding = '5px'
  }
}

export function deleteRow(table: HTMLTableElement, rowIndex: number): void {
  if (table.rows.length > 1) {
    table.deleteRow(rowIndex)
  }
}

export function insertColumn(table: HTMLTableElement, afterCol: number): void {
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]
    const cell = row.insertCell(afterCol + 1)
    cell.innerHTML = '&nbsp;'
    cell.style.border = '1px solid #000'
    cell.style.padding = '5px'
  }
}

export function deleteColumn(table: HTMLTableElement, colIndex: number): void {
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]
    if (row.cells.length > 1) {
      row.deleteCell(colIndex)
    }
  }
}

export function mergeCells(table: HTMLTableElement, startRow: number, startCol: number, endRow: number, endCol: number): void {
  const startCell = table.rows[startRow]?.cells[startCol]
  if (!startCell) return
  
  const rowSpan = endRow - startRow + 1
  const colSpan = endCol - startCol + 1
  
  startCell.rowSpan = rowSpan
  startCell.colSpan = colSpan
  
  for (let i = startRow; i <= endRow; i++) {
    for (let j = startCol; j <= endCol; j++) {
      if (i === startRow && j === startCol) continue
      const cell = table.rows[i]?.cells[j]
      if (cell) {
        cell.style.display = 'none'
      }
    }
  }
}

export function splitCell(table: HTMLTableElement, row: number, col: number): void {
  const cell = table.rows[row]?.cells[col]
  if (!cell) return
  
  const rowSpan = cell.rowSpan
  const colSpan = cell.colSpan
  
  cell.rowSpan = 1
  cell.colSpan = 1
  
  for (let i = row; i < row + rowSpan; i++) {
    for (let j = col; j < col + colSpan; j++) {
      if (i === row && j === col) continue
      const currentRow = table.rows[i]
      if (currentRow) {
        const newCell = currentRow.insertCell(j)
        newCell.innerHTML = '&nbsp;'
        newCell.style.border = '1px solid #000'
        newCell.style.padding = '5px'
      }
    }
  }
}

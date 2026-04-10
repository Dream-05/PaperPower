export interface FileSystemHandle {
  kind: 'file' | 'directory'
  name: string
}

export interface FileHandle extends FileSystemHandle {
  kind: 'file'
  getFile(): Promise<File>
  createWritable(): Promise<FileSystemWritableFileStream>
}

export interface DirectoryHandle extends FileSystemHandle {
  kind: 'directory'
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>
  values(): AsyncIterable<FileSystemHandle>
  keys(): AsyncIterable<string>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string | { type: string; data?: unknown }): Promise<void>
  seek(position: number): Promise<void>
  truncate(size: number): Promise<void>
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      multiple?: boolean
      excludeAcceptAllOption?: boolean
      types?: Array<{
        description?: string
        accept: Record<string, string[]>
      }>
    }) => Promise<FileHandle[]>
    
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: Array<{
        description?: string
        accept: Record<string, string[]>
      }>
    }) => Promise<FileHandle>
    
    showDirectoryPicker?: (options?: {
      id?: string
      mode?: 'read' | 'readwrite'
    }) => Promise<DirectoryHandle>
  }
}

export class FileSystemAccess {
  private static instance: FileSystemAccess
  private directoryHandle: DirectoryHandle | null = null
  
  static getInstance(): FileSystemAccess {
    if (!FileSystemAccess.instance) {
      FileSystemAccess.instance = new FileSystemAccess()
    }
    return FileSystemAccess.instance
  }
  
  isSupported(): boolean {
    return 'showOpenFilePicker' in window && 
           'showSaveFilePicker' in window && 
           'showDirectoryPicker' in window
  }
  
  async openFile(options?: {
    multiple?: boolean
    extensions?: string[]
  }): Promise<FileHandle[] | null> {
    if (!this.isSupported()) {
      throw new Error('File System Access API 不支持')
    }
    
    const pickerOptions = {
      multiple: options?.multiple ?? false,
      types: options?.extensions ? [{
        accept: {
          'application/*': options.extensions.map(ext => `.${ext}`)
        }
      }] : undefined
    }
    
    try {
      const handles = await window.showOpenFilePicker!(pickerOptions)
      return handles
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null
      }
      throw error
    }
  }
  
  async saveFile(
    content: BufferSource | Blob | string,
    suggestedName?: string,
    extension?: string
  ): Promise<FileHandle | null> {
    if (!this.isSupported()) {
      throw new Error('File System Access API 不支持')
    }
    
    const pickerOptions = {
      suggestedName,
      types: extension ? [{
        accept: {
          'application/octet-stream': [`.${extension}`]
        }
      }] : undefined
    }
    
    try {
      const handle = await window.showSaveFilePicker!(pickerOptions)
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return handle
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null
      }
      throw error
    }
  }
  
  async openDirectory(): Promise<DirectoryHandle | null> {
    if (!this.isSupported()) {
      throw new Error('File System Access API 不支持')
    }
    
    try {
      this.directoryHandle = await window.showDirectoryPicker!({ mode: 'readwrite' })
      return this.directoryHandle
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null
      }
      throw error
    }
  }
  
  async listFiles(directoryHandle?: DirectoryHandle): Promise<FileSystemHandle[]> {
    const handle = directoryHandle || this.directoryHandle
    if (!handle) {
      throw new Error('未选择目录')
    }
    
    const files: FileSystemHandle[] = []
    for await (const entry of handle.values()) {
      files.push(entry)
    }
    
    return files.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name, 'zh-CN')
    })
  }
  
  async readFile(fileHandle: FileHandle): Promise<ArrayBuffer> {
    const file = await fileHandle.getFile()
    return file.arrayBuffer()
  }
  
  async readTextFile(fileHandle: FileHandle): Promise<string> {
    const file = await fileHandle.getFile()
    return file.text()
  }
  
  async writeFile(
    fileHandle: FileHandle,
    content: BufferSource | Blob | string
  ): Promise<void> {
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  }
  
  async createFile(
    directoryHandle: DirectoryHandle,
    name: string,
    content?: BufferSource | Blob | string
  ): Promise<FileHandle> {
    const fileHandle = await directoryHandle.getFileHandle(name, { create: true })
    
    if (content !== undefined) {
      await this.writeFile(fileHandle, content)
    }
    
    return fileHandle
  }
  
  async createDirectory(
    parentHandle: DirectoryHandle,
    name: string
  ): Promise<DirectoryHandle> {
    return parentHandle.getDirectoryHandle(name, { create: true })
  }
  
  async deleteEntry(
    directoryHandle: DirectoryHandle,
    name: string,
    recursive: boolean = false
  ): Promise<void> {
    await directoryHandle.removeEntry(name, { recursive })
  }
  
  async renameFile(
    directoryHandle: DirectoryHandle,
    oldName: string,
    newName: string
  ): Promise<FileHandle> {
    const oldHandle = await directoryHandle.getFileHandle(oldName)
    const content = await this.readFile(oldHandle)
    
    const newHandle = await directoryHandle.getFileHandle(newName, { create: true })
    await this.writeFile(newHandle, content)
    
    await directoryHandle.removeEntry(oldName)
    
    return newHandle
  }
  
  async organizeFilesByType(
    directoryHandle: DirectoryHandle,
    excludePatterns: string[] = []
  ): Promise<{ organized: number; skipped: number }> {
    const files = await this.listFiles(directoryHandle)
    const typeFolders: Record<string, DirectoryHandle> = {}
    
    let organized = 0
    let skipped = 0
    
    for (const file of files) {
      if (file.kind === 'directory') continue
      
      const shouldExclude = excludePatterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(file.name)
      })
      
      if (shouldExclude) {
        skipped++
        continue
      }
      
      const extension = file.name.split('.').pop()?.toLowerCase() || 'other'
      const folderName = this.getFolderNameForExtension(extension)
      
      if (!typeFolders[folderName]) {
        typeFolders[folderName] = await this.createDirectory(directoryHandle, folderName)
      }
    }
    
    return { organized, skipped }
  }
  
  private getFolderNameForExtension(extension: string): string {
    const extensionMap: Record<string, string> = {
      doc: '文档',
      docx: '文档',
      pdf: '文档',
      txt: '文档',
      xls: '表格',
      xlsx: '表格',
      csv: '表格',
      ppt: '演示',
      pptx: '演示',
      jpg: '图片',
      jpeg: '图片',
      png: '图片',
      gif: '图片',
      mp4: '视频',
      avi: '视频',
      mp3: '音频',
      wav: '音频',
      zip: '压缩包',
      rar: '压缩包',
      '7z': '压缩包'
    }
    
    return extensionMap[extension] || '其他'
  }
}

export const fileSystem = FileSystemAccess.getInstance()

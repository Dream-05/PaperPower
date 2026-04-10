/**
 * PPT智能命令处理器
 * 支持自然语言操作PPT
 */

export interface PPTCommand {
  type: 'add' | 'modify' | 'delete' | 'format' | 'move' | 'insert' | 'style'
  target: 'slide' | 'toc' | 'content' | 'title' | 'image' | 'text' | 'directory' | 'table' | 'chart' | 'shape'
  params: Record<string, any>
  description: string
}

export interface PPTSlide {
  id: string
  title: string
  content: string[]
  notes: string
  layout: 'title' | 'title-content' | 'two-column' | 'blank'
  backgroundColor: string
  backgroundImage?: string
}

export class PPTCommandProcessor {
  
  /**
   * 解析用户的自然语言指令
   */
  static parseCommand(input: string): PPTCommand | null {
    // 转换为小写以进行不区分大小写的匹配
    
    // 目录相关操作
    if (this.matchKeywords(input, ['目录', '目录页'])) {
      return this.parseTOCCommand(input)
    }
    
    // 幻灯片操作
    if (this.matchKeywords(input, ['幻灯片', '页面', '页', 'slide'])) {
      return this.parseSlideCommand(input)
    }
    
    // 格式操作
    if (this.matchKeywords(input, ['加粗', '斜体', '下划线', '字体', '字号', '颜色', '格式'])) {
      return this.parseFormatCommand(input)
    }
    
    // 内容操作
    if (this.matchKeywords(input, ['内容', '文字', '文本', '段落'])) {
      return this.parseContentCommand(input)
    }
    
    // 样式操作
    if (this.matchKeywords(input, ['样式', '风格', '模板', '主题'])) {
      return this.parseStyleCommand(input)
    }
    
    // 插入操作
    if (this.matchKeywords(input, ['插入', '添加', '增加', '新建'])) {
      return this.parseInsertCommand(input)
    }
    
    // 删除操作
    if (this.matchKeywords(input, ['删除', '移除', '去掉'])) {
      return this.parseDeleteCommand(input)
    }
    
    return null
  }
  
  /**
   * 匹配关键词
   */
  private static matchKeywords(input: string, keywords: string[]): boolean {
    return keywords.some(keyword => input.includes(keyword))
  }
  
  /**
   * 解析目录相关命令
   */
  private static parseTOCCommand(input: string): PPTCommand {
    // 转换为小写以进行不区分大小写的匹配
    
    // 添加目录
    if (this.matchKeywords(input, ['增加', '添加', '新建', '创建', '插入'])) {
      return {
        type: 'add',
        target: 'toc',
        params: { action: 'create' },
        description: '添加目录页'
      }
    }
    
    // 修改目录格式
    if (this.matchKeywords(input, ['纯文本', '文本格式', '不带格式'])) {
      return {
        type: 'modify',
        target: 'toc',
        params: { format: 'plain' },
        description: '将目录改为纯文本格式'
      }
    }
    
    // 取消二级目录加粗
    if (this.matchKeywords(input, ['二级目录', '二级标题', '子目录']) && 
        this.matchKeywords(input, ['取消加粗', '不加粗', '正常'])) {
      return {
        type: 'format',
        target: 'toc',
        params: { level: 2, bold: false },
        description: '取消二级目录的加粗格式'
      }
    }
    
    // 二级目录加粗
    if (this.matchKeywords(input, ['二级目录', '二级标题', '子目录']) && 
        this.matchKeywords(input, ['加粗', '粗体'])) {
      return {
        type: 'format',
        target: 'toc',
        params: { level: 2, bold: true },
        description: '将二级目录加粗'
      }
    }
    
    // 删除目录
    if (this.matchKeywords(input, ['删除', '移除', '去掉'])) {
      return {
        type: 'delete',
        target: 'toc',
        params: {},
        description: '删除目录页'
      }
    }
    
    // 更新目录
    if (this.matchKeywords(input, ['更新', '刷新', '重新生成'])) {
      return {
        type: 'modify',
        target: 'toc',
        params: { action: 'update' },
        description: '更新目录内容'
      }
    }
    
    return {
      type: 'modify',
      target: 'toc',
      params: {},
      description: '修改目录'
    }
  }
  
  /**
   * 解析幻灯片命令
   */
  private static parseSlideCommand(input: string): PPTCommand {
    // 提取页码
    const pageNumMatch = input.match(/第?(\d+)页?/)
    const pageNum = pageNumMatch ? parseInt(pageNumMatch[1]) : null
    
    // 添加幻灯片
    if (this.matchKeywords(input, ['增加', '添加', '新建', '创建', '插入'])) {
      return {
        type: 'add',
        target: 'slide',
        params: { position: pageNum || 'end' },
        description: pageNum ? `在第${pageNum}页后添加新幻灯片` : '添加新幻灯片'
      }
    }
    
    // 删除幻灯片
    if (this.matchKeywords(input, ['删除', '移除', '去掉'])) {
      return {
        type: 'delete',
        target: 'slide',
        params: { index: pageNum },
        description: pageNum ? `删除第${pageNum}页` : '删除当前幻灯片'
      }
    }
    
    // 移动幻灯片
    if (this.matchKeywords(input, ['移动', '调整', '交换'])) {
      const toMatch = input.match(/到?第?(\d+)页?/)
      const toPage = toMatch ? parseInt(toMatch[1]) : null
      return {
        type: 'move',
        target: 'slide',
        params: { from: pageNum, to: toPage },
        description: `移动幻灯片位置`
      }
    }
    
    // 复制幻灯片
    if (this.matchKeywords(input, ['复制', '拷贝'])) {
      return {
        type: 'add',
        target: 'slide',
        params: { action: 'copy', index: pageNum },
        description: pageNum ? `复制第${pageNum}页` : '复制当前幻灯片'
      }
    }
    
    return {
      type: 'modify',
      target: 'slide',
      params: { index: pageNum },
      description: '修改幻灯片'
    }
  }
  
  /**
   * 解析格式命令
   */
  private static parseFormatCommand(input: string): PPTCommand {
    const params: Record<string, any> = {}
    
    // 加粗
    if (this.matchKeywords(input, ['加粗', '粗体'])) {
      params.bold = true
    }
    if (this.matchKeywords(input, ['取消加粗', '不加粗', '正常字体'])) {
      params.bold = false
    }
    
    // 斜体
    if (this.matchKeywords(input, ['斜体', '倾斜'])) {
      params.italic = true
    }
    if (this.matchKeywords(input, ['取消斜体', '不斜体'])) {
      params.italic = false
    }
    
    // 下划线
    if (this.matchKeywords(input, ['下划线', '下划'])) {
      params.underline = true
    }
    if (this.matchKeywords(input, ['取消下划线', '无下划线'])) {
      params.underline = false
    }
    
    // 字体大小
    const sizeMatch = input.match(/(\d+)\s*(号|pt|px|磅)/)
    if (sizeMatch) {
      params.fontSize = parseInt(sizeMatch[1])
    }
    
    // 字体名称
    const fontMatch = input.match(/(宋体|黑体|微软雅黑|楷体|仿宋|Arial|Times)/)
    if (fontMatch) {
      params.fontFamily = fontMatch[1]
    }
    
    // 颜色
    const colorMatch = input.match(/(红色|蓝色|绿色|黑色|白色|灰色|黄色|橙色|紫色)/)
    if (colorMatch) {
      params.color = this.colorNameToHex(colorMatch[1])
    }
    
    return {
      type: 'format',
      target: 'text',
      params,
      description: '修改文本格式'
    }
  }
  
  /**
   * 解析内容命令
   */
  private static parseContentCommand(input: string): PPTCommand {
    // 增加内容
    if (this.matchKeywords(input, ['增加', '添加', '补充', '丰富'])) {
      return {
        type: 'add',
        target: 'content',
        params: {},
        description: '增加内容'
      }
    }
    
    // 删除内容
    if (this.matchKeywords(input, ['删除', '移除', '去掉'])) {
      return {
        type: 'delete',
        target: 'content',
        params: {},
        description: '删除内容'
      }
    }
    
    // 修改内容
    if (this.matchKeywords(input, ['修改', '更改', '替换'])) {
      return {
        type: 'modify',
        target: 'content',
        params: {},
        description: '修改内容'
      }
    }
    
    return {
      type: 'modify',
      target: 'content',
      params: {},
      description: '修改内容'
    }
  }
  
  /**
   * 解析样式命令
   */
  private static parseStyleCommand(input: string): PPTCommand {
    const params: Record<string, any> = {}
    
    // 主题风格
    if (this.matchKeywords(input, ['科技', '技术'])) {
      params.style = 'tech'
    }
    if (this.matchKeywords(input, ['商务', '企业'])) {
      params.style = 'business'
    }
    if (this.matchKeywords(input, ['简约', '极简', '简洁'])) {
      params.style = 'minimal'
    }
    if (this.matchKeywords(input, ['创意', '设计'])) {
      params.style = 'creative'
    }
    if (this.matchKeywords(input, ['学术', '教育'])) {
      params.style = 'academic'
    }
    
    // 背景色
    const bgMatch = input.match(/背景(色)?(为|改成?|设为)?(白色|黑色|蓝色|灰色|浅色|深色)/)
    if (bgMatch) {
      params.backgroundColor = this.colorNameToHex(bgMatch[3])
    }
    
    return {
      type: 'style',
      target: 'slide',
      params,
      description: '修改样式'
    }
  }
  
  /**
   * 解析插入命令
   */
  private static parseInsertCommand(input: string): PPTCommand {
    // 插入图片
    if (this.matchKeywords(input, ['图片', '图像', '照片'])) {
      return {
        type: 'insert',
        target: 'image',
        params: {},
        description: '插入图片'
      }
    }
    
    // 插入表格
    if (this.matchKeywords(input, ['表格'])) {
      const rowMatch = input.match(/(\d+)\s*行/)
      const colMatch = input.match(/(\d+)\s*列/)
      return {
        type: 'insert',
        target: 'table',
        params: {
          rows: rowMatch ? parseInt(rowMatch[1]) : 3,
          cols: colMatch ? parseInt(colMatch[1]) : 3
        },
        description: '插入表格'
      }
    }
    
    // 插入图表
    if (this.matchKeywords(input, ['图表', '柱状图', '饼图', '折线图'])) {
      let chartType = 'bar'
      if (input.includes('饼图')) chartType = 'pie'
      if (input.includes('折线图')) chartType = 'line'
      
      return {
        type: 'insert',
        target: 'chart',
        params: { chartType },
        description: '插入图表'
      }
    }
    
    // 插入形状
    if (this.matchKeywords(input, ['形状', '矩形', '圆形', '箭头'])) {
      return {
        type: 'insert',
        target: 'shape',
        params: {},
        description: '插入形状'
      }
    }
    
    return {
      type: 'insert',
      target: 'content',
      params: {},
      description: '插入内容'
    }
  }
  
  /**
   * 解析删除命令
   */
  private static parseDeleteCommand(input: string): PPTCommand {
    // 删除图片
    if (this.matchKeywords(input, ['图片', '图像'])) {
      return {
        type: 'delete',
        target: 'image',
        params: {},
        description: '删除图片'
      }
    }
    
    // 删除表格
    if (this.matchKeywords(input, ['表格'])) {
      return {
        type: 'delete',
        target: 'table',
        params: {},
        description: '删除表格'
      }
    }
    
    return {
      type: 'delete',
      target: 'content',
      params: {},
      description: '删除内容'
    }
  }
  
  /**
   * 颜色名称转十六进制
   */
  private static colorNameToHex(colorName: string): string {
    const colorMap: Record<string, string> = {
      '红色': '#FF0000',
      '蓝色': '#0000FF',
      '绿色': '#00FF00',
      '黑色': '#000000',
      '白色': '#FFFFFF',
      '灰色': '#808080',
      '黄色': '#FFFF00',
      '橙色': '#FFA500',
      '紫色': '#800080',
      '浅色': '#F5F5F5',
      '深色': '#333333'
    }
    return colorMap[colorName] || '#000000'
  }
  
  /**
   * 执行命令
   */
  static executeCommand(
    command: PPTCommand, 
    slides: PPTSlide[], 
    currentSlideIndex: number
  ): { slides: PPTSlide[], newIndex: number, message: string } {
    let newSlides = [...slides]
    let newIndex = currentSlideIndex
    let message = ''
    
    switch (command.type) {
      case 'add':
        const result = this.executeAdd(command, newSlides, currentSlideIndex)
        newSlides = result.slides
        newIndex = result.newIndex
        message = result.message
        break
        
      case 'delete':
        const deleteResult = this.executeDelete(command, newSlides, currentSlideIndex)
        newSlides = deleteResult.slides
        newIndex = deleteResult.newIndex
        message = deleteResult.message
        break
        
      case 'modify':
        const modifyResult = this.executeModify(command, newSlides)
        newSlides = modifyResult.slides
        message = modifyResult.message
        break
        
      case 'format':
        const formatResult = this.executeFormat(command, newSlides)
        newSlides = formatResult.slides
        message = formatResult.message
        break
        
      case 'move':
        const moveResult = this.executeMove(command, newSlides)
        newSlides = moveResult.slides
        message = moveResult.message
        break
        
      case 'style':
        const styleResult = this.executeStyle(command, newSlides)
        newSlides = styleResult.slides
        message = styleResult.message
        break
        
      default:
        message = '未知的命令类型'
    }
    
    return { slides: newSlides, newIndex, message }
  }
  
  /**
   * 执行添加操作
   */
  private static executeAdd(
    command: PPTCommand, 
    slides: PPTSlide[], 
    currentIndex: number
  ): { slides: PPTSlide[], newIndex: number, message: string } {
    if (command.target === 'toc') {
      // 添加目录页
      const tocSlide: PPTSlide = {
        id: `slide-${Date.now()}`,
        title: '目录',
        content: slides
          .filter(s => s.title && s.title !== '目录' && s.title !== '谢谢')
          .map((s, i) => `${i + 1}、${s.title}`),
        notes: '这是本次演示的主要内容目录。',
        layout: 'title-content',
        backgroundColor: '#ffffff'
      }
      
      const insertIndex = slides.findIndex(s => s.title === slides[0]?.title) + 1 || 1
      slides.splice(insertIndex, 0, tocSlide)
      
      return { 
        slides, 
        newIndex: insertIndex,
        message: '已添加目录页'
      }
    }
    
    if (command.target === 'slide') {
      const newSlide: PPTSlide = {
        id: `slide-${Date.now()}`,
        title: '',
        content: [''],
        notes: '',
        layout: 'title-content',
        backgroundColor: '#ffffff'
      }
      
      const position = command.params.position
      if (position === 'end' || typeof position !== 'number') {
        slides.push(newSlide)
        return { slides, newIndex: slides.length - 1, message: '已添加新幻灯片' }
      } else {
        slides.splice(position, 0, newSlide)
        return { slides, newIndex: position, message: `已在第${position}页后添加新幻灯片` }
      }
    }
    
    return { slides, newIndex: currentIndex, message: '添加操作完成' }
  }
  
  /**
   * 执行删除操作
   */
  private static executeDelete(
    command: PPTCommand, 
    slides: PPTSlide[], 
    currentIndex: number
  ): { slides: PPTSlide[], newIndex: number, message: string } {
    if (command.target === 'toc') {
      const tocIndex = slides.findIndex(s => s.title === '目录')
      if (tocIndex > -1) {
        slides.splice(tocIndex, 1)
        return { 
          slides, 
          newIndex: Math.min(currentIndex, slides.length - 1),
          message: '已删除目录页'
        }
      }
      return { slides, newIndex: currentIndex, message: '未找到目录页' }
    }
    
    if (command.target === 'slide') {
      const index = command.params.index || currentIndex
      if (index >= 0 && index < slides.length && slides.length > 1) {
        slides.splice(index, 1)
        return { 
          slides, 
          newIndex: Math.min(index, slides.length - 1),
          message: `已删除第${index + 1}页`
        }
      }
      return { slides, newIndex: currentIndex, message: '无法删除该幻灯片' }
    }
    
    return { slides, newIndex: currentIndex, message: '删除操作完成' }
  }
  
  /**
   * 执行修改操作
   */
  private static executeModify(
    command: PPTCommand, 
    slides: PPTSlide[]
  ): { slides: PPTSlide[], message: string } {
    if (command.target === 'toc') {
      const tocIndex = slides.findIndex(s => s.title === '目录')
      if (tocIndex > -1) {
        if (command.params.format === 'plain') {
          // 改为纯文本格式
          slides[tocIndex].content = slides[tocIndex].content.map(item => 
            item.replace(/[一二三四五六七八九十]、\s*/g, '').replace(/[·•●]/g, '-')
          )
          return { slides, message: '已将目录改为纯文本格式' }
        }
        
        if (command.params.action === 'update') {
          // 更新目录
          slides[tocIndex].content = slides
            .filter(s => s.title && s.title !== '目录' && s.title !== '谢谢')
            .map((s, i) => `${i + 1}、${s.title}`)
          return { slides, message: '已更新目录内容' }
        }
      }
      return { slides, message: '未找到目录页' }
    }
    
    return { slides, message: '修改操作完成' }
  }
  
  /**
   * 执行格式操作
   */
  private static executeFormat(
    command: PPTCommand, 
    slides: PPTSlide[]
  ): { slides: PPTSlide[], message: string } {
    if (command.target === 'toc') {
      const tocIndex = slides.findIndex(s => s.title === '目录')
      if (tocIndex > -1) {
        const { level, bold } = command.params
        
        if (level === 2) {
          // 处理二级目录格式
          slides[tocIndex].content = slides[tocIndex].content.map((item) => {
            // 假设二级目录是缩进的内容
            if (item.startsWith('  ') || item.includes('.')) {
              return bold ? `**${item}**` : item.replace(/\*\*/g, '')
            }
            return item
          })
          return { 
            slides, 
            message: bold ? '已将二级目录加粗' : '已取消二级目录加粗'
          }
        }
      }
      return { slides, message: '未找到目录页' }
    }
    
    return { slides, message: '格式操作完成' }
  }
  
  /**
   * 执行移动操作
   */
  private static executeMove(
    command: PPTCommand, 
    slides: PPTSlide[]
  ): { slides: PPTSlide[], message: string } {
    const { from, to } = command.params
    
    if (typeof from === 'number' && typeof to === 'number' && 
        from >= 0 && from < slides.length && to >= 0 && to < slides.length) {
      const [slide] = slides.splice(from, 1)
      slides.splice(to, 0, slide)
      return { slides, message: `已将第${from + 1}页移动到第${to + 1}页` }
    }
    
    return { slides, message: '移动操作失败，请指定正确的页码' }
  }
  
  /**
   * 执行样式操作
   */
  private static executeStyle(
    command: PPTCommand, 
    slides: PPTSlide[]
  ): { slides: PPTSlide[], message: string } {
    const { backgroundColor } = command.params
    
    if (backgroundColor) {
      slides = slides.map(slide => ({
        ...slide,
        backgroundColor
      }))
      return { slides, message: '已修改背景颜色' }
    }
    
    return { slides, message: '样式操作完成' }
  }
  
  /**
   * 获取命令建议
   */
  static getSuggestions(context: string): string[] {
    const suggestions: string[] = []
    
    if (context.includes('目录')) {
      suggestions.push(
        '帮我增加一个目录',
        '把目录改成纯文本格式',
        '取消二级目录加粗',
        '更新目录内容',
        '删除目录页'
      )
    }
    
    suggestions.push(
      '添加新幻灯片',
      '删除当前页',
      '在第3页后添加新页面',
      '将标题加粗',
      '修改字体为微软雅黑',
      '设置字号为24号',
      '插入一个3行4列的表格',
      '插入柱状图',
      '应用科技风格主题'
    )
    
    return suggestions
  }
}

export default PPTCommandProcessor

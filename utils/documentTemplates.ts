export interface DocumentTemplate {
  id: string
  name: string
  category: 'official' | 'academic' | 'business' | 'personal' | 'education'
  description: string
  preview?: string
  content: string
  styles: TemplateStyles
  placeholders?: TemplatePlaceholder[]
}

export interface TemplateStyles {
  fontFamily: string
  fontSize: number
  lineHeight: number
  titleSize: number
  titleAlign: 'left' | 'center' | 'right'
  paragraphIndent: number
  margins: {
    top: number
    bottom: number
    left: number
    right: number
  }
}

export interface TemplatePlaceholder {
  id: string
  label: string
  type: 'text' | 'date' | 'number' | 'select'
  options?: string[]
  defaultValue?: string
}

export const documentTemplates: DocumentTemplate[] = [
  {
    id: 'blank',
    name: '空白文档',
    category: 'personal',
    description: '从空白开始创建文档',
    content: '',
    styles: {
      fontFamily: 'SimSun, serif',
      fontSize: 12,
      lineHeight: 1.5,
      titleSize: 22,
      titleAlign: 'center',
      paragraphIndent: 2,
      margins: { top: 25, bottom: 25, left: 25, right: 25 }
    }
  },
  {
    id: 'official-document',
    name: '公文模板',
    category: 'official',
    description: '标准党政机关公文格式',
    content: `<h1 style="text-align: center; font-family: SimHei; font-size: 22pt;">标题</h1>
<p style="text-align: center; font-family: FangSong; font-size: 16pt;">（副标题）</p>
<p style="font-family: FangSong; font-size: 16pt; text-indent: 2em;">主送机关：</p>
<p style="font-family: FangSong; font-size: 16pt; text-indent: 2em;">正文内容。正文内容。正文内容。正文内容。正文内容。正文内容。正文内容。正文内容。</p>
<p style="font-family: FangSong; font-size: 16pt; text-indent: 2em;">正文内容。正文内容。正文内容。正文内容。正文内容。正文内容。</p>
<p style="font-family: FangSong; font-size: 16pt; text-align: right;">发文机关</p>
<p style="font-family: FangSong; font-size: 16pt; text-align: right;">年 月 日</p>`,
    styles: {
      fontFamily: 'FangSong, serif',
      fontSize: 16,
      lineHeight: 1.5,
      titleSize: 22,
      titleAlign: 'center',
      paragraphIndent: 2,
      margins: { top: 37, bottom: 35, left: 28, right: 26 }
    },
    placeholders: [
      { id: 'title', label: '标题', type: 'text' },
      { id: 'subtitle', label: '副标题', type: 'text' },
      { id: 'recipient', label: '主送机关', type: 'text' },
      { id: 'content', label: '正文', type: 'text' },
      { id: 'issuer', label: '发文机关', type: 'text' },
      { id: 'date', label: '日期', type: 'date' }
    ]
  },
  {
    id: 'thesis',
    name: '学术论文',
    category: 'academic',
    description: '标准学术论文格式',
    content: `<h1 style="text-align: center; font-family: SimHei; font-size: 18pt;">论文标题</h1>
<p style="text-align: center; font-family: SimSun; font-size: 12pt;">作者姓名<sup>1</sup>，作者姓名<sup>2</sup></p>
<p style="text-align: center; font-family: SimSun; font-size: 10.5pt;">（1. 单位名称，城市 邮编；2. 单位名称，城市 邮编）</p>
<h2 style="font-family: SimHei; font-size: 14pt;">摘要：</h2>
<p style="font-family: SimSun; font-size: 10.5pt; text-indent: 2em;">摘要内容。摘要内容。摘要内容。摘要内容。摘要内容。摘要内容。摘要内容。</p>
<p style="font-family: SimSun; font-size: 10.5pt;"><b>关键词：</b>关键词1；关键词2；关键词3</p>
<h2 style="font-family: SimHei; font-size: 14pt;">一、引言</h2>
<p style="font-family: SimSun; font-size: 10.5pt; text-indent: 2em;">引言内容。引言内容。引言内容。引言内容。引言内容。引言内容。</p>
<h2 style="font-family: SimHei; font-size: 14pt;">二、正文</h2>
<p style="font-family: SimSun; font-size: 10.5pt; text-indent: 2em;">正文内容。正文内容。正文内容。正文内容。正文内容。正文内容。</p>
<h2 style="font-family: SimHei; font-size: 14pt;">参考文献</h2>
<p style="font-family: SimSun; font-size: 10.5pt;">[1] 作者. 文献标题[J]. 期刊名, 年份, 卷(期): 页码.</p>`,
    styles: {
      fontFamily: 'SimSun, serif',
      fontSize: 10.5,
      lineHeight: 1.5,
      titleSize: 18,
      titleAlign: 'center',
      paragraphIndent: 2,
      margins: { top: 25, bottom: 25, left: 30, right: 30 }
    },
    placeholders: [
      { id: 'title', label: '论文标题', type: 'text' },
      { id: 'author', label: '作者', type: 'text' },
      { id: 'affiliation', label: '单位', type: 'text' },
      { id: 'abstract', label: '摘要', type: 'text' },
      { id: 'keywords', label: '关键词', type: 'text' }
    ]
  },
  {
    id: 'report',
    name: '工作报告',
    category: 'business',
    description: '标准工作报告格式',
    content: `<h1 style="text-align: center; font-family: SimHei; font-size: 22pt;">工作报告</h1>
<p style="font-family: SimSun; font-size: 14pt; text-indent: 2em;">报告人：__________</p>
<p style="font-family: SimSun; font-size: 14pt; text-indent: 2em;">日期：__________</p>
<h2 style="font-family: SimHei; font-size: 16pt;">一、工作概述</h2>
<p style="font-family: SimSun; font-size: 14pt; text-indent: 2em;">工作概述内容。工作概述内容。工作概述内容。工作概述内容。</p>
<h2 style="font-family: SimHei; font-size: 16pt;">二、主要成绩</h2>
<p style="font-family: SimSun; font-size: 14pt; text-indent: 2em;">主要成绩内容。主要成绩内容。主要成绩内容。主要成绩内容。</p>
<h2 style="font-family: SimHei; font-size: 16pt;">三、存在问题</h2>
<p style="font-family: SimSun; font-size: 14pt; text-indent: 2em;">存在问题内容。存在问题内容。存在问题内容。存在问题内容。</p>
<h2 style="font-family: SimHei; font-size: 16pt;">四、下一步计划</h2>
<p style="font-family: SimSun; font-size: 14pt; text-indent: 2em;">下一步计划内容。下一步计划内容。下一步计划内容。下一步计划内容。</p>`,
    styles: {
      fontFamily: 'SimSun, serif',
      fontSize: 14,
      lineHeight: 1.5,
      titleSize: 22,
      titleAlign: 'center',
      paragraphIndent: 2,
      margins: { top: 25, bottom: 25, left: 25, right: 25 }
    }
  },
  {
    id: 'meeting-minutes',
    name: '会议纪要',
    category: 'business',
    description: '标准会议纪要格式',
    content: `<h1 style="text-align: center; font-family: SimHei; font-size: 18pt;">会议纪要</h1>
<table style="width: 100%; border-collapse: collapse; font-family: SimSun; font-size: 12pt;">
  <tr>
    <td style="border: 1px solid #000; padding: 8px; width: 20%;">会议名称</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">会议时间</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">会议地点</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">主持人</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">参会人员</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">记录人</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
</table>
<h2 style="font-family: SimHei; font-size: 14pt; margin-top: 20px;">会议内容</h2>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">会议内容记录。会议内容记录。会议内容记录。会议内容记录。</p>
<h2 style="font-family: SimHei; font-size: 14pt;">决议事项</h2>
<p style="font-family: SimSun; font-size: 12pt;">1. 决议事项一</p>
<p style="font-family: SimSun; font-size: 12pt;">2. 决议事项二</p>`,
    styles: {
      fontFamily: 'SimSun, serif',
      fontSize: 12,
      lineHeight: 1.5,
      titleSize: 18,
      titleAlign: 'center',
      paragraphIndent: 2,
      margins: { top: 25, bottom: 25, left: 25, right: 25 }
    }
  },
  {
    id: 'contract',
    name: '合同模板',
    category: 'business',
    description: '标准合同格式',
    content: `<h1 style="text-align: center; font-family: SimHei; font-size: 18pt;">合同</h1>
<p style="font-family: SimSun; font-size: 12pt;">合同编号：__________</p>
<p style="font-family: SimSun; font-size: 12pt;">甲方（委托方）：__________</p>
<p style="font-family: SimSun; font-size: 12pt;">乙方（受托方）：__________</p>
<p style="font-family: SimSun; font-size: 12pt;">签订日期：__________</p>
<h2 style="font-family: SimHei; font-size: 14pt;">第一条 合同标的</h2>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">合同标的内容。合同标的内容。合同标的内容。</p>
<h2 style="font-family: SimHei; font-size: 14pt;">第二条 合同金额</h2>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">合同金额为人民币__________元整（￥__________）。</p>
<h2 style="font-family: SimHei; font-size: 14pt;">第三条 履行期限</h2>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">本合同自签订之日起生效，有效期至__________止。</p>
<h2 style="font-family: SimHei; font-size: 14pt;">第四条 违约责任</h2>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">违约责任内容。违约责任内容。违约责任内容。</p>
<p style="font-family: SimSun; font-size: 12pt; margin-top: 30px;">甲方（盖章）：__________ &nbsp;&nbsp;&nbsp;&nbsp; 乙方（盖章）：__________</p>
<p style="font-family: SimSun; font-size: 12pt;">代表签字：__________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 代表签字：__________</p>
<p style="font-family: SimSun; font-size: 12pt;">日期：__________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 日期：__________</p>`,
    styles: {
      fontFamily: 'SimSun, serif',
      fontSize: 12,
      lineHeight: 1.5,
      titleSize: 18,
      titleAlign: 'center',
      paragraphIndent: 0,
      margins: { top: 25, bottom: 25, left: 25, right: 25 }
    }
  },
  {
    id: 'resume',
    name: '个人简历',
    category: 'personal',
    description: '标准个人简历格式',
    content: `<h1 style="text-align: center; font-family: SimHei; font-size: 22pt;">个人简历</h1>
<table style="width: 100%; border-collapse: collapse; font-family: SimSun; font-size: 12pt;">
  <tr>
    <td style="border: 1px solid #000; padding: 8px; width: 20%;">姓名</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
    <td style="border: 1px solid #000; padding: 8px; width: 20%;">性别</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
    <td rowspan="4" style="border: 1px solid #000; padding: 8px; width: 80px; text-align: center;">照片</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">出生年月</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
    <td style="border: 1px solid #000; padding: 8px;">民族</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">学历</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
    <td style="border: 1px solid #000; padding: 8px;">专业</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">联系电话</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
    <td style="border: 1px solid #000; padding: 8px;">电子邮箱</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
</table>
<h2 style="font-family: SimHei; font-size: 14pt; margin-top: 15px;">教育背景</h2>
<p style="font-family: SimSun; font-size: 12pt;">时间&nbsp;&nbsp;&nbsp;&nbsp;学校&nbsp;&nbsp;&nbsp;&nbsp;专业&nbsp;&nbsp;&nbsp;&nbsp;学历</p>
<h2 style="font-family: SimHei; font-size: 14pt;">工作经历</h2>
<p style="font-family: SimSun; font-size: 12pt;">时间&nbsp;&nbsp;&nbsp;&nbsp;公司&nbsp;&nbsp;&nbsp;&nbsp;职位&nbsp;&nbsp;&nbsp;&nbsp;工作内容</p>
<h2 style="font-family: SimHei; font-size: 14pt;">专业技能</h2>
<p style="font-family: SimSun; font-size: 12pt;">专业技能描述</p>
<h2 style="font-family: SimHei; font-size: 14pt;">自我评价</h2>
<p style="font-family: SimSun; font-size: 12pt;">自我评价内容</p>`,
    styles: {
      fontFamily: 'SimSun, serif',
      fontSize: 12,
      lineHeight: 1.5,
      titleSize: 22,
      titleAlign: 'center',
      paragraphIndent: 0,
      margins: { top: 20, bottom: 20, left: 20, right: 20 }
    }
  },
  {
    id: 'lesson-plan',
    name: '教案模板',
    category: 'education',
    description: '标准教案格式',
    content: `<h1 style="text-align: center; font-family: SimHei; font-size: 18pt;">教案</h1>
<table style="width: 100%; border-collapse: collapse; font-family: SimSun; font-size: 12pt;">
  <tr>
    <td style="border: 1px solid #000; padding: 8px; width: 20%;">课题</td>
    <td style="border: 1px solid #000; padding: 8px;" colspan="3"></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">授课教师</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
    <td style="border: 1px solid #000; padding: 8px; width: 20%;">授课班级</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">课时</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
    <td style="border: 1px solid #000; padding: 8px;">课型</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
</table>
<h2 style="font-family: SimHei; font-size: 14pt; margin-top: 15px;">一、教学目标</h2>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">1. 知识与技能目标：</p>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">2. 过程与方法目标：</p>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">3. 情感态度价值观目标：</p>
<h2 style="font-family: SimHei; font-size: 14pt;">二、教学重难点</h2>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">教学重点：</p>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">教学难点：</p>
<h2 style="font-family: SimHei; font-size: 14pt;">三、教学过程</h2>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">（一）导入新课</p>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">（二）讲授新课</p>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">（三）巩固练习</p>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">（四）课堂小结</p>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">（五）布置作业</p>
<h2 style="font-family: SimHei; font-size: 14pt;">四、板书设计</h2>
<p style="font-family: SimSun; font-size: 12pt;">板书内容</p>`,
    styles: {
      fontFamily: 'SimSun, serif',
      fontSize: 12,
      lineHeight: 1.5,
      titleSize: 18,
      titleAlign: 'center',
      paragraphIndent: 2,
      margins: { top: 25, bottom: 25, left: 25, right: 25 }
    }
  },
  {
    id: 'notice',
    name: '通知模板',
    category: 'official',
    description: '标准通知格式',
    content: `<h1 style="text-align: center; font-family: SimHei; font-size: 18pt;">关于__________的通知</h1>
<p style="font-family: FangSong; font-size: 14pt;">各有关单位/部门：</p>
<p style="font-family: FangSong; font-size: 14pt; text-indent: 2em;">通知内容。通知内容。通知内容。通知内容。通知内容。通知内容。通知内容。通知内容。通知内容。通知内容。通知内容。</p>
<p style="font-family: FangSong; font-size: 14pt; text-indent: 2em;">特此通知。</p>
<p style="font-family: FangSong; font-size: 14pt; text-align: right; margin-top: 30px;">发文单位</p>
<p style="font-family: FangSong; font-size: 14pt; text-align: right;">年 月 日</p>`,
    styles: {
      fontFamily: 'FangSong, serif',
      fontSize: 14,
      lineHeight: 1.5,
      titleSize: 18,
      titleAlign: 'center',
      paragraphIndent: 2,
      margins: { top: 25, bottom: 25, left: 25, right: 25 }
    }
  },
  {
    id: 'letter',
    name: '书信模板',
    category: 'personal',
    description: '标准书信格式',
    content: `<p style="font-family: SimSun; font-size: 12pt;">尊敬的__________：</p>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">您好！</p>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">正文内容。正文内容。正文内容。正文内容。正文内容。正文内容。正文内容。正文内容。正文内容。正文内容。</p>
<p style="font-family: SimSun; font-size: 12pt; text-indent: 2em;">此致</p>
<p style="font-family: SimSun; font-size: 12pt;">敬礼！</p>
<p style="font-family: SimSun; font-size: 12pt; text-align: right; margin-top: 20px;">写信人：__________</p>
<p style="font-family: SimSun; font-size: 12pt; text-align: right;">年 月 日</p>`,
    styles: {
      fontFamily: 'SimSun, serif',
      fontSize: 12,
      lineHeight: 1.5,
      titleSize: 18,
      titleAlign: 'left',
      paragraphIndent: 2,
      margins: { top: 25, bottom: 25, left: 25, right: 25 }
    }
  }
]

export function getTemplatesByCategory(category: DocumentTemplate['category']): DocumentTemplate[] {
  return documentTemplates.filter(t => t.category === category)
}

export function getTemplateById(id: string): DocumentTemplate | undefined {
  return documentTemplates.find(t => t.id === id)
}

export function applyTemplate(template: DocumentTemplate, values?: Record<string, string>): string {
  let content = template.content
  
  if (values) {
    for (const [key, value] of Object.entries(values)) {
      const placeholder = new RegExp(`__${key}__|{${key}}|__________`, 'g')
      content = content.replace(placeholder, value)
    }
  }
  
  return content
}

export function getTemplateCategories(): { id: string; label: string; icon: string }[] {
  return [
    { id: 'all', label: '全部', icon: '📄' },
    { id: 'official', label: '公文', icon: '📋' },
    { id: 'academic', label: '学术', icon: '🎓' },
    { id: 'business', label: '商务', icon: '💼' },
    { id: 'personal', label: '个人', icon: '👤' },
    { id: 'education', label: '教育', icon: '📚' }
  ]
}

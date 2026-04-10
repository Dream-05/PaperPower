/**
 * Office操作抽象层
 * 
 * 提供统一的Office.js操作接口，支持Word/Excel/PPT
 */

declare namespace Office {
  interface Context {
    workbook?: Excel.Workbook;
    document?: Word.Document;
    presentation?: PowerPoint.Presentation;
    sync(): Promise<void>;
  }

  interface RunOptions {
    displayAlerts?: boolean;
  }

  function run<T>(callback: (context: Context) => Promise<T>): Promise<T>;
  function run<T>(options: RunOptions, callback: (context: Context) => Promise<T>): Promise<T>;

  namespace Excel {
    interface Workbook {
      worksheets: WorksheetCollection;
      getSelectedRange(): Range;
      getActiveWorksheet(): Worksheet;
    }

    interface WorksheetCollection {
      getCount(): ClientResult<number>;
      getItem(key: string): Worksheet;
      add(name?: string): Worksheet;
      getActiveWorksheet(): Worksheet;
    }

    interface Worksheet {
      name: string;
      getRange(address?: string): Range;
      getUsedRange(): Range;
      getCell(row: number, column: number): Range;
      charts: ChartCollection;
      tables: TableCollection;
    }

    interface Range {
      values: any[][];
      formulas: any[][];
      formats: RangeFormat;
      text: ClientResult<string[][]>;
      address: string;
      rowCount: number;
      columnCount: number;
      getRowsAbove(count: number): Range;
      getRowsBelow(count: number): Range;
      getColumnsLeft(count: number): Range;
      getColumnsRight(count: number): Range;
      insert(shift: string): Range;
      delete(shift: string): void;
      merge(): void;
      unmerge(): void;
      getAbsoluteResizedRange(rowCount: number, columnCount: number): Range;
    }

    interface RangeFormat {
      fill: RangeFill;
      font: RangeFont;
      borders: RangeBorderCollection;
      horizontalAlignment: string;
      verticalAlignment: string;
      wrapText: boolean;
      rowHeight: number;
      columnWidth: number;
      autofitColumns(): void;
      autofitRows(): void;
    }

    interface RangeFill {
      color: string;
      pattern: string;
    }

    interface RangeFont {
      name: string;
      size: number;
      color: string;
      bold: boolean;
      italic: boolean;
      underline: string;
    }

    interface RangeBorderCollection {
      getItem(index: string): RangeBorder;
    }

    interface RangeBorder {
      style: string;
      color: string;
      weight: string;
    }

    interface ChartCollection {
      add(type: string, dataRange: Range, seriesBy: string): Chart;
      getCount(): ClientResult<number>;
    }

    interface Chart {
      name: string;
      title: ChartTitle;
      dataLabels: ChartDataLabels;
    }

    interface ChartTitle {
      text: string;
      visible: boolean;
    }

    interface ChartDataLabels {
      visible: boolean;
    }

    interface TableCollection {
      add(address: string, hasHeaders: boolean): Table;
      getCount(): ClientResult<number>;
    }

    interface Table {
      name: string;
      style: string;
      columns: TableColumnCollection;
      rows: TableRowCollection;
    }

    interface TableColumnCollection {}
    interface TableRowCollection {}

    interface ClientResult<T> {
      value: T;
    }
  }

  namespace Word {
    interface Document {
      body: Body;
      getSelection(): Range;
      paragraphs: ParagraphCollection;
      sections: SectionCollection;
    }

    interface Body {
      type: string;
      insertText(text: string, location: string): Range;
      insertParagraph(text: string, location: string): Paragraph;
      insertBreak(breakType: string, location: string): void;
      getHtml(): ClientResult<string>;
      getOoxml(): ClientResult<string>;
    }

    interface ParagraphCollection {
      getCount(): ClientResult<number>;
      getItem(index: number): Paragraph;
    }

    interface Paragraph {
      text: string;
      style: string;
      insertText(text: string, location: string): Range;
      insertParagraph(text: string, location: string): Paragraph;
      font: Font;
      alignment: string;
    }

    interface Range {
      text: string;
      insertText(text: string, location: string): Range;
      insertParagraph(text: string, location: string): Paragraph;
      insertImage(base64: string, width: number, height: number): InlinePicture;
      insertBreak(breakType: string): void;
      insertHtml(html: string): Range;
      font: Font;
      style: string;
      select(): void;
    }

    interface InlinePicture {
      width: number;
      height: number;
      altTextTitle: string;
      altTextDescription: string;
    }

    interface Font {
      name: string;
      size: number;
      color: string;
      bold: boolean;
      italic: boolean;
      underline: string;
      highlightColor: string;
    }

    interface SectionCollection {
      getCount(): ClientResult<number>;
      getItem(index: number): Section;
    }

    interface Section {
      body: Body;
    }

    interface ClientResult<T> {
      value: T;
    }
  }

  namespace PowerPoint {
    interface Presentation {
      slides: SlideCollection;
      getActiveSlide(): Slide;
      title: string;
    }

    interface SlideCollection {
      getCount(): ClientResult<number>;
      getItem(index: number): Slide;
      add(options?: SlideAddOptions): Slide;
    }

    interface SlideAddOptions {
      layoutId?: string;
    }

    interface Slide {
      id: string;
      layout: SlideLayout;
      shapes: ShapeCollection;
      tags: TagCollection;
    }

    interface SlideLayout {
      id: string;
      name: string;
    }

    interface ShapeCollection {
      getCount(): ClientResult<number>;
      getItem(index: number): Shape;
      addTextBox(left: number, top: number, width: number, height: number): Shape;
      addPicture(base64: string, left: number, top: number, width?: number, height?: number): Shape;
    }

    interface Shape {
      id: string;
      name: string;
      textFrame: TextFrame;
      width: number;
      height: number;
      left: number;
      top: number;
    }

    interface TextFrame {
      textRange: TextRange;
      wordWrap: boolean;
      autoSizeSetting: string;
    }

    interface TextRange {
      text: string;
      font: Font;
      paragraphFormat: ParagraphFormat;
    }

    interface Font {
      name: string;
      size: number;
      color: string;
      bold: boolean;
      italic: boolean;
      underline: string;
    }

    interface ParagraphFormat {
      alignment: string;
      bulletFormat: BulletFormat;
    }

    interface BulletFormat {
      type: string;
      visible: boolean;
    }

    interface TagCollection {
      getItem(key: string): Tag;
      add(key: string, value: string): void;
    }

    interface Tag {
      key: string;
      value: string;
    }

    interface ClientResult<T> {
      value: T;
    }
  }
}

interface OfficeBridge {
  insertContent(text: string, style?: ContentStyle): Promise<void>;
  insertImage(imageData: string, layout?: ImageLayout): Promise<void>;
  getSelection(): Promise<SelectionInfo>;
  getDocumentStructure(): Promise<DocumentStructure>;
  getActiveDocument(): Promise<ActiveDocument>;
}

interface ContentStyle {
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

interface ImageLayout {
  width?: number;
  height?: number;
  position?: 'inline' | 'floating';
  alignment?: 'left' | 'center' | 'right';
}

interface SelectionInfo {
  type: 'text' | 'cell' | 'shape' | 'none';
  content: string;
  range?: {
    start: number;
    end: number;
  };
  address?: string;
}

interface DocumentStructure {
  type: 'document' | 'workbook' | 'presentation';
  sections: SectionInfo[];
  metadata: Record<string, any>;
}

interface SectionInfo {
  id: string;
  title: string;
  type: string;
  level: number;
  children?: SectionInfo[];
}

interface ActiveDocument {
  name: string;
  type: 'document' | 'workbook' | 'presentation';
  path?: string;
  modified: boolean;
}

declare function onReady(callback: () => void): void;

const OfficeBridge = {
  async insertContent(text: string, style?: ContentStyle): Promise<void> {
    const host = Office.context.host;
    
    if (host === 'Word') {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.insertText(text, Word.InsertLocation.replace);
        
        if (style) {
          selection.font.name = style.fontName || '微软雅黑';
          selection.font.size = style.fontSize || 12;
          selection.font.bold = style.bold || false;
          selection.font.italic = style.italic || false;
          if (style.color) selection.font.color = style.color;
        }
        
        await context.sync();
      });
    } else if (host === 'Excel') {
      await Excel.run(async (context) => {
        const range = context.workbook.getSelectedRange();
        range.values = [[text]];
        
        if (style) {
          range.format.font.name = style.fontName || '微软雅黑';
          range.format.font.size = style.fontSize || 11;
        }
        
        await context.sync();
      });
    } else if (host === 'PowerPoint') {
      await PowerPoint.run(async (context) => {
        const slide = context.presentation.getActiveSlide();
        const textBox = slide.shapes.addTextBox(100, 100, 400, 50);
        textBox.textFrame.textRange.text = text;
        
        if (style) {
          textBox.textFrame.textRange.font.name = style.fontName || '微软雅黑';
          textBox.textFrame.textRange.font.size = style.fontSize || 18;
        }
        
        await context.sync();
      });
    }
  },

  async insertImage(imageData: string, layout?: ImageLayout): Promise<void> {
    const host = Office.context.host;
    const width = layout?.width || 400;
    const height = layout?.height || 300;
    
    if (host === 'Word') {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.insertImage(imageData, width, height);
        await context.sync();
      });
    } else if (host === 'PowerPoint') {
      await PowerPoint.run(async (context) => {
        const slide = context.presentation.getActiveSlide();
        slide.shapes.addPicture(imageData, 100, 100, width, height);
        await context.sync();
      });
    }
  },

  async getSelection(): Promise<SelectionInfo> {
    const host = Office.context.host;
    
    if (host === 'Word') {
      return Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.load('text');
        await context.sync();
        return {
          type: 'text',
          content: selection.text,
        };
      });
    } else if (host === 'Excel') {
      return Excel.run(async (context) => {
        const range = context.workbook.getSelectedRange();
        range.load(['values', 'address']);
        await context.sync();
        return {
          type: 'cell',
          content: String(range.values[0][0]),
          address: range.address,
        };
      });
    }
    
    return { type: 'none', content: '' };
  },

  async getDocumentStructure(): Promise<DocumentStructure> {
    const host = Office.context.host;
    
    if (host === 'Word') {
      return Word.run(async (context) => {
        const paragraphs = context.document.body.paragraphs;
        paragraphs.load(['items/text', 'items/style']);
        await context.sync();
        
        const sections = paragraphs.items.map((p, i) => ({
          id: `para_${i}`,
          title: p.text.substring(0, 50),
          type: p.style || 'Normal',
          level: 1,
        }));
        
        return {
          type: 'document',
          sections,
          metadata: {},
        };
      });
    } else if (host === 'Excel') {
      return Excel.run(async (context) => {
        const sheets = context.workbook.worksheets;
        sheets.load(['items/name']);
        await context.sync();
        
        const sections = sheets.items.map((s, i) => ({
          id: `sheet_${i}`,
          title: s.name,
          type: 'worksheet',
          level: 0,
        }));
        
        return {
          type: 'workbook',
          sections,
          metadata: {},
        };
      });
    } else if (host === 'PowerPoint') {
      return PowerPoint.run(async (context) => {
        const slides = context.presentation.slides;
        slides.load(['items/id']);
        await context.sync();
        
        const sections = slides.items.map((s, i) => ({
          id: `slide_${i}`,
          title: `幻灯片 ${i + 1}`,
          type: 'slide',
          level: 0,
        }));
        
        return {
          type: 'presentation',
          sections,
          metadata: {},
        };
      });
    }
    
    return { type: 'document', sections: [], metadata: {} };
  },

  async getActiveDocument(): Promise<ActiveDocument> {
    return {
      name: '未命名文档',
      type: Office.context.host as any,
      modified: false,
    };
  },
};

export default OfficeBridge;

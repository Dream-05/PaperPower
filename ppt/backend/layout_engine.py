"""
智能排版引擎

实现：
- 页面类型识别与布局
- 网格系统计算
- 视觉层次设计
- 图文混排算法
- 多种布局模板
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Tuple, Any
import math


class LayoutType(Enum):
    FULL_IMAGE = "full_image"
    LEFT_NAV = "left_nav"
    TOP_TABS = "top_tabs"
    CIRCLE_DIST = "circle_dist"
    TEXT_IMAGE_LEFT = "text_image_left"
    TEXT_IMAGE_RIGHT = "text_image_right"
    TEXT_IMAGE_BOTTOM = "text_image_bottom"
    TWO_COLUMN = "two_column"
    THREE_COLUMN = "three_column"
    GRID_2X2 = "grid_2x2"
    L_SHAPE = "l_shape"
    F_SHAPE = "f_shape"
    CHART_FOCUS = "chart_focus"
    TIMELINE_H = "timeline_horizontal"
    TIMELINE_V = "timeline_vertical"
    TEAM_GRID = "team_grid"
    CONTACT_INFO = "contact_info"
    DEFAULT = "default"


class Alignment(Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"
    JUSTIFY = "justify"


class VerticalAlignment(Enum):
    TOP = "top"
    MIDDLE = "middle"
    BOTTOM = "bottom"


@dataclass
class Position:
    """位置信息"""
    x: float
    y: float
    width: float
    height: float
    
    def to_dict(self) -> Dict:
        return {
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
        }


@dataclass
class TextStyle:
    """文字样式"""
    font_family: str = "微软雅黑"
    font_size: int = 18
    font_weight: str = "normal"
    color: str = "#333333"
    alignment: Alignment = Alignment.LEFT
    vertical_alignment: VerticalAlignment = VerticalAlignment.TOP
    line_height: float = 1.5
    letter_spacing: float = 0


@dataclass
class Element:
    """页面元素"""
    element_type: str
    position: Position
    content: Any = None
    style: Optional[Dict] = None
    z_index: int = 0
    
    def to_dict(self) -> Dict:
        return {
            "type": self.element_type,
            "position": self.position.to_dict(),
            "content": self.content,
            "style": self.style,
            "z_index": self.z_index,
        }


@dataclass
class LayoutResult:
    """排版结果"""
    layout_type: LayoutType
    elements: List[Element]
    grid_info: Dict[str, Any] = field(default_factory=dict)
    margins: Dict[str, float] = field(default_factory=dict)
    spacing: float = 24.0


class GridSystem:
    """网格系统"""
    
    def __init__(
        self,
        columns: int = 12,
        width: float = 1920,
        height: float = 1080,
        margin: float = 40,
        gutter: float = 24
    ):
        self.columns = columns
        self.width = width
        self.height = height
        self.margin = margin
        self.gutter = gutter
        
        self.content_width = width - 2 * margin
        self.column_width = (self.content_width - (columns - 1) * gutter) / columns
    
    def get_column_position(
        self,
        start_col: int,
        span: int
    ) -> Tuple[float, float]:
        """获取列位置和宽度"""
        x = self.margin + start_col * (self.column_width + self.gutter)
        width = span * self.column_width + (span - 1) * self.gutter
        return x, width
    
    def get_row_position(
        self,
        start_row: int,
        span: int,
        row_height: float = 100
    ) -> Tuple[float, float]:
        """获取行位置和高度"""
        y = self.margin + start_row * (row_height + self.gutter)
        height = span * row_height + (span - 1) * self.gutter
        return y, height
    
    def snap_to_grid(self, x: float, y: float) -> Tuple[float, float]:
        """对齐到网格"""
        col = round((x - self.margin) / (self.column_width + self.gutter))
        snapped_x = self.margin + col * (self.column_width + self.gutter)
        
        return snapped_x, y


class LayoutTemplates:
    """布局模板库"""
    
    SLIDE_WIDTH = 1920
    SLIDE_HEIGHT = 1080
    
    @classmethod
    def get_layout(cls, layout_type: LayoutType, grid: GridSystem) -> LayoutResult:
        """获取布局"""
        layouts = {
            LayoutType.FULL_IMAGE: cls._full_image_layout,
            LayoutType.LEFT_NAV: cls._left_nav_layout,
            LayoutType.TOP_TABS: cls._top_tabs_layout,
            LayoutType.TEXT_IMAGE_RIGHT: cls._text_image_right_layout,
            LayoutType.TEXT_IMAGE_LEFT: cls._text_image_left_layout,
            LayoutType.TWO_COLUMN: cls._two_column_layout,
            LayoutType.THREE_COLUMN: cls._three_column_layout,
            LayoutType.GRID_2X2: cls._grid_2x2_layout,
            LayoutType.CHART_FOCUS: cls._chart_focus_layout,
            LayoutType.TIMELINE_H: cls._timeline_horizontal_layout,
            LayoutType.TEAM_GRID: cls._team_grid_layout,
            LayoutType.CONTACT_INFO: cls._contact_info_layout,
            LayoutType.DEFAULT: cls._default_layout,
        }
        
        handler = layouts.get(layout_type, cls._default_layout)
        return handler(grid)
    
    @classmethod
    def _full_image_layout(cls, grid: GridSystem) -> LayoutResult:
        """全图背景布局（封面）"""
        elements = [
            Element(
                element_type="image",
                position=Position(0, 0, cls.SLIDE_WIDTH, cls.SLIDE_HEIGHT),
                z_index=0,
            ),
            Element(
                element_type="text",
                position=Position(
                    grid.margin,
                    cls.SLIDE_HEIGHT * 0.35,
                    cls.SLIDE_WIDTH - 2 * grid.margin,
                    120
                ),
                content={"type": "title"},
                style=TextStyle(
                    font_size=48,
                    font_weight="bold",
                    color="#FFFFFF",
                    alignment=Alignment.CENTER
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="text",
                position=Position(
                    grid.margin,
                    cls.SLIDE_HEIGHT * 0.55,
                    cls.SLIDE_WIDTH - 2 * grid.margin,
                    60
                ),
                content={"type": "subtitle"},
                style=TextStyle(
                    font_size=24,
                    color="#FFFFFF",
                    alignment=Alignment.CENTER
                ).__dict__,
                z_index=1,
            ),
        ]
        
        return LayoutResult(
            layout_type=LayoutType.FULL_IMAGE,
            elements=elements,
            margins={"top": grid.margin, "bottom": grid.margin, "left": grid.margin, "right": grid.margin},
        )
    
    @classmethod
    def _left_nav_layout(cls, grid: GridSystem) -> LayoutResult:
        """左侧导航布局（目录）"""
        nav_width, _ = grid.get_column_position(0, 3)
        
        elements = [
            Element(
                element_type="shape",
                position=Position(0, 0, nav_width, cls.SLIDE_HEIGHT),
                style={"fill": "#2196F3"},
                z_index=0,
            ),
            Element(
                element_type="text",
                position=Position(grid.margin, grid.margin, nav_width - 2 * grid.margin, 60),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold",
                    color="#FFFFFF"
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="nav_items",
                position=Position(
                    grid.margin,
                    grid.margin + 100,
                    nav_width - 2 * grid.margin,
                    cls.SLIDE_HEIGHT - grid.margin * 2 - 100
                ),
                content={"type": "toc"},
                z_index=1,
            ),
            Element(
                element_type="text",
                position=Position(
                    nav_width + grid.margin,
                    grid.margin,
                    cls.SLIDE_WIDTH - nav_width - 2 * grid.margin,
                    60
                ),
                content={"type": "section_title"},
                style=TextStyle(
                    font_size=36,
                    font_weight="bold"
                ).__dict__,
                z_index=1,
            ),
        ]
        
        return LayoutResult(
            layout_type=LayoutType.LEFT_NAV,
            elements=elements,
        )
    
    @classmethod
    def _top_tabs_layout(cls, grid: GridSystem) -> LayoutResult:
        """顶部标签布局"""
        tab_height = 60
        
        elements = [
            Element(
                element_type="tabs",
                position=Position(0, 0, cls.SLIDE_WIDTH, tab_height),
                content={"type": "tabs"},
                z_index=1,
            ),
            Element(
                element_type="text",
                position=Position(
                    grid.margin,
                    tab_height + grid.margin,
                    cls.SLIDE_WIDTH - 2 * grid.margin,
                    60
                ),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold"
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="content",
                position=Position(
                    grid.margin,
                    tab_height + grid.margin + 100,
                    cls.SLIDE_WIDTH - 2 * grid.margin,
                    cls.SLIDE_HEIGHT - tab_height - grid.margin * 2 - 100
                ),
                content={"type": "body"},
                z_index=1,
            ),
        ]
        
        return LayoutResult(
            layout_type=LayoutType.TOP_TABS,
            elements=elements,
        )
    
    @classmethod
    def _text_image_right_layout(cls, grid: GridSystem) -> LayoutResult:
        """文字左图片右布局"""
        text_width, _ = grid.get_column_position(0, 7)
        img_x, img_width = grid.get_column_position(7, 5)
        
        elements = [
            Element(
                element_type="text",
                position=Position(grid.margin, grid.margin, text_width - grid.margin, 60),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold"
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="text",
                position=Position(
                    grid.margin,
                    grid.margin + 80,
                    text_width - grid.margin,
                    cls.SLIDE_HEIGHT - grid.margin * 2 - 80
                ),
                content={"type": "bullets"},
                style=TextStyle(
                    font_size=18,
                    line_height=1.8
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="image",
                position=Position(
                    img_x,
                    grid.margin,
                    img_width - grid.margin,
                    cls.SLIDE_HEIGHT - grid.margin * 2
                ),
                content={"type": "main_image"},
                z_index=0,
            ),
        ]
        
        return LayoutResult(
            layout_type=LayoutType.TEXT_IMAGE_RIGHT,
            elements=elements,
        )
    
    @classmethod
    def _text_image_left_layout(cls, grid: GridSystem) -> LayoutResult:
        """图片左文字右布局"""
        img_x, img_width = grid.get_column_position(0, 5)
        text_x, text_width = grid.get_column_position(5, 7)
        
        elements = [
            Element(
                element_type="image",
                position=Position(
                    grid.margin,
                    grid.margin,
                    img_width - grid.margin,
                    cls.SLIDE_HEIGHT - grid.margin * 2
                ),
                content={"type": "main_image"},
                z_index=0,
            ),
            Element(
                element_type="text",
                position=Position(text_x, grid.margin, text_width - grid.margin, 60),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold"
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="text",
                position=Position(
                    text_x,
                    grid.margin + 80,
                    text_width - grid.margin,
                    cls.SLIDE_HEIGHT - grid.margin * 2 - 80
                ),
                content={"type": "bullets"},
                style=TextStyle(
                    font_size=18,
                    line_height=1.8
                ).__dict__,
                z_index=1,
            ),
        ]
        
        return LayoutResult(
            layout_type=LayoutType.TEXT_IMAGE_LEFT,
            elements=elements,
        )
    
    @classmethod
    def _two_column_layout(cls, grid: GridSystem) -> LayoutResult:
        """双栏对比布局"""
        col1_x, col1_width = grid.get_column_position(0, 6)
        col2_x, col2_width = grid.get_column_position(6, 6)
        
        elements = [
            Element(
                element_type="text",
                position=Position(grid.margin, grid.margin, cls.SLIDE_WIDTH - 2 * grid.margin, 60),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold",
                    alignment=Alignment.CENTER
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="column",
                position=Position(
                    col1_x,
                    grid.margin + 80,
                    col1_width - grid.gutter,
                    cls.SLIDE_HEIGHT - grid.margin * 2 - 80
                ),
                content={"type": "left_column", "index": 0},
                z_index=1,
            ),
            Element(
                element_type="column",
                position=Position(
                    col2_x + grid.gutter,
                    grid.margin + 80,
                    col2_width - grid.gutter,
                    cls.SLIDE_HEIGHT - grid.margin * 2 - 80
                ),
                content={"type": "right_column", "index": 1},
                z_index=1,
            ),
        ]
        
        return LayoutResult(
            layout_type=LayoutType.TWO_COLUMN,
            elements=elements,
        )
    
    @classmethod
    def _three_column_layout(cls, grid: GridSystem) -> LayoutResult:
        """三栏布局"""
        col_width = (cls.SLIDE_WIDTH - 2 * grid.margin - 2 * grid.gutter) / 3
        
        elements = [
            Element(
                element_type="text",
                position=Position(grid.margin, grid.margin, cls.SLIDE_WIDTH - 2 * grid.margin, 60),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold"
                ).__dict__,
                z_index=1,
            ),
        ]
        
        for i in range(3):
            x = grid.margin + i * (col_width + grid.gutter)
            elements.append(
                Element(
                    element_type="column",
                    position=Position(
                        x,
                        grid.margin + 80,
                        col_width,
                        cls.SLIDE_HEIGHT - grid.margin * 2 - 80
                    ),
                    content={"type": "column", "index": i},
                    z_index=1,
                )
            )
        
        return LayoutResult(
            layout_type=LayoutType.THREE_COLUMN,
            elements=elements,
        )
    
    @classmethod
    def _grid_2x2_layout(cls, grid: GridSystem) -> LayoutResult:
        """2x2网格布局"""
        cell_width = (cls.SLIDE_WIDTH - 2 * grid.margin - grid.gutter) / 2
        cell_height = (cls.SLIDE_HEIGHT - 2 * grid.margin - grid.gutter - 80) / 2
        
        elements = [
            Element(
                element_type="text",
                position=Position(grid.margin, grid.margin, cls.SLIDE_WIDTH - 2 * grid.margin, 60),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold"
                ).__dict__,
                z_index=1,
            ),
        ]
        
        positions = [
            (0, 0), (1, 0), (0, 1), (1, 1)
        ]
        
        for i, (col, row) in enumerate(positions):
            x = grid.margin + col * (cell_width + grid.gutter)
            y = grid.margin + 80 + row * (cell_height + grid.gutter)
            elements.append(
                Element(
                    element_type="grid_cell",
                    position=Position(x, y, cell_width, cell_height),
                    content={"type": "cell", "index": i},
                    z_index=1,
                )
            )
        
        return LayoutResult(
            layout_type=LayoutType.GRID_2X2,
            elements=elements,
        )
    
    @classmethod
    def _chart_focus_layout(cls, grid: GridSystem) -> LayoutResult:
        """图表聚焦布局"""
        chart_height = cls.SLIDE_HEIGHT * 0.5
        
        elements = [
            Element(
                element_type="text",
                position=Position(grid.margin, grid.margin, cls.SLIDE_WIDTH - 2 * grid.margin, 60),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold"
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="chart",
                position=Position(
                    grid.margin,
                    grid.margin + 80,
                    cls.SLIDE_WIDTH - 2 * grid.margin,
                    chart_height
                ),
                content={"type": "main_chart"},
                z_index=1,
            ),
            Element(
                element_type="text",
                position=Position(
                    grid.margin,
                    grid.margin + 80 + chart_height + grid.gutter,
                    cls.SLIDE_WIDTH - 2 * grid.margin,
                    cls.SLIDE_HEIGHT - grid.margin - 80 - chart_height - grid.gutter
                ),
                content={"type": "insights"},
                style=TextStyle(
                    font_size=16
                ).__dict__,
                z_index=1,
            ),
        ]
        
        return LayoutResult(
            layout_type=LayoutType.CHART_FOCUS,
            elements=elements,
        )
    
    @classmethod
    def _timeline_horizontal_layout(cls, grid: GridSystem) -> LayoutResult:
        """水平时间线布局"""
        timeline_y = cls.SLIDE_HEIGHT * 0.5
        node_count = 4
        node_spacing = (cls.SLIDE_WIDTH - 2 * grid.margin) / (node_count + 1)
        
        elements = [
            Element(
                element_type="text",
                position=Position(grid.margin, grid.margin, cls.SLIDE_WIDTH - 2 * grid.margin, 60),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold"
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="line",
                position=Position(
                    grid.margin,
                    timeline_y,
                    cls.SLIDE_WIDTH - 2 * grid.margin,
                    4
                ),
                style={"color": "#2196F3"},
                z_index=0,
            ),
        ]
        
        for i in range(node_count):
            x = grid.margin + (i + 1) * node_spacing
            elements.extend([
                Element(
                    element_type="circle",
                    position=Position(x - 15, timeline_y - 15, 30, 30),
                    style={"fill": "#2196F3"},
                    z_index=1,
                ),
                Element(
                    element_type="text",
                    position=Position(x - 50, timeline_y - 80, 100, 40),
                    content={"type": "timeline_date", "index": i},
                    style=TextStyle(
                        font_size=14,
                        alignment=Alignment.CENTER
                    ).__dict__,
                    z_index=1,
                ),
                Element(
                    element_type="text",
                    position=Position(x - 80, timeline_y + 40, 160, 80),
                    content={"type": "timeline_content", "index": i},
                    style=TextStyle(
                        font_size=12,
                        alignment=Alignment.CENTER
                    ).__dict__,
                    z_index=1,
                ),
            ])
        
        return LayoutResult(
            layout_type=LayoutType.TIMELINE_H,
            elements=elements,
        )
    
    @classmethod
    def _team_grid_layout(cls, grid: GridSystem) -> LayoutResult:
        """团队网格布局"""
        cols = 4
        rows = 2
        cell_width = (cls.SLIDE_WIDTH - 2 * grid.margin - (cols - 1) * grid.gutter) / cols
        cell_height = (cls.SLIDE_HEIGHT - 2 * grid.margin - 80 - (rows - 1) * grid.gutter) / rows
        
        elements = [
            Element(
                element_type="text",
                position=Position(grid.margin, grid.margin, cls.SLIDE_WIDTH - 2 * grid.margin, 60),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold"
                ).__dict__,
                z_index=1,
            ),
        ]
        
        for row in range(rows):
            for col in range(cols):
                x = grid.margin + col * (cell_width + grid.gutter)
                y = grid.margin + 80 + row * (cell_height + grid.gutter)
                elements.append(
                    Element(
                        element_type="team_member",
                        position=Position(x, y, cell_width, cell_height),
                        content={"type": "member", "index": row * cols + col},
                        z_index=1,
                    )
                )
        
        return LayoutResult(
            layout_type=LayoutType.TEAM_GRID,
            elements=elements,
        )
    
    @classmethod
    def _contact_info_layout(cls, grid: GridSystem) -> LayoutResult:
        """联系信息布局（封底）"""
        elements = [
            Element(
                element_type="text",
                position=Position(
                    grid.margin,
                    cls.SLIDE_HEIGHT * 0.35,
                    cls.SLIDE_WIDTH - 2 * grid.margin,
                    60
                ),
                content={"type": "thanks"},
                style=TextStyle(
                    font_size=48,
                    font_weight="bold",
                    alignment=Alignment.CENTER
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="text",
                position=Position(
                    grid.margin,
                    cls.SLIDE_HEIGHT * 0.55,
                    cls.SLIDE_WIDTH - 2 * grid.margin,
                    40
                ),
                content={"type": "contact"},
                style=TextStyle(
                    font_size=18,
                    alignment=Alignment.CENTER
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="qr_code",
                position=Position(
                    cls.SLIDE_WIDTH / 2 - 75,
                    cls.SLIDE_HEIGHT * 0.65,
                    150,
                    150
                ),
                content={"type": "qr"},
                z_index=1,
            ),
        ]
        
        return LayoutResult(
            layout_type=LayoutType.CONTACT_INFO,
            elements=elements,
        )
    
    @classmethod
    def _default_layout(cls, grid: GridSystem) -> LayoutResult:
        """默认布局"""
        elements = [
            Element(
                element_type="text",
                position=Position(grid.margin, grid.margin, cls.SLIDE_WIDTH - 2 * grid.margin, 60),
                content={"type": "title"},
                style=TextStyle(
                    font_size=32,
                    font_weight="bold"
                ).__dict__,
                z_index=1,
            ),
            Element(
                element_type="text",
                position=Position(
                    grid.margin,
                    grid.margin + 80,
                    cls.SLIDE_WIDTH - 2 * grid.margin,
                    cls.SLIDE_HEIGHT - grid.margin * 2 - 80
                ),
                content={"type": "body"},
                style=TextStyle(
                    font_size=18,
                    line_height=1.8
                ).__dict__,
                z_index=1,
            ),
        ]
        
        return LayoutResult(
            layout_type=LayoutType.DEFAULT,
            elements=elements,
        )


class LayoutEngine:
    """排版引擎"""
    
    PAGE_TYPE_LAYOUT_MAP = {
        "cover": LayoutType.FULL_IMAGE,
        "toc": LayoutType.LEFT_NAV,
        "content": LayoutType.TEXT_IMAGE_RIGHT,
        "data": LayoutType.CHART_FOCUS,
        "comparison": LayoutType.TWO_COLUMN,
        "team": LayoutType.TEAM_GRID,
        "timeline": LayoutType.TIMELINE_H,
        "end": LayoutType.CONTACT_INFO,
    }
    
    def __init__(self, slide_width: float = 1920, slide_height: float = 1080):
        self.slide_width = slide_width
        self.slide_height = slide_height
        self.grid = GridSystem(width=slide_width, height=slide_height)
    
    def layout_page(
        self,
        page_type: str,
        content: Dict[str, Any],
        assets: Optional[List[str]] = None
    ) -> LayoutResult:
        """排版单页"""
        layout_type = self.PAGE_TYPE_LAYOUT_MAP.get(page_type, LayoutType.DEFAULT)
        
        if assets and len(assets) > 0:
            layout_type = self._adjust_layout_for_assets(layout_type, assets)
        
        result = LayoutTemplates.get_layout(layout_type, self.grid)
        
        result = self._fill_content(result, content, assets)
        
        return result
    
    def _adjust_layout_for_assets(
        self,
        layout_type: LayoutType,
        assets: List[str]
    ) -> LayoutType:
        """根据素材调整布局"""
        if len(assets) >= 4:
            if layout_type == LayoutType.TEXT_IMAGE_RIGHT:
                return LayoutType.GRID_2X2
        
        if len(assets) == 1:
            if layout_type in [LayoutType.DEFAULT, LayoutType.THREE_COLUMN]:
                return LayoutType.TEXT_IMAGE_RIGHT
        
        return layout_type
    
    def _fill_content(
        self,
        layout: LayoutResult,
        content: Dict[str, Any],
        assets: Optional[List[str]] = None
    ) -> LayoutResult:
        """填充内容"""
        for element in layout.elements:
            if element.element_type == "text":
                content_type = element.content.get("type") if element.content else None
                
                if content_type == "title":
                    element.content = {"text": content.get("title", ""), "type": "title"}
                elif content_type == "subtitle":
                    element.content = {"text": content.get("subtitle", ""), "type": "subtitle"}
                elif content_type == "bullets":
                    element.content = {"items": content.get("bullets", []), "type": "bullets"}
                elif content_type == "body":
                    element.content = {"text": content.get("body", ""), "type": "body"}
            
            elif element.element_type == "image":
                if assets and len(assets) > 0:
                    element.content = {"url": assets[0], "type": "image"}
            
            elif element.element_type == "nav_items":
                element.content = {"items": content.get("toc_items", []), "type": "toc"}
        
        return layout
    
    def calculate_text_space(self, text: str, font_size: int = 18) -> Tuple[float, float]:
        """计算文字所需空间"""
        char_width = font_size * 0.6
        line_height = font_size * 1.5
        
        lines = text.split('\n')
        max_width = max(len(line) * char_width for line in lines)
        total_height = len(lines) * line_height
        
        return max_width, total_height
    
    def suggest_layout_for_content(
        self,
        title: str,
        bullets: List[str],
        has_image: bool = False
    ) -> LayoutType:
        """根据内容建议布局"""
        if not bullets or len(bullets) == 0:
            if has_image:
                return LayoutType.FULL_IMAGE
            return LayoutType.DEFAULT
        
        if len(bullets) <= 3 and has_image:
            return LayoutType.TEXT_IMAGE_RIGHT
        
        if len(bullets) > 5:
            return LayoutType.THREE_COLUMN
        
        return LayoutType.DEFAULT
    
    def get_layout_preview(self, layout_type: LayoutType) -> Dict[str, Any]:
        """获取布局预览信息"""
        result = LayoutTemplates.get_layout(layout_type, self.grid)
        
        return {
            "layout_type": layout_type.value,
            "elements": [e.to_dict() for e in result.elements],
            "grid": {
                "columns": self.grid.columns,
                "margin": self.grid.margin,
                "gutter": self.grid.gutter,
            }
        }

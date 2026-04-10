"""
案例分析引擎

实现：
- 文档案例：结构、风格、内容模式分析
- 表格案例：公式、格式、指标分析
- PPT案例：结构、视觉风格、叙事逻辑分析
- 特征提取与相似匹配
"""

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Dict, Optional, Any, Tuple
import sqlite3
import hashlib


class CaseType(Enum):
    DOCUMENT = "document"
    SPREADSHEET = "spreadsheet"
    PRESENTATION = "presentation"
    TEMPLATE = "template"


class AnalysisDimension(Enum):
    STRUCTURE = "structure"
    STYLE = "style"
    CONTENT = "content"
    QUALITY = "quality"


@dataclass
class CaseFeature:
    """案例特征"""
    name: str
    value: Any
    weight: float = 1.0
    category: str = "general"
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "value": self.value,
            "weight": self.weight,
            "category": self.category,
        }


@dataclass
class StructureAnalysis:
    """结构分析结果"""
    sections: List[Dict[str, Any]] = field(default_factory=list)
    total_pages: int = 0
    section_distribution: Dict[str, float] = field(default_factory=dict)
    hierarchy_depth: int = 0
    content_weights: Dict[str, float] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "sections": self.sections,
            "total_pages": self.total_pages,
            "section_distribution": self.section_distribution,
            "hierarchy_depth": self.hierarchy_depth,
            "content_weights": self.content_weights,
        }


@dataclass
class StyleAnalysis:
    """风格分析结果"""
    primary_color: str = "#000000"
    secondary_colors: List[str] = field(default_factory=list)
    font_title: str = "微软雅黑"
    font_body: str = "微软雅黑"
    font_sizes: Dict[str, int] = field(default_factory=dict)
    spacing: Dict[str, float] = field(default_factory=dict)
    decorative_elements: List[str] = field(default_factory=list)
    visual_style: str = "general"
    
    def to_dict(self) -> Dict:
        return {
            "primary_color": self.primary_color,
            "secondary_colors": self.secondary_colors,
            "font_title": self.font_title,
            "font_body": self.font_body,
            "font_sizes": self.font_sizes,
            "spacing": self.spacing,
            "decorative_elements": self.decorative_elements,
            "visual_style": self.visual_style,
        }


@dataclass
class ContentAnalysis:
    """内容分析结果"""
    keywords: List[str] = field(default_factory=list)
    key_phrases: List[str] = field(default_factory=list)
    argument_structure: List[str] = field(default_factory=list)
    data_presentation: List[str] = field(default_factory=list)
    language_style: str = "formal"
    word_count: int = 0
    sentence_count: int = 0
    
    def to_dict(self) -> Dict:
        return {
            "keywords": self.keywords,
            "key_phrases": self.key_phrases,
            "argument_structure": self.argument_structure,
            "data_presentation": self.data_presentation,
            "language_style": self.language_style,
            "word_count": self.word_count,
            "sentence_count": self.sentence_count,
        }


@dataclass
class QualityAssessment:
    """质量评估结果"""
    information_density: float = 0.0
    visual_hierarchy: float = 0.0
    professionalism: float = 0.0
    readability: float = 0.0
    overall_score: float = 0.0
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "information_density": self.information_density,
            "visual_hierarchy": self.visual_hierarchy,
            "professionalism": self.professionalism,
            "readability": self.readability,
            "overall_score": self.overall_score,
            "issues": self.issues,
            "suggestions": self.suggestions,
        }


@dataclass
class CaseAnalysis:
    """完整案例分析结果"""
    case_id: str
    case_type: CaseType
    case_name: str
    structure: StructureAnalysis = field(default_factory=StructureAnalysis)
    style: StyleAnalysis = field(default_factory=StyleAnalysis)
    content: ContentAnalysis = field(default_factory=ContentAnalysis)
    quality: QualityAssessment = field(default_factory=QualityAssessment)
    features: List[CaseFeature] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict:
        return {
            "case_id": self.case_id,
            "case_type": self.case_type.value,
            "case_name": self.case_name,
            "structure": self.structure.to_dict(),
            "style": self.style.to_dict(),
            "content": self.content.to_dict(),
            "quality": self.quality.to_dict(),
            "features": [f.to_dict() for f in self.features],
            "created_at": self.created_at.isoformat(),
        }


class CaseDatabase:
    """案例数据库"""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/cases/cases.db")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cases (
                case_id TEXT PRIMARY KEY,
                case_type TEXT NOT NULL,
                case_name TEXT,
                file_path TEXT,
                analysis_json TEXT,
                feature_vector TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS case_features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT,
                feature_name TEXT,
                feature_value TEXT,
                feature_category TEXT,
                weight REAL,
                FOREIGN KEY (case_id) REFERENCES cases(case_id)
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_case_type ON cases(case_type)
        ''')
        
        conn.commit()
        conn.close()
    
    def save_case(self, analysis: CaseAnalysis, file_path: Optional[str] = None):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        feature_vector = self._compute_feature_vector(analysis.features)
        
        cursor.execute('''
            INSERT OR REPLACE INTO cases 
            (case_id, case_type, case_name, file_path, analysis_json, feature_vector, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            analysis.case_id,
            analysis.case_type.value,
            analysis.case_name,
            file_path,
            json.dumps(analysis.to_dict(), ensure_ascii=False),
            json.dumps(feature_vector),
            analysis.created_at.isoformat(),
            datetime.now().isoformat(),
        ))
        
        for feature in analysis.features:
            cursor.execute('''
                INSERT INTO case_features (case_id, feature_name, feature_value, feature_category, weight)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                analysis.case_id,
                feature.name,
                str(feature.value),
                feature.category,
                feature.weight,
            ))
        
        conn.commit()
        conn.close()
    
    def get_case(self, case_id: str) -> Optional[CaseAnalysis]:
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('SELECT analysis_json FROM cases WHERE case_id = ?', (case_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            data = json.loads(row[0])
            return self._dict_to_analysis(data)
        return None
    
    def find_similar(
        self,
        features: List[CaseFeature],
        case_type: Optional[CaseType] = None,
        limit: int = 5
    ) -> List[Tuple[CaseAnalysis, float]]:
        """查找相似案例"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        query = "SELECT case_id, analysis_json, feature_vector FROM cases"
        if case_type:
            query += " WHERE case_type = ?"
            cursor.execute(query, (case_type.value,))
        else:
            cursor.execute(query)
        
        results = []
        query_vector = self._compute_feature_vector(features)
        
        for row in cursor.fetchall():
            case_id, analysis_json, feature_vector_json = row
            stored_vector = json.loads(feature_vector_json)
            similarity = self._compute_similarity(query_vector, stored_vector)
            
            if similarity > 0.3:
                analysis = self._dict_to_analysis(json.loads(analysis_json))
                results.append((analysis, similarity))
        
        conn.close()
        
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:limit]
    
    def _compute_feature_vector(self, features: List[CaseFeature]) -> Dict[str, float]:
        """计算特征向量"""
        vector = {}
        for f in features:
            if isinstance(f.value, (int, float)):
                vector[f.name] = f.value * f.weight
            elif isinstance(f.value, str):
                vector[f.name] = hash(f.value) % 1000 / 1000 * f.weight
            elif isinstance(f.value, bool):
                vector[f.name] = (1.0 if f.value else 0.0) * f.weight
        return vector
    
    def _compute_similarity(self, v1: Dict[str, float], v2: Dict[str, float]) -> float:
        """计算相似度（余弦相似度）"""
        common_keys = set(v1.keys()) & set(v2.keys())
        if not common_keys:
            return 0.0
        
        dot_product = sum(v1[k] * v2[k] for k in common_keys)
        norm1 = sum(v ** 2 for v in v1.values()) ** 0.5
        norm2 = sum(v ** 2 for v in v2.values()) ** 0.5
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def _dict_to_analysis(self, data: Dict) -> CaseAnalysis:
        return CaseAnalysis(
            case_id=data["case_id"],
            case_type=CaseType(data["case_type"]),
            case_name=data["case_name"],
            structure=StructureAnalysis(**data.get("structure", {})),
            style=StyleAnalysis(**data.get("style", {})),
            content=ContentAnalysis(**data.get("content", {})),
            quality=QualityAssessment(**data.get("quality", {})),
            features=[CaseFeature(**f) for f in data.get("features", [])],
        )


class DocumentAnalyzer:
    """文档分析器"""
    
    SECTION_PATTERNS = {
        "chapter": r"第[一二三四五六七八九十\d]+[章节篇部]",
        "numbered": r"^\d+\.?\s+.+",
        "heading": r"^#+\s+.+",
        "chinese_number": r"^[一二三四五六七八九十]+[、.]\s+.+",
    }
    
    def analyze(self, content: str, name: str = "") -> CaseAnalysis:
        """分析文档"""
        case_id = hashlib.md5(f"{name}_{datetime.now().timestamp()}".encode()).hexdigest()[:12]
        
        structure = self._analyze_structure(content)
        style = self._analyze_style(content)
        content_analysis = self._analyze_content(content)
        quality = self._assess_quality(content, structure, style)
        features = self._extract_features(structure, style, content_analysis)
        
        return CaseAnalysis(
            case_id=case_id,
            case_type=CaseType.DOCUMENT,
            case_name=name,
            structure=structure,
            style=style,
            content=content_analysis,
            quality=quality,
            features=features,
        )
    
    def _analyze_structure(self, content: str) -> StructureAnalysis:
        """分析文档结构"""
        lines = content.split('\n')
        sections = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            for pattern_name, pattern in self.SECTION_PATTERNS.items():
                if re.match(pattern, line):
                    sections.append({
                        "type": pattern_name,
                        "title": line,
                        "level": self._detect_heading_level(line),
                    })
                    break
        
        section_distribution = {}
        for s in sections:
            t = s["type"]
            section_distribution[t] = section_distribution.get(t, 0) + 1
        
        return StructureAnalysis(
            sections=sections,
            total_pages=max(1, len(sections) // 3),
            section_distribution=section_distribution,
            hierarchy_depth=max([s["level"] for s in sections], default=1),
        )
    
    def _detect_heading_level(self, line: str) -> int:
        """检测标题级别"""
        if line.startswith('#'):
            return line.count('#')
        if re.match(r"第[一二三四五六七八九十\d]+章", line):
            return 1
        if re.match(r"第[一二三四五六七八九十\d]+节", line):
            return 2
        if re.match(r"^\d+\.", line):
            return len(re.match(r"^(\d+\.)+", line).group(0).split('.'))
        return 3
    
    def _analyze_style(self, content: str) -> StyleAnalysis:
        """分析文档风格"""
        return StyleAnalysis(
            primary_color="#000000",
            font_title="微软雅黑",
            font_body="宋体",
            visual_style="formal",
        )
    
    def _analyze_content(self, content: str) -> ContentAnalysis:
        """分析文档内容"""
        words = re.findall(r'[\u4e00-\u9fa5]+|[a-zA-Z]+', content)
        sentences = re.split(r'[。！？.!?]', content)
        
        word_freq = {}
        for word in words:
            if len(word) >= 2:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        keywords = sorted(word_freq.keys(), key=lambda x: word_freq[x], reverse=True)[:20]
        
        return ContentAnalysis(
            keywords=keywords,
            word_count=len(words),
            sentence_count=len([s for s in sentences if s.strip()]),
            language_style="formal",
        )
    
    def _assess_quality(
        self,
        content: str,
        structure: StructureAnalysis,
        style: StyleAnalysis
    ) -> QualityAssessment:
        """评估文档质量"""
        info_density = min(1.0, len(content) / 5000)
        visual_hierarchy = min(1.0, structure.hierarchy_depth / 4)
        professionalism = 0.7 if structure.section_distribution else 0.3
        
        issues = []
        suggestions = []
        
        if len(structure.sections) < 3:
            issues.append("文档结构较为简单")
            suggestions.append("建议增加章节划分，提高可读性")
        
        return QualityAssessment(
            information_density=info_density,
            visual_hierarchy=visual_hierarchy,
            professionalism=professionalism,
            readability=0.7,
            overall_score=(info_density + visual_hierarchy + professionalism + 0.7) / 4,
            issues=issues,
            suggestions=suggestions,
        )
    
    def _extract_features(
        self,
        structure: StructureAnalysis,
        style: StyleAnalysis,
        content: ContentAnalysis
    ) -> List[CaseFeature]:
        """提取特征"""
        return [
            CaseFeature("section_count", len(structure.sections), 1.0, "structure"),
            CaseFeature("hierarchy_depth", structure.hierarchy_depth, 0.8, "structure"),
            CaseFeature("word_count", content.word_count, 0.5, "content"),
            CaseFeature("has_chapters", "chapter" in structure.section_distribution, 0.7, "structure"),
            CaseFeature("visual_style", style.visual_style, 0.6, "style"),
        ]


class SpreadsheetAnalyzer:
    """表格分析器"""
    
    def analyze(self, data: List[List[Any]], name: str = "") -> CaseAnalysis:
        """分析表格"""
        case_id = hashlib.md5(f"{name}_{datetime.now().timestamp()}".encode()).hexdigest()[:12]
        
        structure = self._analyze_structure(data)
        style = self._analyze_style(data)
        content = self._analyze_content(data)
        quality = self._assess_quality(data)
        features = self._extract_features(structure, content)
        
        return CaseAnalysis(
            case_id=case_id,
            case_type=CaseType.SPREADSHEET,
            case_name=name,
            structure=structure,
            style=style,
            content=content,
            quality=quality,
            features=features,
        )
    
    def _analyze_structure(self, data: List[List[Any]]) -> StructureAnalysis:
        rows = len(data)
        cols = max(len(row) for row in data) if data else 0
        
        return StructureAnalysis(
            sections=[{"type": "data_area", "rows": rows, "cols": cols}],
            total_pages=1,
            content_weights={"data": 0.8, "header": 0.2},
        )
    
    def _analyze_style(self, data: List[List[Any]]) -> StyleAnalysis:
        return StyleAnalysis(visual_style="tabular")
    
    def _analyze_content(self, data: List[List[Any]]) -> ContentAnalysis:
        formulas = []
        for row in data:
            for cell in row:
                if isinstance(cell, str) and cell.startswith('='):
                    formulas.append(cell)
        
        return ContentAnalysis(
            keywords=["表格", "数据"],
            data_presentation=formulas[:10],
        )
    
    def _assess_quality(self, data: List[List[Any]]) -> QualityAssessment:
        return QualityAssessment(
            information_density=0.8,
            overall_score=0.75,
        )
    
    def _extract_features(self, structure: StructureAnalysis, content: ContentAnalysis) -> List[CaseFeature]:
        return [
            CaseFeature("row_count", structure.sections[0]["rows"] if structure.sections else 0, 0.5, "structure"),
            CaseFeature("col_count", structure.sections[0]["cols"] if structure.sections else 0, 0.5, "structure"),
            CaseFeature("has_formulas", len(content.data_presentation) > 0, 0.8, "content"),
        ]


class PresentationAnalyzer:
    """PPT分析器"""
    
    def analyze(self, slides: List[Dict], name: str = "") -> CaseAnalysis:
        """分析PPT"""
        case_id = hashlib.md5(f"{name}_{datetime.now().timestamp()}".encode()).hexdigest()[:12]
        
        structure = self._analyze_structure(slides)
        style = self._analyze_style(slides)
        content = self._analyze_content(slides)
        quality = self._assess_quality(slides, structure)
        features = self._extract_features(structure, style, content)
        
        return CaseAnalysis(
            case_id=case_id,
            case_type=CaseType.PRESENTATION,
            case_name=name,
            structure=structure,
            style=style,
            content=content,
            quality=quality,
            features=features,
        )
    
    def _analyze_structure(self, slides: List[Dict]) -> StructureAnalysis:
        sections = []
        for i, slide in enumerate(slides):
            sections.append({
                "index": i,
                "type": slide.get("type", "content"),
                "title": slide.get("title", f"第{i+1}页"),
            })
        
        type_distribution = {}
        for s in sections:
            t = s["type"]
            type_distribution[t] = type_distribution.get(t, 0) + 1
        
        return StructureAnalysis(
            sections=sections,
            total_pages=len(slides),
            section_distribution=type_distribution,
        )
    
    def _analyze_style(self, slides: List[Dict]) -> StyleAnalysis:
        colors = []
        for slide in slides:
            if "style" in slide:
                colors.extend(slide["style"].get("colors", []))
        
        return StyleAnalysis(
            primary_color=colors[0] if colors else "#2196F3",
            secondary_colors=colors[1:4] if len(colors) > 1 else [],
            visual_style="presentation",
        )
    
    def _analyze_content(self, slides: List[Dict]) -> ContentAnalysis:
        all_text = []
        for slide in slides:
            if "bullets" in slide:
                all_text.extend(slide["bullets"])
            if "title" in slide:
                all_text.append(slide["title"])
        
        return ContentAnalysis(
            keywords=list(set(" ".join(all_text).split()))[:20],
            word_count=len(" ".join(all_text)),
        )
    
    def _assess_quality(self, slides: List[Dict], structure: StructureAnalysis) -> QualityAssessment:
        has_cover = any(s["type"] == "cover" for s in structure.sections)
        has_end = any(s["type"] == "end" for s in structure.sections)
        
        issues = []
        if not has_cover:
            issues.append("缺少封面页")
        if not has_end:
            issues.append("缺少封底页")
        
        return QualityAssessment(
            information_density=0.7,
            visual_hierarchy=0.8,
            professionalism=0.75,
            overall_score=0.75,
            issues=issues,
        )
    
    def _extract_features(
        self,
        structure: StructureAnalysis,
        style: StyleAnalysis,
        content: ContentAnalysis
    ) -> List[CaseFeature]:
        return [
            CaseFeature("slide_count", structure.total_pages, 1.0, "structure"),
            CaseFeature("has_cover", any(s["type"] == "cover" for s in structure.sections), 0.5, "structure"),
            CaseFeature("has_end", any(s["type"] == "end" for s in structure.sections), 0.5, "structure"),
            CaseFeature("visual_style", style.visual_style, 0.7, "style"),
        ]


class CaseAnalyzer:
    """案例分析引擎"""
    
    def __init__(self, db: Optional[CaseDatabase] = None):
        self.db = db or CaseDatabase()
        self.document_analyzer = DocumentAnalyzer()
        self.spreadsheet_analyzer = SpreadsheetAnalyzer()
        self.presentation_analyzer = PresentationAnalyzer()
    
    def analyze_document(self, content: str, name: str = "") -> CaseAnalysis:
        """分析文档案例"""
        analysis = self.document_analyzer.analyze(content, name)
        self.db.save_case(analysis)
        return analysis
    
    def analyze_spreadsheet(self, data: List[List[Any]], name: str = "") -> CaseAnalysis:
        """分析表格案例"""
        analysis = self.spreadsheet_analyzer.analyze(data, name)
        self.db.save_case(analysis)
        return analysis
    
    def analyze_presentation(self, slides: List[Dict], name: str = "") -> CaseAnalysis:
        """分析PPT案例"""
        analysis = self.presentation_analyzer.analyze(slides, name)
        self.db.save_case(analysis)
        return analysis
    
    def find_similar_cases(
        self,
        case_type: CaseType,
        requirements: Dict[str, Any],
        limit: int = 5
    ) -> List[Tuple[CaseAnalysis, float]]:
        """查找相似案例"""
        features = self._requirements_to_features(requirements)
        return self.db.find_similar(features, case_type, limit)
    
    def learn_from_case(self, case: CaseAnalysis, user_feedback: Optional[Dict] = None):
        """从案例学习"""
        if user_feedback:
            for key, value in user_feedback.items():
                feature = next((f for f in case.features if f.name == key), None)
                if feature:
                    feature.weight *= (1 + value * 0.1)
        
        self.db.save_case(case)
    
    def get_recommendations(
        self,
        case_type: CaseType,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """获取案例推荐"""
        similar = self.find_similar_cases(case_type, context)
        
        if not similar:
            return self._get_default_recommendations(case_type)
        
        best_case, similarity = similar[0]
        
        return {
            "structure": best_case.structure.to_dict(),
            "style": best_case.style.to_dict(),
            "quality_reference": best_case.quality.to_dict(),
            "similarity": similarity,
            "source_case": best_case.case_name,
        }
    
    def _requirements_to_features(self, requirements: Dict) -> List[CaseFeature]:
        """需求转特征"""
        features = []
        
        if "page_count" in requirements:
            features.append(CaseFeature("page_count", requirements["page_count"], 0.8, "structure"))
        
        if "style" in requirements:
            features.append(CaseFeature("visual_style", requirements["style"], 0.7, "style"))
        
        if "topic" in requirements:
            features.append(CaseFeature("topic", requirements["topic"], 0.6, "content"))
        
        return features
    
    def _get_default_recommendations(self, case_type: CaseType) -> Dict[str, Any]:
        """获取默认推荐"""
        defaults = {
            CaseType.DOCUMENT: {
                "structure": {"sections": [], "total_pages": 10},
                "style": {"visual_style": "formal"},
            },
            CaseType.SPREADSHEET: {
                "structure": {"sections": [{"rows": 100, "cols": 10}]},
                "style": {"visual_style": "tabular"},
            },
            CaseType.PRESENTATION: {
                "structure": {"sections": [], "total_pages": 10},
                "style": {"visual_style": "tech"},
            },
        }
        return defaults.get(case_type, {})

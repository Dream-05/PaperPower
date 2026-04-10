"""
文案生成模块

实现：
- 页面标题生成
- 要点生成
- 详细说明生成
- 讲者备注生成
- 内容改写与优化
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
import re
from datetime import datetime


@dataclass
class GeneratedContent:
    """生成的内容"""
    title: str
    subtitle: str = ""
    bullets: List[str] = field(default_factory=list)
    body: str = ""
    notes: str = ""
    keywords: List[str] = field(default_factory=list)


class ContentTemplates:
    """内容模板库"""
    
    TITLE_TEMPLATES = {
        "cover": [
            "{topic}解决方案",
            "{topic}项目介绍",
            "{topic}产品发布",
            "{topic}年度报告",
        ],
        "background": [
            "{topic}背景分析",
            "为什么选择{topic}",
            "{topic}的市场机遇",
        ],
        "solution": [
            "我们的{topic}方案",
            "{topic}核心功能",
            "如何实现{topic}",
        ],
        "advantage": [
            "{topic}技术优势",
            "为什么选择我们",
            "{topic}核心竞争力",
        ],
        "team": [
            "核心团队",
            "团队介绍",
            "我们的力量",
        ],
        "finance": [
            "财务预测",
            "商业模式",
            "投资回报分析",
        ],
        "end": [
            "感谢观看",
            "Thank You",
            "期待合作",
        ],
    }
    
    BULLET_TEMPLATES = {
        "background": [
            "行业现状：市场规模持续增长，年复合增长率达{growth}%",
            "用户痛点：现有解决方案效率低下，用户体验差",
            "市场机遇：数字化转型加速，需求旺盛",
            "政策支持：国家政策大力推动行业发展",
        ],
        "solution": [
            "核心功能：提供一站式解决方案",
            "技术架构：采用先进的微服务架构",
            "用户体验：简洁直观的操作界面",
            "数据安全：多层次安全防护机制",
        ],
        "advantage": [
            "技术领先：自主研发核心技术，拥有多项专利",
            "团队专业：核心成员来自知名企业",
            "服务完善：7×24小时技术支持",
            "性价比高：相比竞品成本降低30%",
        ],
        "team": [
            "创始人：10年行业经验，曾任职于知名企业",
            "技术团队：硕士及以上学历占比80%",
            "运营团队：丰富的市场推广经验",
            "顾问团队：行业专家提供战略指导",
        ],
        "finance": [
            "收入模式：SaaS订阅+增值服务",
            "成本结构：研发占比40%，运营占比30%",
            "盈利预测：预计第二年实现盈亏平衡",
            "融资计划：计划融资{amount}万，用于市场拓展",
        ],
    }
    
    NOTES_TEMPLATES = {
        "cover": "开场白：大家好，今天很荣幸向大家介绍我们的{topic}项目。这个项目凝聚了我们团队的心血，希望能给大家带来启发。",
        "background": "背景介绍：首先让我们了解一下市场背景。{details}这些数据说明我们的项目具有广阔的市场前景。",
        "solution": "方案介绍：接下来详细介绍我们的解决方案。{details}我们的方案能够有效解决用户痛点，提供更好的体验。",
        "advantage": "优势说明：我们的核心优势在于{details}。这些优势使我们能够在激烈的市场竞争中脱颖而出。",
        "team": "团队介绍：团队是项目成功的关键。{details}我们相信，有这样一支优秀的团队，项目一定能够成功。",
        "finance": "财务说明：关于财务预测，{details}。我们相信这是一个值得投资的项目。",
        "end": "结束语：感谢大家的聆听！如果有任何问题，欢迎随时交流。期待与各位的合作！",
    }


class ContentWriter:
    """文案生成器"""
    
    def __init__(self):
        self.templates = ContentTemplates()
    
    def generate_page_content(
        self,
        page_type: str,
        topic: str,
        context: Optional[Dict[str, Any]] = None
    ) -> GeneratedContent:
        """生成页面内容"""
        context = context or {}
        
        title = self._generate_title(page_type, topic, context)
        subtitle = self._generate_subtitle(page_type, topic, context)
        bullets = self._generate_bullets(page_type, topic, context)
        notes = self._generate_notes(page_type, topic, context)
        keywords = self._extract_keywords(topic, bullets)
        
        return GeneratedContent(
            title=title,
            subtitle=subtitle,
            bullets=bullets,
            notes=notes,
            keywords=keywords,
        )
    
    def _generate_title(
        self,
        page_type: str,
        topic: str,
        context: Dict[str, Any]
    ) -> str:
        """生成标题"""
        templates = self.templates.TITLE_TEMPLATES.get(page_type, [topic])
        
        if templates:
            template = templates[0]
            return template.format(topic=topic, **context)
        
        return topic
    
    def _generate_subtitle(
        self,
        page_type: str,
        topic: str,
        context: Dict[str, Any]
    ) -> str:
        """生成副标题"""
        if page_type == "cover":
            return context.get("subtitle", f"{topic} | {datetime.now().year}")
        elif page_type == "end":
            return context.get("contact", "联系我们：contact@example.com")
        
        return ""
    
    def _generate_bullets(
        self,
        page_type: str,
        topic: str,
        context: Dict[str, Any]
    ) -> List[str]:
        """生成要点"""
        templates = self.templates.BULLET_TEMPLATES.get(page_type, [])
        
        bullets = []
        for template in templates[:5]:
            try:
                bullet = template.format(
                    topic=topic,
                    growth=context.get("growth", 25),
                    amount=context.get("amount", 500),
                    **context
                )
                bullets.append(bullet)
            except KeyError:
                bullets.append(template)
        
        if not bullets:
            bullets = [
                f"{topic}核心要点一",
                f"{topic}核心要点二",
                f"{topic}核心要点三",
            ]
        
        return bullets
    
    def _generate_notes(
        self,
        page_type: str,
        topic: str,
        context: Dict[str, Any]
    ) -> str:
        """生成讲者备注"""
        template = self.templates.NOTES_TEMPLATES.get(page_type, "")
        
        if template:
            details = "、".join(context.get("details", ["详细内容请根据实际情况补充"]))
            try:
                return template.format(topic=topic, details=details, **context)
            except KeyError:
                return template.format(topic=topic, details=details)
        
        return f"【{topic}】讲解要点：请根据实际情况补充详细内容。"
    
    def _extract_keywords(self, topic: str, bullets: List[str]) -> List[str]:
        """提取关键词"""
        keywords = [topic]
        
        for bullet in bullets:
            words = re.findall(r'[\u4e00-\u9fa5]{2,4}', bullet)
            keywords.extend(words[:2])
        
        return list(set(keywords))[:10]
    
    def rewrite_content(
        self,
        original: str,
        style: str = "professional"
    ) -> str:
        """改写内容"""
        if style == "professional":
            return self._make_professional(original)
        elif style == "casual":
            return self._make_casual(original)
        elif style == "concise":
            return self._make_concise(original)
        
        return original
    
    def _make_professional(self, text: str) -> str:
        """专业化改写"""
        replacements = {
            "很好": "优秀",
            "很多": "众多",
            "很大": "显著",
            "很快": "迅速",
            "帮助": "助力",
            "使用": "采用",
            "做": "实施",
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        return text
    
    def _make_casual(self, text: str) -> str:
        """口语化改写"""
        replacements = {
            "实施": "做",
            "采用": "用",
            "助力": "帮助",
            "显著": "很大",
            "迅速": "很快",
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        return text
    
    def _make_concise(self, text: str) -> str:
        """精简改写"""
        sentences = re.split(r'[。！？]', text)
        concise = []
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 20:
                sentence = sentence[:20] + "..."
            if sentence:
                concise.append(sentence)
        
        return "。".join(concise)
    
    def expand_content(
        self,
        bullets: List[str],
        expand_ratio: float = 2.0
    ) -> str:
        """扩展内容"""
        expanded = []
        
        for bullet in bullets:
            expanded.append(f"• {bullet}")
            
            if len(bullet) < 10:
                expanded.append(f"  具体而言，{bullet}是项目成功的关键因素之一。")
            else:
                expanded.append(f"  这一点对于整体目标的实现具有重要意义。")
        
        return "\n".join(expanded)
    
    def generate_toc_items(
        self,
        structure: List[str]
    ) -> List[Dict[str, str]]:
        """生成目录项"""
        toc_items = []
        
        for i, section in enumerate(structure, 1):
            toc_items.append({
                "number": str(i),
                "title": section,
                "page": str(i + 1),
            })
        
        return toc_items
    
    def suggest_improvements(
        self,
        content: GeneratedContent
    ) -> List[str]:
        suggestions = []
        
        if len(content.title) > 15:
            suggestions.append("标题过长，建议精简至15字以内")
        
        if len(content.bullets) > 5:
            suggestions.append("要点过多，建议控制在4条以内")
        
        for bullet in content.bullets:
            if len(bullet) > 25:
                suggestions.append(f"要点\"{bullet[:12]}...\"过长，建议精简至25字以内")
                break
        
        if not content.notes:
            suggestions.append("建议添加讲者备注，便于演讲时参考")
        
        return suggestions


class ContentOptimizer:
    """内容优化器"""
    
    def __init__(self):
        self.writer = ContentWriter()
    
    def optimize_for_presentation(
        self,
        content: GeneratedContent,
        duration_minutes: int = 10
    ) -> GeneratedContent:
        """为演示优化内容"""
        words_per_minute = 150
        target_words = duration_minutes * words_per_minute
        
        current_words = self._count_words(content)
        
        if current_words < target_words * 0.8:
            content = self._expand_content_to_target(content, target_words)
        elif current_words > target_words * 1.2:
            content = self._reduce_content_to_target(content, target_words)
        
        return content
    
    def _count_words(self, content: GeneratedContent) -> int:
        """统计字数"""
        total = len(content.title) + len(content.subtitle) + len(content.body) + len(content.notes)
        total += sum(len(b) for b in content.bullets)
        return total
    
    def _expand_content_to_target(
        self,
        content: GeneratedContent,
        target: int
    ) -> GeneratedContent:
        """扩展内容"""
        expanded_bullets = []
        for bullet in content.bullets:
            expanded_bullets.append(bullet)
            if len(bullet) < 15:
                expanded_bullets.append(f"进一步说明：{bullet}的具体实施细节")
        
        content.bullets = expanded_bullets
        content.notes = self.writer.expand_content(content.bullets)
        
        return content
    
    def _reduce_content_to_target(
        self,
        content: GeneratedContent,
        target: int
    ) -> GeneratedContent:
        content.bullets = content.bullets[:4]
        
        for i, bullet in enumerate(content.bullets):
            if len(bullet) > 25:
                content.bullets[i] = bullet[:22] + "..."
        
        return content
    
    def check_consistency(
        self,
        pages: List[GeneratedContent]
    ) -> List[Dict[str, Any]]:
        """检查一致性"""
        issues = []
        
        all_keywords = []
        for page in pages:
            all_keywords.extend(page.keywords)
        
        from collections import Counter
        keyword_counts = Counter(all_keywords)
        
        for keyword, count in keyword_counts.items():
            if count == 1:
                issues.append({
                    "type": "keyword_isolation",
                    "keyword": keyword,
                    "suggestion": f"关键词\"{keyword}\"仅出现一次，建议在其他页面也提及"
                })
        
        title_lengths = [len(p.title) for p in pages]
        avg_length = sum(title_lengths) / len(title_lengths)
        
        for i, length in enumerate(title_lengths):
            if abs(length - avg_length) > 10:
                issues.append({
                    "type": "title_length_inconsistency",
                    "page": i,
                    "suggestion": f"第{i+1}页标题长度与平均差异较大"
                })
        
        return issues

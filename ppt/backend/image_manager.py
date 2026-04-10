#!/usr/bin/env python3
"""
图片管理系统
支持上传、下载、截图、保存、分类管理
"""

import os
import json
import asyncio
import aiohttp
import hashlib
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field, asdict
from pathlib import Path
from datetime import datetime
import sqlite3
from contextlib import contextmanager


@dataclass
class ImageAsset:
    """图片素材"""
    id: str
    filename: str
    file_path: str
    url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    description: str = ""
    tags: List[str] = field(default_factory=list)
    category: str = "general"
    source: str = "user_upload"
    photographer: str = ""
    width: int = 0
    height: int = 0
    file_size: int = 0
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    usage_count: int = 0
    rating: float = 0.0
    is_favorite: bool = False


class ImageDatabase:
    """图片数据库管理"""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/assets/assets.db")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _init_db(self):
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS images (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    url TEXT,
                    thumbnail_url TEXT,
                    description TEXT,
                    tags TEXT,
                    category TEXT DEFAULT 'general',
                    source TEXT DEFAULT 'user_upload',
                    photographer TEXT,
                    width INTEGER DEFAULT 0,
                    height INTEGER DEFAULT 0,
                    file_size INTEGER DEFAULT 0,
                    created_at TEXT,
                    usage_count INTEGER DEFAULT 0,
                    rating REAL DEFAULT 0.0,
                    is_favorite INTEGER DEFAULT 0
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS image_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    image_id TEXT,
                    ppt_id TEXT,
                    used_at TEXT,
                    FOREIGN KEY (image_id) REFERENCES images(id)
                )
            """)
            
            conn.commit()
    
    def save_image(self, image: ImageAsset) -> bool:
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO images 
                (id, filename, file_path, url, thumbnail_url, description, tags, category, 
                 source, photographer, width, height, file_size, created_at, usage_count, rating, is_favorite)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                image.id, image.filename, image.file_path, image.url, image.thumbnail_url,
                image.description, json.dumps(image.tags), image.category, image.source,
                image.photographer, image.width, image.height, image.file_size,
                image.created_at, image.usage_count, image.rating, 1 if image.is_favorite else 0
            ))
            conn.commit()
        return True
    
    def get_image(self, image_id: str) -> Optional[ImageAsset]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM images WHERE id = ?", (image_id,)).fetchone()
            if row:
                return self._row_to_image(row)
        return None
    
    def get_all_images(self, category: Optional[str] = None, limit: int = 100) -> List[ImageAsset]:
        with self._get_connection() as conn:
            if category:
                rows = conn.execute(
                    "SELECT * FROM images WHERE category = ? ORDER BY created_at DESC LIMIT ?",
                    (category, limit)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM images ORDER BY created_at DESC LIMIT ?",
                    (limit,)
                ).fetchall()
            return [self._row_to_image(row) for row in rows]
    
    def search_images(self, query: str, limit: int = 50) -> List[ImageAsset]:
        with self._get_connection() as conn:
            rows = conn.execute(
                """SELECT * FROM images 
                   WHERE description LIKE ? OR tags LIKE ? 
                   ORDER BY usage_count DESC, rating DESC 
                   LIMIT ?""",
                (f"%{query}%", f"%{query}%", limit)
            ).fetchall()
            return [self._row_to_image(row) for row in rows]
    
    def update_usage(self, image_id: str, ppt_id: str = ""):
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE images SET usage_count = usage_count + 1 WHERE id = ?",
                (image_id,)
            )
            conn.execute(
                "INSERT INTO image_usage (image_id, ppt_id, used_at) VALUES (?, ?, ?)",
                (image_id, ppt_id, datetime.now().isoformat())
            )
            conn.commit()
    
    def delete_image(self, image_id: str) -> bool:
        with self._get_connection() as conn:
            image = self.get_image(image_id)
            if image:
                # 删除文件
                try:
                    Path(image.file_path).unlink(missing_ok=True)
                except:
                    pass
                
                # 删除数据库记录
                conn.execute("DELETE FROM image_usage WHERE image_id = ?", (image_id,))
                conn.execute("DELETE FROM images WHERE id = ?", (image_id,))
                conn.commit()
                return True
        return False
    
    def get_popular_tags(self, limit: int = 20) -> List[str]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT tags FROM images WHERE tags IS NOT NULL AND tags != '[]'"
            ).fetchall()
            
            tag_counts = {}
            for row in rows:
                try:
                    tags = json.loads(row['tags'])
                    for tag in tags:
                        tag_counts[tag] = tag_counts.get(tag, 0) + 1
                except:
                    pass
            
            sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
            return [tag for tag, count in sorted_tags[:limit]]
    
    def _row_to_image(self, row) -> ImageAsset:
        return ImageAsset(
            id=row['id'],
            filename=row['filename'],
            file_path=row['file_path'],
            url=row['url'],
            thumbnail_url=row['thumbnail_url'],
            description=row['description'] or "",
            tags=json.loads(row['tags']) if row['tags'] else [],
            category=row['category'] or "general",
            source=row['source'] or "user_upload",
            photographer=row['photographer'] or "",
            width=row['width'] or 0,
            height=row['height'] or 0,
            file_size=row['file_size'] or 0,
            created_at=row['created_at'] or datetime.now().isoformat(),
            usage_count=row['usage_count'] or 0,
            rating=row['rating'] or 0.0,
            is_favorite=bool(row['is_favorite'])
        )


class ImageManager:
    """图片管理器"""
    
    def __init__(self, 
                 image_dir: Optional[Path] = None,
                 db_path: Optional[Path] = None):
        self.image_dir = image_dir or Path("data/assets/ppt_images")
        self.image_dir.mkdir(parents=True, exist_ok=True)
        self.db = ImageDatabase(db_path)
    
    async def upload_image(self, 
                          file_data: bytes, 
                          filename: str,
                          description: str = "",
                          tags: List[str] = None,
                          category: str = "general") -> ImageAsset:
        """上传图片"""
        # 生成唯一ID
        image_id = hashlib.md5(f"{filename}_{datetime.now().isoformat()}".encode()).hexdigest()
        
        # 确定文件扩展名
        ext = Path(filename).suffix or ".jpg"
        new_filename = f"{image_id}{ext}"
        file_path = self.image_dir / new_filename
        
        # 保存文件
        with open(file_path, "wb") as f:
            f.write(file_data)
        
        # 获取图片尺寸
        width, height = 0, 0
        try:
            from PIL import Image
            with Image.open(file_path) as img:
                width, height = img.size
        except:
            pass
        
        # 创建图片资源
        image = ImageAsset(
            id=image_id,
            filename=new_filename,
            file_path=str(file_path),
            description=description,
            tags=tags or [],
            category=category,
            source="user_upload",
            width=width,
            height=height,
            file_size=len(file_data)
        )
        
        # 保存到数据库
        self.db.save_image(image)
        
        return image
    
    async def download_and_save(self,
                                url: str,
                                description: str = "",
                                tags: List[str] = None,
                                category: str = "general",
                                source: str = "download",
                                photographer: str = "") -> ImageAsset:
        """下载并保存图片"""
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    file_data = await response.read()
                    
                    # 从URL提取文件名
                    filename = url.split("/")[-1].split("?")[0]
                    if not filename or "." not in filename:
                        filename = "downloaded_image.jpg"
                    
                    image = await self.upload_image(
                        file_data=file_data,
                        filename=filename,
                        description=description,
                        tags=tags,
                        category=category
                    )
                    
                    # 更新来源信息
                    image.source = source
                    image.url = url
                    image.photographer = photographer
                    self.db.save_image(image)
                    
                    return image
        
        raise Exception(f"Failed to download image from {url}")
    
    async def save_screenshot(self,
                             screenshot_data: bytes,
                             description: str = "",
                             tags: List[str] = None,
                             category: str = "screenshot") -> ImageAsset:
        """保存截图"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"screenshot_{timestamp}.png"
        
        return await self.upload_image(
            file_data=screenshot_data,
            filename=filename,
            description=description,
            tags=tags or ["screenshot"],
            category=category
        )
    
    def get_image(self, image_id: str) -> Optional[ImageAsset]:
        """获取图片"""
        return self.db.get_image(image_id)
    
    def get_all_images(self, category: Optional[str] = None, limit: int = 100) -> List[ImageAsset]:
        """获取所有图片"""
        return self.db.get_all_images(category, limit)
    
    def search_images(self, query: str, limit: int = 50) -> List[ImageAsset]:
        """搜索图片"""
        return self.db.search_images(query, limit)
    
    def delete_image(self, image_id: str, keep_file: bool = False) -> bool:
        """删除图片（仅从PPT中移除，保留文件用于学习）"""
        if keep_file:
            # 只更新使用计数，不删除文件
            return True
        return self.db.delete_image(image_id)
    
    def record_usage(self, image_id: str, ppt_id: str = ""):
        """记录图片使用"""
        self.db.update_usage(image_id, ppt_id)
    
    def get_popular_images(self, limit: int = 20) -> List[ImageAsset]:
        """获取热门图片"""
        with self.db._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM images ORDER BY usage_count DESC, rating DESC LIMIT ?",
                (limit,)
            ).fetchall()
            return [self.db._row_to_image(row) for row in rows]
    
    def get_recent_images(self, limit: int = 20) -> List[ImageAsset]:
        """获取最近图片"""
        return self.get_all_images(limit=limit)
    
    def get_popular_tags(self, limit: int = 20) -> List[str]:
        """获取热门标签"""
        return self.db.get_popular_tags(limit)
    
    def update_image_metadata(self, 
                             image_id: str,
                             description: Optional[str] = None,
                             tags: Optional[List[str]] = None,
                             category: Optional[str] = None,
                             rating: Optional[float] = None,
                             is_favorite: Optional[bool] = None) -> bool:
        """更新图片元数据"""
        image = self.db.get_image(image_id)
        if not image:
            return False
        
        if description is not None:
            image.description = description
        if tags is not None:
            image.tags = tags
        if category is not None:
            image.category = category
        if rating is not None:
            image.rating = rating
        if is_favorite is not None:
            image.is_favorite = is_favorite
        
        self.db.save_image(image)
        return True


class LearningSystem:
    """自主学习系统"""
    
    def __init__(self, 
                 data_dir: Optional[Path] = None,
                 db_path: Optional[Path] = None):
        self.data_dir = data_dir or Path("data/learning")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.image_manager = ImageManager(db_path=db_path)
        
        self.usage_log_path = self.data_dir / "usage_log.json"
        self.patterns_path = self.data_dir / "patterns.json"
        
        self._init_learning_data()
    
    def _init_learning_data(self):
        if not self.usage_log_path.exists():
            with open(self.usage_log_path, "w", encoding="utf-8") as f:
                json.dump([], f)
        
        if not self.patterns_path.exists():
            with open(self.patterns_path, "w", encoding="utf-8") as f:
                json.dump({
                    "style_patterns": {},
                    "content_patterns": {},
                    "layout_patterns": {},
                    "image_text_associations": {}
                }, f)
    
    def record_ppt_generation(self,
                             topic: str,
                             style: str,
                             images: List[str],
                             layout: str,
                             content_sections: List[Dict[str, Any]]):
        """记录PPT生成数据用于学习"""
        usage_data = {
            "timestamp": datetime.now().isoformat(),
            "topic": topic,
            "style": style,
            "images": images,
            "layout": layout,
            "content_sections": content_sections
        }
        
        # 追加到使用日志
        with open(self.usage_log_path, "r", encoding="utf-8") as f:
            logs = json.load(f)
        
        logs.append(usage_data)
        
        # 保留最近1000条记录
        if len(logs) > 1000:
            logs = logs[-1000:]
        
        with open(self.usage_log_path, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)
        
        # 更新模式
        self._update_patterns(usage_data)
    
    def _update_patterns(self, usage_data: Dict[str, Any]):
        """更新学习模式"""
        with open(self.patterns_path, "r", encoding="utf-8") as f:
            patterns = json.load(f)
        
        style = usage_data["style"]
        
        # 更新风格模式
        if style not in patterns["style_patterns"]:
            patterns["style_patterns"][style] = {
                "count": 0,
                "common_images": {},
                "common_layouts": {}
            }
        
        patterns["style_patterns"][style]["count"] += 1
        
        # 更新图片关联
        for image_id in usage_data["images"]:
            if image_id not in patterns["style_patterns"][style]["common_images"]:
                patterns["style_patterns"][style]["common_images"][image_id] = 0
            patterns["style_patterns"][style]["common_images"][image_id] += 1
        
        # 更新布局模式
        layout = usage_data["layout"]
        if layout not in patterns["style_patterns"][style]["common_layouts"]:
            patterns["style_patterns"][style]["common_layouts"][layout] = 0
        patterns["style_patterns"][style]["common_layouts"][layout] += 1
        
        # 更新内容模式
        for section in usage_data["content_sections"]:
            section_type = section.get("type", "unknown")
            if section_type not in patterns["content_patterns"]:
                patterns["content_patterns"][section_type] = {
                    "count": 0,
                    "common_keywords": {}
                }
            
            patterns["content_patterns"][section_type]["count"] += 1
            
            # 提取关键词
            title = section.get("title", "")
            content = section.get("content", "")
            
            keywords = self._extract_keywords(f"{title} {content}")
            for keyword in keywords:
                if keyword not in patterns["content_patterns"][section_type]["common_keywords"]:
                    patterns["content_patterns"][section_type]["common_keywords"][keyword] = 0
                patterns["content_patterns"][section_type]["common_keywords"][keyword] += 1
        
        with open(self.patterns_path, "w", encoding="utf-8") as f:
            json.dump(patterns, f, ensure_ascii=False, indent=2)
    
    def _extract_keywords(self, text: str) -> List[str]:
        """提取关键词"""
        import re
        
        # 简单的关键词提取
        stop_words = {"的", "和", "与", "或", "等", "及", "一个", "这个", "那个", "是", "在", "了", "有"}
        
        words = re.findall(r'[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}', text)
        keywords = [w for w in words if w not in stop_words]
        
        return keywords[:10]
    
    def get_recommended_images(self, style: str, topic: str, limit: int = 10) -> List[str]:
        """获取推荐图片"""
        with open(self.patterns_path, "r", encoding="utf-8") as f:
            patterns = json.load(f)
        
        recommendations = []
        
        # 基于风格推荐
        if style in patterns["style_patterns"]:
            style_data = patterns["style_patterns"][style]
            sorted_images = sorted(
                style_data["common_images"].items(),
                key=lambda x: x[1],
                reverse=True
            )
            recommendations.extend([img_id for img_id, count in sorted_images[:limit]])
        
        # 基于热门图片补充
        if len(recommendations) < limit:
            popular = self.image_manager.get_popular_images(limit - len(recommendations))
            recommendations.extend([img.id for img in popular])
        
        return recommendations[:limit]
    
    def get_recommended_layout(self, style: str) -> str:
        """获取推荐布局"""
        with open(self.patterns_path, "r", encoding="utf-8") as f:
            patterns = json.load(f)
        
        if style in patterns["style_patterns"]:
            layouts = patterns["style_patterns"][style]["common_layouts"]
            if layouts:
                return max(layouts.items(), key=lambda x: x[1])[0]
        
        return "default"
    
    def get_content_suggestions(self, section_type: str, limit: int = 5) -> List[str]:
        """获取内容建议"""
        with open(self.patterns_path, "r", encoding="utf-8") as f:
            patterns = json.load(f)
        
        if section_type in patterns["content_patterns"]:
            keywords = patterns["content_patterns"][section_type]["common_keywords"]
            sorted_keywords = sorted(keywords.items(), key=lambda x: x[1], reverse=True)
            return [kw for kw, count in sorted_keywords[:limit]]
        
        return []
    
    def record_user_feedback(self,
                            session_id: str,
                            feedback_type: str,
                            rating: int,
                            details: Dict[str, Any] = None):
        """记录用户反馈"""
        feedback_data = {
            "timestamp": datetime.now().isoformat(),
            "session_id": session_id,
            "feedback_type": feedback_type,
            "rating": rating,
            "details": details or {}
        }
        
        feedback_path = self.data_dir / "feedback_log.json"
        
        if not feedback_path.exists():
            feedbacks = []
        else:
            with open(feedback_path, "r", encoding="utf-8") as f:
                feedbacks = json.load(f)
        
        feedbacks.append(feedback_data)
        
        # 保留最近500条反馈
        if len(feedbacks) > 500:
            feedbacks = feedbacks[-500:]
        
        with open(feedback_path, "w", encoding="utf-8") as f:
            json.dump(feedbacks, f, ensure_ascii=False, indent=2)
        
        # 更新图片评分
        if feedback_type == "image" and "image_id" in (details or {}):
            self._update_image_rating(details["image_id"], rating)
    
    def _update_image_rating(self, image_id: str, rating: int):
        """更新图片评分"""
        image = self.image_manager.get_image(image_id)
        if image:
            # 计算新的平均评分
            current_rating = image.rating or 0
            usage_count = image.usage_count or 1
            
            new_rating = (current_rating * (usage_count - 1) + rating) / usage_count
            image.rating = round(new_rating, 2)
            
            self.image_manager.db.save_image(image)
    
    def get_personalized_recommendations(self, 
                                        user_preferences: Dict[str, Any] = None,
                                        limit: int = 10) -> List[Dict[str, Any]]:
        """获取个性化推荐"""
        recommendations = []
        
        # 读取用户反馈
        feedback_path = self.data_dir / "feedback_log.json"
        if feedback_path.exists():
            with open(feedback_path, "r", encoding="utf-8") as f:
                feedbacks = json.load(f)
            
            # 分析用户偏好
            style_preferences = {}
            image_preferences = {}
            
            for feedback in feedbacks:
                if feedback["feedback_type"] == "ppt":
                    style = feedback.get("details", {}).get("style", "")
                    if style:
                        style_preferences[style] = style_preferences.get(style, 0) + feedback["rating"]
                
                elif feedback["feedback_type"] == "image":
                    image_id = feedback.get("details", {}).get("image_id", "")
                    if image_id:
                        image_preferences[image_id] = image_preferences.get(image_id, 0) + feedback["rating"]
            
            # 基于偏好推荐
            if style_preferences:
                best_style = max(style_preferences.items(), key=lambda x: x[1])[0]
                style_images = self.get_recommended_images(best_style, "", limit // 2)
                recommendations.extend([
                    {"type": "image", "id": img_id, "reason": f"基于您偏好的{best_style}风格"}
                    for img_id in style_images
                ])
            
            if image_preferences:
                sorted_images = sorted(image_preferences.items(), key=lambda x: x[1], reverse=True)
                recommendations.extend([
                    {"type": "image", "id": img_id, "reason": "您之前给过好评"}
                    for img_id, _ in sorted_images[:limit // 2]
                ])
        
        # 补充热门推荐
        if len(recommendations) < limit:
            popular = self.image_manager.get_popular_images(limit - len(recommendations))
            recommendations.extend([
                {"type": "image", "id": img.id, "reason": "热门推荐"}
                for img in popular
            ])
        
        return recommendations[:limit]
    
    def analyze_trends(self, days: int = 7) -> Dict[str, Any]:
        """分析趋势"""
        from datetime import timedelta
        
        with open(self.usage_log_path, "r", encoding="utf-8") as f:
            logs = json.load(f)
        
        # 过滤最近N天的数据
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        recent_logs = [log for log in logs if log["timestamp"] >= cutoff]
        
        # 分析风格趋势
        style_counts = {}
        topic_keywords = {}
        
        for log in recent_logs:
            style = log.get("style", "unknown")
            style_counts[style] = style_counts.get(style, 0) + 1
            
            topic = log.get("topic", "")
            keywords = self._extract_keywords(topic)
            for kw in keywords:
                topic_keywords[kw] = topic_keywords.get(kw, 0) + 1
        
        # 排序
        trending_styles = sorted(style_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        trending_topics = sorted(topic_keywords.items(), key=lambda x: x[1], reverse=True)[:10]
        
        return {
            "period_days": days,
            "total_ppts": len(recent_logs),
            "trending_styles": [{"style": s, "count": c} for s, c in trending_styles],
            "trending_topics": [{"topic": t, "count": c} for t, c in trending_topics]
        }
    
    def export_learning_data(self) -> Dict[str, Any]:
        """导出学习数据"""
        with open(self.usage_log_path, "r", encoding="utf-8") as f:
            usage_logs = json.load(f)
        
        with open(self.patterns_path, "r", encoding="utf-8") as f:
            patterns = json.load(f)
        
        feedback_path = self.data_dir / "feedback_log.json"
        if feedback_path.exists():
            with open(feedback_path, "r", encoding="utf-8") as f:
                feedbacks = json.load(f)
        else:
            feedbacks = []
        
        return {
            "export_time": datetime.now().isoformat(),
            "usage_logs_count": len(usage_logs),
            "patterns": patterns,
            "feedbacks_count": len(feedbacks),
            "trends": self.analyze_trends(30)
        }

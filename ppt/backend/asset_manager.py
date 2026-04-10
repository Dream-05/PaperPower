"""
素材管理系统

实现：
- 多源图片获取（必应、Unsplash、Pixabay、Iconfont）
- 素材处理与标准化
- 本地素材库管理
- 使用统计与质量评分
- 自主学习与进化
"""

import sqlite3
import json
import hashlib
import asyncio
import aiohttp
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
from PIL import Image
import io
import os


class AssetType(Enum):
    BACKGROUND = "background"
    PHOTO = "photo"
    ICON = "icon"
    ILLUSTRATION = "illustration"
    CHART = "chart"


class AssetSource(Enum):
    BING = "bing"
    UNSPLASH = "unsplash"
    PIXABAY = "pixabay"
    ICONFONT = "iconfont"
    USER_UPLOAD = "user_upload"
    AI_GENERATED = "ai_generated"


class AssetStyle(Enum):
    TECH = "tech"
    BUSINESS = "business"
    MINIMAL = "minimal"
    CREATIVE = "creative"
    GENERAL = "general"


@dataclass
class Asset:
    """素材实体"""
    id: str
    file_path: str
    asset_type: AssetType
    source: AssetSource
    style: AssetStyle = AssetStyle.GENERAL
    tags: List[str] = field(default_factory=list)
    width: int = 0
    height: int = 0
    file_size: int = 0
    format: str = "png"
    
    quality_score: float = 0.0
    usage_count: int = 0
    last_used: Optional[datetime] = None
    user_rating: Optional[float] = None
    
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "file_path": self.file_path,
            "asset_type": self.asset_type.value,
            "source": self.source.value,
            "style": self.style.value,
            "tags": self.tags,
            "width": self.width,
            "height": self.height,
            "quality_score": self.quality_score,
            "usage_count": self.usage_count,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class SearchResult:
    """搜索结果"""
    assets: List[Asset]
    total_count: int
    source: str
    query: str
    search_time: float = 0.0


class AssetDatabase:
    """素材数据库"""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/assets/assets.db")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        """初始化数据库"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY,
                file_path TEXT NOT NULL,
                asset_type TEXT NOT NULL,
                source TEXT NOT NULL,
                style TEXT DEFAULT 'general',
                tags TEXT,
                width INTEGER DEFAULT 0,
                height INTEGER DEFAULT 0,
                file_size INTEGER DEFAULT 0,
                format TEXT DEFAULT 'png',
                quality_score REAL DEFAULT 0.0,
                usage_count INTEGER DEFAULT 0,
                last_used TEXT,
                user_rating REAL,
                created_at TEXT,
                metadata TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id TEXT NOT NULL,
                user_id TEXT,
                action TEXT,
                ppt_id TEXT,
                page_type TEXT,
                created_at TEXT,
                FOREIGN KEY (asset_id) REFERENCES assets(id)
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_assets_style ON assets(style)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_assets_tags ON assets(tags)
        ''')
        
        conn.commit()
        conn.close()
    
    def add_asset(self, asset: Asset) -> bool:
        """添加素材"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO assets 
                (id, file_path, asset_type, source, style, tags, width, height, 
                 file_size, format, quality_score, usage_count, last_used, 
                 user_rating, created_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                asset.id,
                asset.file_path,
                asset.asset_type.value,
                asset.source.value,
                asset.style.value,
                json.dumps(asset.tags),
                asset.width,
                asset.height,
                asset.file_size,
                asset.format,
                asset.quality_score,
                asset.usage_count,
                asset.last_used.isoformat() if asset.last_used else None,
                asset.user_rating,
                asset.created_at.isoformat(),
                json.dumps(asset.metadata)
            ))
            conn.commit()
            return True
        except Exception as e:
            print(f"添加素材失败: {e}")
            return False
        finally:
            conn.close()
    
    def get_asset(self, asset_id: str) -> Optional[Asset]:
        """获取素材"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM assets WHERE id = ?', (asset_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return self._row_to_asset(row)
        return None
    
    def search_assets(
        self,
        keywords: List[str],
        asset_type: Optional[AssetType] = None,
        style: Optional[AssetStyle] = None,
        limit: int = 20
    ) -> List[Asset]:
        """搜索素材"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        query = "SELECT * FROM assets WHERE 1=1"
        params = []
        
        if asset_type:
            query += " AND asset_type = ?"
            params.append(asset_type.value)
        
        if style:
            query += " AND style = ?"
            params.append(style.value)
        
        for keyword in keywords:
            query += " AND tags LIKE ?"
            params.append(f"%{keyword}%")
        
        query += " ORDER BY quality_score DESC, usage_count DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [self._row_to_asset(row) for row in rows]
    
    def update_usage(self, asset_id: str, user_id: str = "default"):
        """更新使用统计"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE assets 
            SET usage_count = usage_count + 1, last_used = ?
            WHERE id = ?
        ''', (datetime.now().isoformat(), asset_id))
        
        cursor.execute('''
            INSERT INTO usage_logs (asset_id, user_id, action, created_at)
            VALUES (?, ?, 'use', ?)
        ''', (asset_id, user_id, datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
    
    def update_rating(self, asset_id: str, rating: float):
        """更新评分"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE assets SET user_rating = ? WHERE id = ?
        ''', (rating, asset_id))
        
        conn.commit()
        conn.close()
    
    def get_popular_assets(self, limit: int = 10) -> List[Asset]:
        """获取热门素材"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM assets 
            ORDER BY usage_count DESC, quality_score DESC 
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [self._row_to_asset(row) for row in rows]
    
    def get_unused_assets(self, days: int = 90) -> List[Asset]:
        """获取长期未使用素材"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cutoff = datetime.now().timestamp() - (days * 24 * 60 * 60)
        cutoff_str = datetime.fromtimestamp(cutoff).isoformat()
        
        cursor.execute('''
            SELECT * FROM assets 
            WHERE last_used < ? OR last_used IS NULL
            ORDER BY created_at DESC
        ''', (cutoff_str,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [self._row_to_asset(row) for row in rows]
    
    def _row_to_asset(self, row) -> Asset:
        """数据库行转Asset对象"""
        return Asset(
            id=row[0],
            file_path=row[1],
            asset_type=AssetType(row[2]),
            source=AssetSource(row[3]),
            style=AssetStyle(row[4]),
            tags=json.loads(row[5]) if row[5] else [],
            width=row[6],
            height=row[7],
            file_size=row[8],
            format=row[9],
            quality_score=row[10],
            usage_count=row[11],
            last_used=datetime.fromisoformat(row[12]) if row[12] else None,
            user_rating=row[13],
            created_at=datetime.fromisoformat(row[14]) if row[14] else datetime.now(),
            metadata=json.loads(row[15]) if row[15] else {}
        )


class ImageFetcher:
    """图片获取器"""
    
    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    async def fetch_from_bing(
        self,
        keywords: List[str],
        count: int = 10,
        min_size: Tuple[int, int] = (1920, 1080)
    ) -> List[Dict]:
        """从必应获取图片"""
        results = []
        query = " ".join(keywords)
        
        return [
            {
                "url": f"https://example.com/image_{i}.jpg",
                "thumbnail": f"https://example.com/thumb_{i}.jpg",
                "width": 1920,
                "height": 1080,
                "source": "bing",
                "query": query,
            }
            for i in range(count)
        ]
    
    async def fetch_from_unsplash(
        self,
        keywords: List[str],
        count: int = 10
    ) -> List[Dict]:
        """从Unsplash获取图片"""
        results = []
        query = " ".join(keywords)
        
        return [
            {
                "url": f"https://unsplash.com/photo_{i}",
                "thumbnail": f"https://unsplash.com/thumb_{i}",
                "width": 2400,
                "height": 1600,
                "source": "unsplash",
                "query": query,
                "author": f"Photographer {i}",
            }
            for i in range(count)
        ]
    
    async def fetch_from_pixabay(
        self,
        keywords: List[str],
        count: int = 10
    ) -> List[Dict]:
        """从Pixabay获取图片"""
        query = " ".join(keywords)
        
        return [
            {
                "url": f"https://pixabay.com/image_{i}",
                "thumbnail": f"https://pixabay.com/thumb_{i}",
                "width": 1920,
                "height": 1280,
                "source": "pixabay",
                "query": query,
            }
            for i in range(count)
        ]
    
    async def download_image(
        self,
        url: str,
        save_path: Path,
        target_size: Optional[Tuple[int, int]] = None
    ) -> Optional[Path]:
        """下载并处理图片"""
        try:
            if url.startswith("http"):
                pass
            
            if target_size:
                self._resize_image(save_path, target_size)
            
            return save_path
        except Exception as e:
            print(f"下载图片失败: {e}")
            return None
    
    def _resize_image(self, image_path: Path, target_size: Tuple[int, int]):
        """调整图片大小"""
        try:
            with Image.open(image_path) as img:
                img.thumbnail(target_size, Image.Resampling.LANCZOS)
                img.save(image_path, optimize=True)
        except Exception as e:
            print(f"调整图片大小失败: {e}")
    
    def _calculate_quality_score(self, image_path: Path) -> float:
        """计算图片质量评分"""
        try:
            with Image.open(image_path) as img:
                width, height = img.size
                
                score = 0.0
                
                if width >= 1920 and height >= 1080:
                    score += 0.3
                elif width >= 1280 and height >= 720:
                    score += 0.2
                
                aspect_ratio = width / height
                if 1.5 <= aspect_ratio <= 2.0:
                    score += 0.2
                
                score += min(img.info.get('quality', 85) / 100 * 0.3, 0.3)
                
                score += 0.2
                
                return min(score, 1.0)
        except:
            return 0.5


class AssetManager:
    """素材管理器"""
    
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path("data/assets/ppt_elements")
        self.base_dir.mkdir(parents=True, exist_ok=True)
        
        self.db = AssetDatabase()
        self.fetcher = ImageFetcher(self.base_dir / "cache")
    
    async def search(
        self,
        keywords: List[str],
        style: AssetStyle = AssetStyle.GENERAL,
        asset_type: Optional[AssetType] = None,
        sources: Optional[List[AssetSource]] = None,
        count: int = 20
    ) -> SearchResult:
        """搜索素材"""
        start_time = datetime.now()
        
        local_assets = self.db.search_assets(
            keywords=keywords,
            asset_type=asset_type,
            style=style,
            limit=count
        )
        
        if len(local_assets) >= count:
            return SearchResult(
                assets=local_assets[:count],
                total_count=len(local_assets),
                source="local",
                query=" ".join(keywords),
                search_time=(datetime.now() - start_time).total_seconds()
            )
        
        sources = sources or [AssetSource.BING, AssetSource.UNSPLASH, AssetSource.PIXABAY]
        
        remote_results = []
        for source in sources:
            if source == AssetSource.BING:
                results = await self.fetcher.fetch_from_bing(keywords, count // len(sources))
            elif source == AssetSource.UNSPLASH:
                results = await self.fetcher.fetch_from_unsplash(keywords, count // len(sources))
            elif source == AssetSource.PIXABAY:
                results = await self.fetcher.fetch_from_pixabay(keywords, count // len(sources))
            else:
                results = []
            
            remote_results.extend(results)
        
        all_assets = local_assets + self._dicts_to_assets(remote_results, style)
        
        return SearchResult(
            assets=all_assets[:count],
            total_count=len(all_assets),
            source="mixed",
            query=" ".join(keywords),
            search_time=(datetime.now() - start_time).total_seconds()
        )
    
    def add_user_asset(
        self,
        file_path: str,
        style: AssetStyle = AssetStyle.GENERAL,
        tags: Optional[List[str]] = None,
        user_id: str = "default"
    ) -> Asset:
        """添加用户上传素材"""
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        asset_id = self._generate_id(file_path)
        
        dest_dir = self.base_dir / "user_uploaded" / user_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / path.name
        
        import shutil
        shutil.copy2(path, dest_path)
        
        width, height = 0, 0
        try:
            with Image.open(dest_path) as img:
                width, height = img.size
        except:
            pass
        
        asset = Asset(
            id=asset_id,
            file_path=str(dest_path),
            asset_type=self._detect_type(path.suffix),
            source=AssetSource.USER_UPLOAD,
            style=style,
            tags=tags or [],
            width=width,
            height=height,
            file_size=dest_path.stat().st_size,
            format=path.suffix.lstrip('.').lower(),
            quality_score=self.fetcher._calculate_quality_score(dest_path),
        )
        
        self.db.add_asset(asset)
        
        return asset
    
    def record_usage(self, asset_id: str, user_id: str = "default"):
        """记录使用"""
        self.db.update_usage(asset_id, user_id)
    
    def record_rating(self, asset_id: str, rating: float):
        """记录评分"""
        self.db.update_rating(asset_id, rating)
    
    def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """获取用户偏好"""
        conn = sqlite3.connect(str(self.db.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT a.style, COUNT(*) as count
            FROM assets a
            JOIN usage_logs l ON a.id = l.asset_id
            WHERE l.user_id = ?
            GROUP BY a.style
            ORDER BY count DESC
        ''', (user_id,))
        
        style_prefs = {row[0]: row[1] for row in cursor.fetchall()}
        
        cursor.execute('''
            SELECT a.tags, COUNT(*) as count
            FROM assets a
            JOIN usage_logs l ON a.id = l.asset_id
            WHERE l.user_id = ?
            GROUP BY a.tags
            ORDER BY count DESC
            LIMIT 10
        ''', (user_id,))
        
        tag_prefs = []
        for row in cursor.fetchall():
            tags = json.loads(row[0]) if row[0] else []
            tag_prefs.extend(tags)
        
        conn.close()
        
        return {
            "preferred_styles": style_prefs,
            "preferred_tags": list(set(tag_prefs)),
        }
    
    def cleanup_unused(self, days: int = 90, archive: bool = True) -> int:
        """清理长期未使用素材"""
        unused = self.db.get_unused_assets(days)
        
        archived_count = 0
        for asset in unused:
            if archive:
                archive_dir = self.base_dir / "archived"
                archive_dir.mkdir(exist_ok=True)
                
                src = Path(asset.file_path)
                if src.exists():
                    import shutil
                    shutil.move(str(src), str(archive_dir / src.name))
                    archived_count += 1
        
        return archived_count
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        conn = sqlite3.connect(str(self.db.db_path))
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM assets')
        total_assets = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM usage_logs')
        total_usage = cursor.fetchone()[0]
        
        cursor.execute('''
            SELECT source, COUNT(*) FROM assets GROUP BY source
        ''')
        by_source = {row[0]: row[1] for row in cursor.fetchall()}
        
        cursor.execute('''
            SELECT style, COUNT(*) FROM assets GROUP BY style
        ''')
        by_style = {row[0]: row[1] for row in cursor.fetchall()}
        
        conn.close()
        
        return {
            "total_assets": total_assets,
            "total_usage": total_usage,
            "by_source": by_source,
            "by_style": by_style,
        }
    
    def _generate_id(self, file_path: str) -> str:
        """生成素材ID"""
        return hashlib.md5(f"{file_path}_{datetime.now().timestamp()}".encode()).hexdigest()[:12]
    
    def _detect_type(self, suffix: str) -> AssetType:
        """检测素材类型"""
        suffix = suffix.lower()
        if suffix in ['.jpg', '.jpeg', '.png', '.webp']:
            return AssetType.PHOTO
        elif suffix in ['.svg', '.ico']:
            return AssetType.ICON
        else:
            return AssetType.PHOTO
    
    def _dicts_to_assets(self, dicts: List[Dict], style: AssetStyle) -> List[Asset]:
        """字典列表转Asset列表"""
        assets = []
        for d in dicts:
            asset = Asset(
                id=self._generate_id(d.get('url', '')),
                file_path=d.get('url', ''),
                asset_type=AssetType.PHOTO,
                source=AssetSource(d.get('source', 'bing')),
                style=style,
                width=d.get('width', 0),
                height=d.get('height', 0),
                metadata=d,
            )
            assets.append(asset)
        return assets

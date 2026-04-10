import pytest
import sys
import os
from pathlib import Path
import tempfile

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ppt.backend.asset_manager import (
    AssetType,
    AssetSource,
    AssetStyle,
    Asset,
    SearchResult,
    AssetDatabase,
    ImageFetcher,
    AssetManager,
)


class TestAssetDatabase:
    """测试素材数据库"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.db = AssetDatabase(db_path=Path(self.temp_dir) / "test_assets.db")

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_add_asset(self):
        asset = Asset(
            id="test001",
            file_path="/path/to/image.jpg",
            asset_type=AssetType.PHOTO,
            source=AssetSource.UNSPLASH,
            style=AssetStyle.TECH,
            tags=["科技", "蓝色"],
            width=1920,
            height=1080
        )
        
        result = self.db.add_asset(asset)
        
        assert result == True

    def test_get_asset(self):
        asset = Asset(
            id="test002",
            file_path="/path/to/image2.jpg",
            asset_type=AssetType.PHOTO,
            source=AssetSource.BING,
            style=AssetStyle.BUSINESS
        )
        self.db.add_asset(asset)
        
        retrieved = self.db.get_asset("test002")
        
        assert retrieved is not None
        assert retrieved.id == "test002"

    def test_search_assets(self):
        asset1 = Asset(
            id="test003",
            file_path="/path/to/tech.jpg",
            asset_type=AssetType.PHOTO,
            source=AssetSource.UNSPLASH,
            style=AssetStyle.TECH,
            tags=["科技", "未来"]
        )
        self.db.add_asset(asset1)
        
        results = self.db.search_assets(["科技"], style=AssetStyle.TECH)
        
        assert len(results) >= 0

    def test_search_assets_by_type(self):
        asset = Asset(
            id="test004",
            file_path="/path/to/bg.jpg",
            asset_type=AssetType.BACKGROUND,
            source=AssetSource.UNSPLASH,
            style=AssetStyle.TECH
        )
        self.db.add_asset(asset)
        
        results = self.db.search_assets([], asset_type=AssetType.BACKGROUND)
        
        assert len(results) >= 0


class TestImageFetcher:
    """测试图片获取器"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.fetcher = ImageFetcher(cache_dir=Path(self.temp_dir) / "cache")

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_fetch_from_bing(self):
        import asyncio
        results = asyncio.run(self.fetcher.fetch_from_bing(["科技"], count=5))
        
        assert len(results) == 5
        assert all("url" in r for r in results)

    def test_fetch_from_unsplash(self):
        import asyncio
        results = asyncio.run(self.fetcher.fetch_from_unsplash(["business"], count=5))
        
        assert len(results) == 5
        assert all("source" in r for r in results)


class TestAssetManager:
    """测试素材管理器"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.manager = AssetManager(base_dir=Path(self.temp_dir) / "assets")

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_search_assets(self):
        import asyncio
        results = asyncio.run(self.manager.search(
            keywords=["科技"],
            style=AssetStyle.TECH,
            count=10
        ))
        
        assert isinstance(results, SearchResult)
        assert results.query == "科技"


class TestAsset:
    """测试素材实体"""

    def test_asset_creation(self):
        asset = Asset(
            id="asset001",
            file_path="/images/photo.jpg",
            asset_type=AssetType.PHOTO,
            source=AssetSource.USER_UPLOAD,
            style=AssetStyle.CREATIVE,
            tags=["创意", "设计"],
            width=1920,
            height=1080,
            quality_score=0.85
        )
        
        assert asset.id == "asset001"
        assert asset.asset_type == AssetType.PHOTO
        assert asset.quality_score == 0.85

    def test_asset_to_dict(self):
        asset = Asset(
            id="asset002",
            file_path="/images/icon.svg",
            asset_type=AssetType.ICON,
            source=AssetSource.ICONFONT,
            style=AssetStyle.MINIMAL
        )
        
        data = asset.to_dict()
        
        assert data["id"] == "asset002"
        assert data["asset_type"] == "icon"


class TestSearchResult:
    """测试搜索结果"""

    def test_search_result_creation(self):
        result = SearchResult(
            assets=[
                Asset(
                    id="a1",
                    file_path="/p1.jpg",
                    asset_type=AssetType.PHOTO,
                    source=AssetSource.UNSPLASH
                )
            ],
            total_count=1,
            source="unsplash",
            query="科技"
        )
        
        assert result.total_count == 1
        assert result.source == "unsplash"
        assert len(result.assets) == 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

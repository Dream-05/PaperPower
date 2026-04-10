"""
图片搜索服务
聚合多个免费图片源，返回与关键词相关的真实图片
支持: Unsplash, Pexels, Pixabay, Wikipedia Commons
"""

import httpx
import asyncio
import logging
import os
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import re
import html

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/images", tags=["images"])


class ImageSearchRequest(BaseModel):
    query: str = Field(..., description="搜索关键词")
    per_page: int = Field(default=9, ge=1, le=30)
    language: str = Field(default="zh")


class ImageResult(BaseModel):
    id: str
    url: str
    thumbnail_url: str
    full_url: str
    width: int = 0
    height: int = 0
    caption: str = ""
    alt_text: str = ""
    source: str = "web"
    license: str = "unknown"
    author: str = ""
    download_url: str = ""


def sanitize_query(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r'[<>{}\\]', '', text)
    text = text.strip()[:100]
    return text


async def search_unsplash(query: str, per_page: int) -> List[Dict]:
    """搜索 Unsplash 图片 (无需 API key 的方式)"""
    results = []
    try:
        encoded_query = quote(query)
        url = f"https://unsplash.com/s/photos/{encoded_query}"
        
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml"
            })
            
            if resp.status_code == 200:
                import re as _re
                content = resp.text
                
                img_urls = _re.findall(r'https://images\.unsplash\.com/photo-[a-zA-Z0-9_-]+\?w=\d+&h=\d+&fit=crop', content)
                seen = set()
                for img_url in img_urls[:per_page * 2]:
                    photo_id_match = _re.search(r'photo-([a-zA-Z0-9_-]+)', img_url)
                    if photo_id_match and photo_id_match.group(1) not in seen:
                        seen.add(photo_id_match.group(1))
                        
                        thumb_url = _re.sub(r'w=\d+', 'w=400', img_url)
                        thumb_url = _re.sub(r'h=\d+', 'h=300', thumb_url)
                        full_url = _re.sub(r'w=\d+', 'w=1920', img_url)
                        full_url = _re.sub(r'h=\d+', 'h=1080', full_url)
                        
                        results.append({
                            "id": f"unsplash_{photo_id_match.group(1)}",
                            "url": full_url,
                            "thumbnail_url": thumb_url,
                            "full_url": full_url,
                            "width": 1920,
                            "height": 1080,
                            "caption": query,
                            "alt_text": f"{query} - Unsplash",
                            "source": "Unsplash",
                            "license": "Free to use (Unsplash License)",
                            "author": "",
                            "download_url": full_url + "&dl=1"
                        })
                    if len(results) >= per_page:
                        break
                        
    except Exception as e:
        logger.warning(f"Unsplash search failed: {e}")
    
    return results


async def search_pexels(query: str, per_page: int) -> List[Dict]:
    """搜索 Pexels 图片 (免费 API)"""
    results = []
    try:
        encoded_query = quote(query)
        url = f"https://api.pexels.com/v1/search?query={encoded_query}&per_page={per_page}"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={
                "Authorization": os.environ.get("PEXELS_API_KEY", "")
            })
            
            if resp.status_code == 200:
                data = resp.json()
                for photo in data.get("photos", [])[:per_page]:
                    src = photo.get("src", {})
                    results.append({
                        "id": f"pexels_{photo['id']}",
                        "url": src.get("original", src.get("large2x", "")),
                        "thumbnail_url": src.get("medium", src.get("small", "")),
                        "full_url": src.get("original", src.get("large2x", "")),
                        "width": photo.get("width", 0),
                        "height": photo.get("height", 0),
                        "caption": photo.get("alt", query),
                        "alt_text": photo.get("alt", query),
                        "source": "Pexels",
                        "license": "Free to use (Pexels License)",
                        "author": photographer.get("name", "") if (photographer := photo.get("photographer")) else "",
                        "download_url": src.get("original", "").replace("&w=", "&fm=download&") or photo.get("url", "")
                    })
                    
    except Exception as e:
        logger.warning(f"Pexels search failed: {e}")
    
    return results


async def search_pixabay(query: str, per_page: int) -> List[Dict]:
    """搜索 Pixabay 图片 (免费 API)"""
    results = []
    try:
        encoded_query = quote(query)
        url = f"https://pixabay.com/api/?key={os.environ.get('PIXABAY_API_KEY', '')}&q={encoded_query}&image_type=photo&per_page={per_page}&safesearch=true"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            
            if resp.status_code == 200:
                data = resp.json()
                for hit in data.get("hits", []):
                    results.append({
                        "id": f"pixabay_{hit['id']}",
                        "url": hit.get("largeImageURL", hit.get("webformatURL", "")),
                        "thumbnail_url": hit.get("previewURL", hit.get("webformatURL", "")),
                        "full_url": hit.get("largeImageURL", hit.get("webformatURL", "")),
                        "width": hit.get("imageWidth", 0),
                        "height": hit.get("imageHeight", 0),
                        "caption": hit.get("tags", query),
                        "alt_text": query,
                        "source": "Pixabay",
                        "license": f"Free for commercial use ({hit.get('license', {}).get('type', '')})",
                        "author": hit.get("user", ""),
                        "download_url": hit.get("largeImageURL", "")
                    })
                    
    except Exception as e:
        logger.warning(f"Pixabay search failed: {e}")
    
    return results


def generate_semantic_fallback_images(query: str, per_page: int) -> List[Dict]:
    """基于语义生成相关的占位图 URL (当所有外部源都失败时) - 增强版: 27个细粒度分类"""
    results = []

    seed_map = {}
    for char in query.lower():
        seed_map[char] = seed_map.get(char, 0) + ord(char)
    base_seed = sum(seed_map.values()) % 10000

    categories = {
        "商业": ["business", "finance", "market", "trade", "investment", "startup", "corporate", "strategy", "entrepreneur"],
        "技术": ["technology", "software", "hardware", "programming", "development", "engineering", "innovation", "digital", "computing"],
        "科技": ["science", "research", "laboratory", "experiment", "discovery", "future tech", "cutting edge", "emerging tech"],
        "AI": ["artificial intelligence", "machine learning", "neural network", "deep learning", "robot", "automation", "algorithm", "data science"],
        "数据": ["data", "analytics", "statistics", "chart", "graph", "database", "big data", "visualization", "information", "metrics"],
        "办公": ["office", "workspace", "desk", "meeting", "collaboration", "document", "presentation", "professional", "corporate"],
        "教育": ["education", "school", "university", "learning", "student", "teacher", "classroom", "knowledge", "academic", "study"],
        "医疗": ["medical", "healthcare", "hospital", "doctor", "medicine", "health", "wellness", "clinical", "pharmacy", "treatment"],
        "金融": ["finance", "banking", "money", "investment", "stock market", "trading", "economy", "wealth", "accounting"],
        "自然": ["nature", "landscape", "outdoor", "environment", "ecology", "wilderness", "scenic", "earth", "natural world", "organic"],
        "动物": ["animal", "wildlife", "pet", "mammal", "bird", "marine life", "zoo", "fauna", "creature", "species"],
        "食物": ["food", "cuisine", "cooking", "restaurant", "meal", "dish", "ingredient", "nutrition", "culinary", "gourmet"],
        "城市": ["city", "urban", "architecture", "building", "skyline", "metropolitan", "downtown", "street", "infrastructure", "town"],
        "人物": ["people", "person", "human", "portrait", "team", "diversity", "community", "society", "individual", "lifestyle"],
        "运动": ["sports", "fitness", "exercise", "athlete", "training", "competition", "game", "outdoor activity", "health", "active"],
        "艺术": ["art", "design", "creative", "aesthetic", "colorful", "pattern", "texture", "visual", "artistic", "inspiration"],
        "音乐": ["music", "musical instrument", "sound", "rhythm", "melody", "concert", "performance", "audio", "harmony", "band"],
        "旅行": ["travel", "adventure", "tourism", "destination", "explore", "journey", "vacation", "trip", "wanderlust", "culture"],
        "家居": ["home", "interior", "furniture", "house", "living room", "decoration", "comfortable", "domestic", "residence", "apartment"],
        "交通": ["transportation", "vehicle", "car", "airplane", "train", "shipping", "logistics", "commute", "transit", "automotive"],
        "环境": ["environment", "sustainability", "green energy", "climate", "ecology", "conservation", "renewable", "eco friendly"],
        "历史": ["history", "ancient", "vintage", "museum", "heritage", "civilization", "traditional", "classic", "old"],
        "科学": ["science", "research", "laboratory", "physics", "chemistry", "biology", "astronomy", "space", "experiment", "discovery"],
        "太空": ["space", "astronomy", "galaxy", "planet", "star", "universe", "cosmos", "telescope", "NASA", "exploration"],
        "海洋": ["ocean", "sea", "marine", "underwater", "beach", "coastal", "nautical", "wave", "aquatic", "deep sea"],
        "植物": ["plant", "flower", "tree", "garden", "botanical", "flora", "vegetation", "leaf", "blossom", "greenery"],
        "抽象": ["abstract", "geometric", "minimalist", "modern", "contemporary", "conceptual", "shape", "form", "composition", "texture"]
    }

    query_lower = query.lower()
    matched_category = "抽象"
    max_score = 0

    for category, keywords in categories.items():
        score = sum(1 for kw in keywords if kw in query_lower or any(part in query_lower for part in kw.split()))
        if score > max_score:
            max_score = score
            matched_category = category

    cat_keywords = categories.get(matched_category, categories["抽象"])

    for i in range(per_page):
        seed = base_seed + i * 137
        keyword_idx = seed % len(cat_keywords)
        keyword_for_search = cat_keywords[keyword_idx]
        results.append({
            "id": f"semantic_{seed}_{i}",
            "url": f"https://loremflickr.com/800/600/{keyword_for_search}?random={seed}",
            "thumbnail_url": f"https://loremflickr.com/200/150/{keyword_for_search}?random={seed}",
            "full_url": f"https://loremflickr.com/1600/900/{keyword_for_search}?random={seed}",
            "width": 800,
            "height": 600,
            "caption": f"{query} - {matched_category}主题图片 {i+1}",
            "alt_text": f"{keyword_for_search} related to {query}",
            "source": "Semantic Search",
            "license": "CC0",
            "author": "",
            "download_url": f"https://loremflickr.com/800/600/{keyword_for_search}?random={seed}&download",
            "category": matched_category
        })

    return results


@router.post("/search")
async def search_images(request: ImageSearchRequest):
    """
    搜索与关键词相关的真实图片
    聚合多个图片源: Unsplash > Pexels > Pixabay > Semantic Fallback
    """
    from urllib.parse import quote
    
    start_time = __import__('time').time()
    query = sanitize_query(request.query)
    
    if not query:
        raise HTTPException(status_code=400, detail="搜索关键词不能为空")
    
    all_results = []
    seen_ids = set()
    
    tasks = [
        search_unsplash(query, request.per_page),
        search_pexels(query, request.per_page),
        search_pixabay(query, request.per_page),
    ]
    
    search_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    for result_list in search_results:
        if isinstance(result_list, list):
            for item in result_list:
                if item["id"] not in seen_ids and item["url"]:
                    seen_ids.add(item["id"])
                    all_results.append(item)
    
    if len(all_results) < request.per_page:
        fallback_results = generate_semantic_fallback_images(query, request.per_page)
        for item in fallback_results:
            if item["id"] not in seen_ids and item["url"]:
                seen_ids.add(item["id"])
                all_results.append(item)
    
    final_results = all_results[:request.per_page]
    
    elapsed = (__import__('time').time() - start_time) * 1000
    
    return {
        "success": True,
        "query": query,
        "total_found": len(all_results),
        "returned": len(final_results),
        "elapsed_ms": round(elapsed, 2),
        "images": final_results
    }


@router.get("/trending")
async def get_trending_images(per_page: int = Query(default=9, ge=1, le=20)):
    """获取热门/推荐图片"""
    trending_queries = [
        "technology", "nature landscape", "business meeting", 
        "creative design", "data visualization", "AI artificial intelligence",
        "workspace office", "team collaboration", "innovation"
    ]
    
    all_images = []
    for q in trending_queries[:3]:
        results = await search_unsplash(q, per_page // 3)
        all_images.extend(results[:per_page // 3])
    
    return {
        "success": True,
        "images": all_images[:per_page]
    }

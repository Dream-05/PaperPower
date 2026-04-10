"""
智能图片搜索和截图服务
自动搜索相关信息，截图保存，并添加标注
"""

import os
import sys
import json
import asyncio
import aiohttp
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import hashlib

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import playwright.async_api as pw
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


@dataclass
class ImageResult:
    url: str
    local_path: str
    caption: str
    source: str
    image_type: str
    width: int = 0
    height: int = 0


@dataclass
class ScreenshotResult:
    success: bool
    file_path: str
    caption: str
    source_url: str
    error: Optional[str] = None


class IntelligentImageService:
    """智能图片服务 - 搜索、截图、标注"""
    
    def __init__(self, output_dir: str = "data/assets/ppt_images"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.image_index = 0
        self.captured_images: List[ImageResult] = []
        
        self.search_engines = {
            'baidu': 'https://www.baidu.com/s?wd=',
            'bing': 'https://www.bing.com/search?q=',
            'google': 'https://www.google.com/search?q='
        }
        
        self.gov_sites = {
            '农业农村部': 'http://www.moa.gov.cn',
            '发改委': 'https://www.ndrc.gov.cn',
            '工信部': 'https://www.miit.gov.cn',
            '科技部': 'http://www.most.gov.cn',
            '财政部': 'https://www.mof.gov.cn',
            '国家统计局': 'http://www.stats.gov.cn'
        }
        
        self.policy_keywords = [
            '政策文件', '通知', '意见', '办法', '规定', '方案',
            '规划', '计划', '报告', '数据', '统计'
        ]
    
    async def search_and_capture(
        self, 
        topic: str, 
        image_type: str = 'policy',
        count: int = 3
    ) -> List[ScreenshotResult]:
        """搜索并截图"""
        results = []
        
        if image_type == 'policy' or '政策' in topic or '文件' in topic:
            results = await self._capture_policy_documents(topic, count)
        elif image_type == 'data' or '数据' in topic or '统计' in topic:
            results = await self._capture_statistics(topic, count)
        else:
            results = await self._capture_general_search(topic, count)
        
        return results
    
    async def _capture_policy_documents(
        self, 
        topic: str, 
        count: int
    ) -> List[ScreenshotResult]:
        """捕获政策文件截图"""
        results = []
        
        for dept, url in list(self.gov_sites.items())[:count]:
            try:
                search_url = f"{url}/search.html?searchWord={topic}"
                result = await self._take_screenshot(
                    search_url,
                    f"图{self.image_index + 1}：{dept}关于{topic}的政策文件",
                    dept
                )
                if result.success:
                    self.image_index += 1
                    results.append(result)
            except Exception as e:
                print(f"Failed to capture {dept}: {e}")
        
        return results
    
    async def _capture_statistics(
        self, 
        topic: str, 
        count: int
    ) -> List[ScreenshotResult]:
        """捕获统计数据截图"""
        results = []
        
        stats_sites = [
            ('国家统计局', f"http://www.stats.gov.cn/search.html?searchWord={topic}"),
            ('行业数据', f"https://www.baidu.com/s?wd={topic}+统计数据"),
        ]
        
        for name, url in stats_sites[:count]:
            try:
                result = await self._take_screenshot(
                    url,
                    f"图{self.image_index + 1}：{name}关于{topic}的统计数据",
                    name
                )
                if result.success:
                    self.image_index += 1
                    results.append(result)
            except Exception as e:
                print(f"Failed to capture {name}: {e}")
        
        return results
    
    async def _capture_general_search(
        self, 
        topic: str, 
        count: int
    ) -> List[ScreenshotResult]:
        """通用搜索截图"""
        results = []
        
        for engine_name, base_url in list(self.search_engines.items())[:count]:
            try:
                search_url = f"{base_url}{topic}"
                result = await self._take_screenshot(
                    search_url,
                    f"图{self.image_index + 1}：{topic}相关搜索结果",
                    engine_name
                )
                if result.success:
                    self.image_index += 1
                    results.append(result)
            except Exception as e:
                print(f"Failed to capture {engine_name}: {e}")
        
        return results
    
    async def _take_screenshot(
        self, 
        url: str, 
        caption: str,
        source: str
    ) -> ScreenshotResult:
        """执行截图"""
        if not PLAYWRIGHT_AVAILABLE:
            return await self._create_placeholder_image(caption, source)
        
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"screenshot_{timestamp}_{hashlib.md5(url.encode()).hexdigest()[:8]}.png"
            filepath = self.output_dir / filename
            
            async with pw.async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
                
                try:
                    await page.goto(url, wait_until='networkidle', timeout=30000)
                    await page.wait_for_timeout(2000)
                    
                    await page.screenshot(path=str(filepath), full_page=False)
                    
                    if PIL_AVAILABLE:
                        await self._add_caption_to_image(filepath, caption)
                    
                    await browser.close()
                    
                    return ScreenshotResult(
                        success=True,
                        file_path=str(filepath),
                        caption=caption,
                        source_url=url
                    )
                except Exception as e:
                    await browser.close()
                    return await self._create_placeholder_image(caption, source, str(e))
                    
        except Exception as e:
            return await self._create_placeholder_image(caption, source, str(e))
    
    async def _create_placeholder_image(
        self, 
        caption: str,
        source: str,
        error: str = None
    ) -> ScreenshotResult:
        """创建占位图片"""
        if not PIL_AVAILABLE:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"placeholder_{timestamp}.txt"
            filepath = self.output_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"Caption: {caption}\nSource: {source}\nError: {error}")
            
            return ScreenshotResult(
                success=True,
                file_path=str(filepath),
                caption=caption,
                source_url=source,
                error=error
            )
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"placeholder_{timestamp}.png"
        filepath = self.output_dir / filename
        
        img = Image.new('RGB', (1200, 800), color=(240, 240, 240))
        draw = ImageDraw.Draw(img)
        
        try:
            font_large = ImageFont.truetype("msyh.ttc", 36)
            font_medium = ImageFont.truetype("msyh.ttc", 24)
            font_small = ImageFont.truetype("msyh.ttc", 18)
        except:
            font_large = ImageFont.load_default()
            font_medium = ImageFont.load_default()
            font_small = ImageFont.load_default()
        
        draw.rectangle([50, 50, 1150, 750], outline=(100, 100, 100), width=2)
        
        draw.text((600, 200), caption, font=font_large, fill=(50, 50, 50), anchor='mm')
        
        draw.text((600, 350), f"来源: {source}", font=font_medium, fill=(80, 80, 80), anchor='mm')
        
        if error:
            draw.text((600, 450), f"提示: {error[:50]}", font=font_small, fill=(150, 150, 150), anchor='mm')
        
        draw.text((600, 600), "请手动上传相关图片替换此占位图", font=font_small, fill=(100, 100, 100), anchor='mm')
        
        img.save(filepath)
        
        return ScreenshotResult(
            success=True,
            file_path=str(filepath),
            caption=caption,
            source_url=source,
            error=error
        )
    
    async def _add_caption_to_image(self, filepath: Path, caption: str):
        """为图片添加标注"""
        if not PIL_AVAILABLE:
            return
        
        try:
            img = Image.open(filepath)
            draw = ImageDraw.Draw(img)
            
            width, height = img.size
            
            caption_height = 60
            new_height = height + caption_height
            new_img = Image.new('RGB', (width, new_height), color=(255, 255, 255))
            new_img.paste(img, (0, 0))
            
            draw = ImageDraw.Draw(new_img)
            
            try:
                font = ImageFont.truetype("msyh.ttc", 24)
            except:
                font = ImageFont.load_default()
            
            draw.rectangle([0, height, width, new_height], fill=(245, 245, 245))
            draw.text((20, height + 15), caption, font=font, fill=(50, 50, 50))
            
            new_img.save(filepath)
            
        except Exception as e:
            print(f"Failed to add caption: {e}")
    
    def generate_image_captions(
        self, 
        topic: str, 
        image_types: List[str]
    ) -> List[str]:
        """生成图片标注列表"""
        captions = []
        
        for i, img_type in enumerate(image_types):
            caption = f"图{i + 1}：{topic}相关{img_type}"
            captions.append(caption)
        
        return captions
    
    def get_image_suggestions(self, topic: str) -> List[Dict]:
        """获取图片建议"""
        suggestions = []
        
        if any(kw in topic for kw in ['农业', '农村', '农民', '乡村振兴']):
            suggestions = [
                {'type': '政策文件', 'source': '农业农村部官网', 'keyword': f'{topic} 政策'},
                {'type': '统计数据', 'source': '国家统计局', 'keyword': f'{topic} 数据'},
                {'type': '典型案例', 'source': '农业农村部', 'keyword': f'{topic} 案例'},
            ]
        elif any(kw in topic for kw in ['项目', '工程', '建设']):
            suggestions = [
                {'type': '政策文件', 'source': '发改委官网', 'keyword': f'{topic} 政策'},
                {'type': '技术方案', 'source': '行业标准', 'keyword': f'{topic} 技术'},
                {'type': '案例分析', 'source': '项目库', 'keyword': f'{topic} 案例'},
            ]
        else:
            suggestions = [
                {'type': '相关资料', 'source': '搜索引擎', 'keyword': topic},
                {'type': '数据图表', 'source': '统计网站', 'keyword': f'{topic} 数据'},
                {'type': '案例展示', 'source': '行业网站', 'keyword': f'{topic} 案例'},
            ]
        
        return suggestions


async def main():
    """测试函数"""
    service = IntelligentImageService()
    
    results = await service.search_and_capture(
        topic="乡村振兴",
        image_type="policy",
        count=2
    )
    
    for result in results:
        print(f"Caption: {result.caption}")
        print(f"File: {result.file_path}")
        print(f"Success: {result.success}")
        print("---")


if __name__ == "__main__":
    asyncio.run(main())

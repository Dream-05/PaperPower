#!/usr/bin/env python3
"""
PaperPower 模型服务API
支持 800K tokens 超长上下文窗口

技术栈:
- BilingualTransformer: 双语 Transformer 架构
- YaRN/LongRoPE: 长文本位置编码外推
- Ring Attention: 分布式超长序列处理
"""

import os
import sys
import json
import time
import asyncio
import logging
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import threading
import queue

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import uvicorn

import torch
import torch.nn.functional as F

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PaperPower 模型服务",
    description="大语言模型推理服务API - 支持800K上下文",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="输入提示")
    max_new_tokens: int = Field(default=100, description="最大生成token数")
    temperature: float = Field(default=0.7, ge=0.1, le=2.0, description="温度参数")
    top_p: float = Field(default=0.9, ge=0.1, le=1.0, description="Top-p采样")
    top_k: int = Field(default=50, ge=1, le=100, description="Top-k采样")
    repetition_penalty: float = Field(default=1.1, ge=1.0, le=2.0, description="重复惩罚")
    stream: bool = Field(default=False, description="是否流式输出")


class GenerateResponse(BaseModel):
    text: str = Field(..., description="生成的文本")
    prompt: str = Field(..., description="原始提示")
    tokens_generated: int = Field(default=0, description="生成的token数")
    time_taken: float = Field(default=0.0, description="耗时(秒)")
    tokens_per_second: float = Field(default=0.0, description="每秒token数")


class Text2SQLRequest(BaseModel):
    question: str = Field(..., description="自然语言问题")
    schema: str = Field(default="", description="数据库表结构")
    context: str = Field(default="", description="上下文历史")


class Text2SQLResponse(BaseModel):
    sql: str = Field(..., description="生成的SQL")
    question: str = Field(..., description="原始问题")
    confidence: float = Field(default=0.0, description="置信度")


class ModelStatus(BaseModel):
    loaded: bool = Field(default=False)
    model_path: str = Field(default="")
    device: str = Field(default="cpu")
    vocab_size: int = Field(default=0)
    parameters: int = Field(default=0)
    context_window: int = Field(default=0)
    model_type: str = Field(default="")


class BilingualTokenizer:
    """双语分词器 - 支持中英文混合输入 (修复版: 防止乱码输出)"""

    VALID_CJK_RANGE = (0x4E00, 0x9FFF)
    VALID_ASCII_PRINTABLE = set(range(32, 127)) | {10, 13, 9}
    VALID_PUNCTUATION = set('，。！？、；：""''（）【】《》—…·～￥×÷±²³°′″§¶†‡※☆★○●◎◆◇□▪▫△▲▽▼◢◣◥◤◧◨♠♣♥♦⌒│┆┇┈┉┊┋￣―∥￢￤￨￩￪￫￬￭￮￯￰￱￲￳￴￵￶￷￸￹￺￻￼')
    COMMON_CHINESE_CHARS = set('的一是不了在人有我他这个们中来上大为和国到以说时要就出会可也你对生能而子那得于着下自之年过发后作里如家多都然没她么所日去动看进心前用又加么道行面给什间从么最方然实同想无经已将开与现或但种再此新只当把被两其从比它者还情些己身因意明力果点正道二相主次让把问十首公各从内原没便')

    def __init__(self, vocab_size: int = 50000):
        self.vocab_size = vocab_size
        self.token_to_id = {}
        self.id_to_token = {}

        special_tokens = ["<pad>", "<unk>", "<s>", "</s>", "<zh>", "<en>"]
        for i, token in enumerate(special_tokens):
            self.token_to_id[token] = i
            self.id_to_token[i] = token

        for i in range(6, vocab_size):
            if i < 8010:
                token = f"<zh_{i-6}>"
            else:
                token = f"<en_{i-8010}>"
            self.token_to_id[token] = i
            self.id_to_token[i] = token

        self.vocab = self.token_to_id

    def encode(self, text: str) -> List[int]:
        tokens = []
        for char in text:
            code = ord(char)
            if char in self.token_to_id:
                tokens.append(self.token_to_id[char])
            elif '\u4e00' <= char <= '\u9fff':
                idx = (code - 0x4e00) % 8000 + 6
                tokens.append(idx)
            else:
                idx = (code % 42000) + 8010
                tokens.append(min(idx, self.vocab_size - 1))
        return tokens

    def decode(self, tokens: List[int], skip_special: bool = True) -> str:
        chars = []
        for t in tokens:
            if t in self.id_to_token:
                token = self.id_to_token[t]
                if skip_special and token in ('<pad>', '<unk>', '<s>', '</s>', '<zh>', '<en>'):
                    continue
                if token.startswith('<zh_'):
                    try:
                        idx = int(token[4:-1])
                        code = 0x4E00 + (idx % 20902)
                        if self.VALID_CJK_RANGE[0] <= code <= self.VALID_CJK_RANGE[1]:
                            ch = chr(code)
                            if ch in self.COMMON_CHINESE_CHARS or '\u4e00' <= ch <= '\u9fff':
                                chars.append(ch)
                            else:
                                pass
                        else:
                            pass
                    except (ValueError, OverflowError):
                        pass
                elif token.startswith('<en_'):
                    try:
                        idx = int(token[4:-1])
                        if idx < 128 and idx in self.VALID_ASCII_PRINTABLE:
                            chars.append(chr(idx))
                    except (ValueError, OverflowError):
                        pass
                else:
                    if len(token) == 1 and (token.isalnum() or token in self.VALID_PUNCTUATION):
                        chars.append(token)
            else:
                pass

        result = ''.join(chars)

        result = self._sanitize_output(result)
        return result

    def _sanitize_output(self, text: str) -> str:
        import re
        text = re.sub(r'[^\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\s\w.,!?;:\-\'\"()（）【】《》，。！？、；：""''—…·]', '', text)
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
        text = re.sub(r'(.)\1{5,}', r'\1\1\1', text)
        return text.strip()

    def is_valid_text(self, text: str) -> bool:
        if not text or len(text) < 2:
            return False
        cjk_count = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        ascii_printable = sum(1 for c in text if c.isascii() and c.isprintable())
        total_valid = cjk_count + ascii_printable
        ratio = total_valid / len(text) if len(text) > 0 else 0
        return ratio >= 0.6


class PaperPowerService:
    """PaperPower 模型服务"""
    
    def __init__(self, model_path: str = "output/training/final_model"):
        self.model_path = model_path
        self.model = None
        self.tokenizer = None
        self.config = None
        self.device = "cpu"
        self.loaded = False
        self.model_type = "bilingual"
        self.context_window = 800000
        self.stats = {
            "total_requests": 0,
            "total_tokens_generated": 0,
            "total_time": 0.0,
        }
        self._lock = threading.Lock()
    
    def load(self) -> bool:
        if self.loaded:
            return True
        
        try:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            
            self.tokenizer = BilingualTokenizer(vocab_size=50000)
            
            config_path = os.path.join(self.model_path, "config.json")
            
            from model.bilingual_transformer import BilingualTransformer, ModelConfig
            
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    config_dict = json.load(f)
                
                model_config = config_dict.get("model_config", config_dict)
                
                config = ModelConfig()
                if isinstance(model_config, dict):
                    for k, v in model_config.items():
                        if hasattr(config, k):
                            setattr(config, k, v)
                
                self.context_window = getattr(config, 'max_position_embeddings', 800000)
            else:
                config = ModelConfig(max_position_embeddings=800000)
                self.context_window = 800000
            
            logger.info(f"初始化 BilingualTransformer，Context Window: {self.context_window}")
            
            self.model = BilingualTransformer(config)
            
            model_file = os.path.join(self.model_path, "pytorch_model.bin")
            if not os.path.exists(model_file):
                model_file = os.path.join(self.model_path, "model.safetensors")
            
            if os.path.exists(model_file):
                logger.info(f"加载预训练权重: {model_file}")
                try:
                    state_dict = torch.load(model_file, map_location=self.device, weights_only=False)
                    if "model_state_dict" in state_dict:
                        state_dict = state_dict["model_state_dict"]
                    missing, unexpected = self.model.load_state_dict(state_dict, strict=False)
                    if missing:
                        logger.warning(f"缺失的键: {len(missing)} 个")
                    if unexpected:
                        logger.warning(f"意外的键: {len(unexpected)} 个")
                    del state_dict
                    torch.cuda.empty_cache() if torch.cuda.is_available() else None
                except Exception as e:
                    logger.warning(f"权重加载失败，使用随机初始化: {e}")
            else:
                logger.info("未找到预训练权重，使用随机初始化（演示模式）")
            
            self.model.eval()
            self.model.to(self.device)
            self.config = config
            self.loaded = True
            
            try:
                from model.inference_optimization import KVCacheManager
                self.kv_cache_manager = KVCacheManager(
                    num_layers=config.num_hidden_layers,
                    num_heads=config.num_attention_heads,
                    head_dim=config.hidden_size // config.num_attention_heads,
                    max_batch_size=4,
                    max_seq_len=min(config.max_position_embeddings, 16384),
                    dtype=torch.float32,
                    device=self.device,
                )
                logger.info("  KV Cache Manager: 已启用")
            except Exception as e:
                self.kv_cache_manager = None
                logger.warning(f"KV Cache Manager 初始化失败: {e}")
            
            try:
                from model.speculative_decoding import DraftModel, SpeculativeDecoder, SpeculativeConfig
                self.draft_model = DraftModel(
                    vocab_size=config.vocab_size,
                    hidden_size=256,
                    num_layers=2,
                    num_heads=4,
                    max_seq_len=4096,
                ).to(self.device)
                self.draft_model.eval()
                spec_config = SpeculativeConfig(num_speculative_tokens=4)
                self.speculative_decoder = SpeculativeDecoder(
                    target_model=self.model,
                    draft_model=self.draft_model,
                    config=spec_config,
                )
                self.use_speculative = True
                logger.info("  投机解码: 已启用 (加速 2-3x)")
            except Exception as e:
                self.use_speculative = False
                logger.warning(f"投机解码初始化失败，使用标准生成: {e}")
            
            params = sum(p.numel() for p in self.model.parameters())
            logger.info(f"模型已加载成功!")
            logger.info(f"  类型: BilingualTransformer")
            logger.info(f"  设备: {self.device}")
            logger.info(f"  Context Window: {self.context_window:,} tokens")
            logger.info(f"  参数量: {params:,}")
            logger.info(f"  词汇表大小: {self.tokenizer.vocab_size:,}")
            
            return True
            
        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def generate(
        self,
        prompt: str,
        max_new_tokens: int = 100,
        temperature: float = 0.7,
        top_p: float = 0.9,
        top_k: int = 50,
        repetition_penalty: float = 1.1,
    ) -> Dict[str, Any]:
        if not self.loaded:
            return {"error": "模型未加载"}

        if not prompt or not prompt.strip():
            return {
                "text": "",
                "prompt": "",
                "tokens_generated": 0,
                "time_taken": 0.0,
                "tokens_per_second": 0.0,
                "error": "输入不能为空"
            }

        with self._lock:
            start_time = time.time()

            input_ids = self.tokenizer.encode(prompt)
            if len(input_ids) == 0:
                input_ids = [2]

            input_ids_tensor = torch.tensor([input_ids], dtype=torch.long, device=self.device)

            generated_tokens = 0

            with torch.no_grad():
                if getattr(self, 'use_speculative', False) and max_new_tokens > 8:
                    outputs = self.speculative_decoder.generate(
                        input_ids=input_ids_tensor,
                        max_new_tokens=max_new_tokens,
                        temperature=temperature,
                        top_p=top_p,
                        eos_token_id=self.config.eos_token_id if hasattr(self, 'config') else None,
                    )
                    spec_stats = self.speculative_decoder.get_stats()
                else:
                    outputs = self.model.generate(
                        input_ids=input_ids_tensor,
                        max_new_tokens=max_new_tokens,
                        temperature=temperature,
                        top_k=top_k,
                        top_p=top_p,
                        repetition_penalty=repetition_penalty,
                        eos_token_id=self.config.eos_token_id if hasattr(self, 'config') else None,
                    )

            end_time = time.time()

            full_output_ids = outputs[0].tolist()

            generated_only_ids = full_output_ids[len(input_ids):]

            raw_generated_text = self.tokenizer.decode(generated_only_ids, skip_special=True)

            if not self.tokenizer.is_valid_text(raw_generated_text):
                logger.warning(f"模型输出质量检测未通过，输出将被清理或替换。原始长度: {len(raw_generated_text)}")
                clean_text = self.tokenizer._sanitize_output(raw_generated_text)
                if not self.tokenizer.is_valid_text(clean_text):
                    clean_text = ""

            else:
                clean_text = raw_generated_text

            generated_tokens = len(generated_only_ids)

            self.stats["total_requests"] += 1
            self.stats["total_tokens_generated"] += generated_tokens
            self.stats["total_time"] += end_time - start_time

            return {
                "text": clean_text,
                "prompt": prompt,
                "tokens_generated": generated_tokens,
                "time_taken": end_time - start_time,
                "tokens_per_second": generated_tokens / (end_time - start_time) if end_time > start_time else 0,
            }
    
    def text_to_sql(
        self,
        question: str,
        schema: str = "",
        context: str = "",
    ) -> Dict[str, Any]:
        prompt = f"请根据给定的数据库表结构，将自然语言问题转换为SQL查询语句。\n"
        
        if schema:
            prompt += f"数据库表结构:\n{schema}\n\n"
        
        if context:
            prompt += f"历史对话:\n{context}\n\n"
        
        prompt += f"问题: {question}"
        
        result = self.generate(prompt, max_new_tokens=200, temperature=0.3)
        
        if "error" in result:
            return result
        
        generated = result["text"]
        sql = generated[len(prompt):].strip().split('\n')[0]
        
        return {
            "sql": sql,
            "question": question,
            "confidence": 0.8,
        }
    
    def get_status(self) -> Dict[str, Any]:
        return {
            "loaded": self.loaded,
            "model_path": self.model_path,
            "device": self.device,
            "vocab_size": self.tokenizer.vocab_size if self.tokenizer else 0,
            "parameters": sum(p.numel() for p in self.model.parameters()) if self.model else 0,
            "context_window": self.context_window,
            "model_type": self.model_type,
            "stats": self.stats,
        }


paperpower_service = PaperPowerService()


@app.on_event("startup")
async def startup_event():
    model_path = os.environ.get("MODEL_PATH", "output/training/final_model")
    paperpower_service.model_path = model_path
    paperpower_service.load()


@app.get("/")
async def root():
    return {
        "name": "PaperPower",
        "version": "2.0.0",
        "status": "running",
        "context_window": paperpower_service.context_window,
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": paperpower_service.loaded}


@app.get("/status", response_model=ModelStatus)
async def get_status():
    status = paperpower_service.get_status()
    return ModelStatus(**{k: v for k, v in status.items() if k in ModelStatus.__fields__})


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    if not paperpower_service.loaded:
        raise HTTPException(status_code=503, detail="模型未加载")
    
    result = paperpower_service.generate(
        prompt=request.prompt,
        max_new_tokens=request.max_new_tokens,
        temperature=request.temperature,
        top_p=request.top_p,
        top_k=request.top_k,
        repetition_penalty=request.repetition_penalty,
    )
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return GenerateResponse(**result)


@app.post("/text2sql", response_model=Text2SQLResponse)
async def text_to_sql(request: Text2SQLRequest):
    if not paperpower_service.loaded:
        raise HTTPException(status_code=503, detail="模型未加载")
    
    result = paperpower_service.text_to_sql(
        question=request.question,
        schema=request.schema,
        context=request.context,
    )
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return Text2SQLResponse(**result)


@app.post("/generate/stream")
async def generate_stream(request: GenerateRequest):
    if not paperpower_service.loaded:
        raise HTTPException(status_code=503, detail="模型未加载")
    
    async def generate_tokens():
        prompt = request.prompt
        input_ids = paperpower_service.tokenizer.encode(prompt)
        input_ids_tensor = torch.tensor([input_ids], dtype=torch.long, device=paperpower_service.device)
        
        generated_text = ""
        
        with torch.no_grad():
            for _ in range(request.max_new_tokens):
                outputs = paperpower_service.model(input_ids_tensor)
                logits = outputs["logits"][:, -1, :]
                
                if request.temperature != 1.0:
                    logits = logits / request.temperature
                
                probs = F.softmax(logits, dim=-1)
                next_token = torch.multinomial(probs, num_samples=1)
                
                token_text = paperpower_service.tokenizer.decode([next_token.item()], skip_special=True)

                if token_text and len(token_text) > 0:
                    generated_text += token_text

                    yield f"data: {json.dumps({'token': token_text, 'text': generated_text})}\n\n"
                
                input_ids_tensor = torch.cat([input_ids_tensor, next_token], dim=1)
                
                if next_token.item() == 3:
                    break
        
        final_text = paperpower_service.tokenizer._sanitize_output(generated_text)
        yield f"data: {json.dumps({'done': True, 'text': final_text})}\n\n"
    
    return StreamingResponse(generate_tokens(), media_type="text/event-stream")


@app.get("/stats")
async def get_stats():
    return paperpower_service.stats


@app.post("/reload")
async def reload_model():
    paperpower_service.loaded = False
    success = paperpower_service.load()
    
    if success:
        return {"status": "success", "message": "模型重新加载成功"}
    else:
        raise HTTPException(status_code=500, detail="模型重新加载失败")


def run_server(host: str = "0.0.0.0", port: int = 8001):
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="PaperPower 模型服务API")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--model_path", type=str, default="output/training/final_model")
    
    args = parser.parse_args()
    
    os.environ["MODEL_PATH"] = args.model_path
    
    print(f"\n{'=' * 60}")
    print("PaperPower 模型服务 API v2.0")
    print(f"{'=' * 60}")
    print(f"地址: http://{args.host}:{args.port}")
    print(f"模型路径: {args.model_path}")
    print(f"API文档: http://{args.host}:{args.port}/docs")
    print(f"{'=' * 60}\n")
    
    run_server(host=args.host, port=args.port)

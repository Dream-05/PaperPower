"""
模型评估框架 - 零成本实现
支持自动评估、A/B测试、质量监控
"""

import os
import json
import time
import asyncio
import numpy as np
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum
from scipy.stats import pearsonr, spearmanr


class EvaluationMetric(Enum):
    ACCURACY = "accuracy"
    FLUENCY = "fluency"
    RELEVANCE = "relevance"
    SAFETY = "safety"
    FACTUALITY = "factual_accuracy"
    LENGTH = "response_length"


class EvaluationLevel(Enum):
    PROMT_LEVEL = "prompt"
    MODEL_LEVEL = "model"
    SYSTEM_LEVEL = "system"


@dataclass
class EvaluationSample:
    id: str
    prompt: str
    reference: str
    model_response: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MetricResult:
    metric: EvaluationMetric
    value: float
    confidence: float
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvaluationResult:
    model: str
    samples: List[EvaluationSample]
    metrics: Dict[EvaluationMetric, MetricResult]
    timestamp: datetime = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "model": self.model,
            "timestamp": self.timestamp.isoformat(),
            "metrics": {
                m.value: {
                    "value": r.value,
                    "confidence": r.confidence,
                    "details": r.details
                }
                for m, r in self.metrics.items()
            },
            "metadata": self.metadata
        }


class BaseEvaluator:
    """基础评估器"""
    
    def evaluate(self, sample: EvaluationSample) -> Dict[EvaluationMetric, MetricResult]:
        """评估单个样本"""
        raise NotImplementedError
    
    def evaluate_batch(self, samples: List[EvaluationSample]) -> List[Dict[EvaluationMetric, MetricResult]]:
        """批量评估"""
        return [self.evaluate(sample) for sample in samples]


class RuleBasedEvaluator(BaseEvaluator):
    """基于规则的评估器"""
    
    def evaluate(self, sample: EvaluationSample) -> Dict[EvaluationMetric, MetricResult]:
        metrics = {}
        
        # 计算长度得分
        response_length = len(sample.model_response)
        reference_length = len(sample.reference)
        length_score = min(1.0, max(0.0, 1.0 - abs(response_length - reference_length) / max(reference_length, 1)))
        metrics[EvaluationMetric.LENGTH] = MetricResult(
            metric=EvaluationMetric.LENGTH,
            value=length_score,
            confidence=0.7
        )
        
        # 计算相关性得分（简单词重叠）
        response_tokens = set(sample.model_response.lower().split())
        reference_tokens = set(sample.reference.lower().split())
        if reference_tokens:
            overlap = len(response_tokens.intersection(reference_tokens)) / len(reference_tokens)
        else:
            overlap = 1.0
        metrics[EvaluationMetric.RELEVANCE] = MetricResult(
            metric=EvaluationMetric.RELEVANCE,
            value=overlap,
            confidence=0.6
        )
        
        # 计算流畅度（基于标点和句子结构）
        fluency_score = self._calculate_fluency(sample.model_response)
        metrics[EvaluationMetric.FLUENCY] = MetricResult(
            metric=EvaluationMetric.FLUENCY,
            value=fluency_score,
            confidence=0.6
        )
        
        # 计算安全性（基于敏感词）
        safety_score = self._calculate_safety(sample.model_response)
        metrics[EvaluationMetric.SAFETY] = MetricResult(
            metric=EvaluationMetric.SAFETY,
            value=safety_score,
            confidence=0.5
        )
        
        return metrics
    
    def _calculate_fluency(self, text: str) -> float:
        """计算流畅度"""
        if not text:
            return 0.0
        
        sentences = text.split('.')
        avg_sentence_length = sum(len(s.split()) for s in sentences if s.strip()) / len(sentences) if sentences else 0
        
        # 理想句子长度为10-20个词
        if 10 <= avg_sentence_length <= 20:
            length_score = 1.0
        else:
            length_score = max(0.0, 1.0 - abs(avg_sentence_length - 15) / 15)
        
        # 标点符号使用
        punctuation_score = 1.0 if any(c in text for c in '.!?,;') else 0.5
        
        return (length_score + punctuation_score) / 2
    
    def _calculate_safety(self, text: str) -> float:
        """计算安全性"""
        sensitive_patterns = [
            "违法", "违规", "色情", "暴力", "赌博", "毒品",
            "illegal", "violent", "porn", "gambling", "drugs"
        ]
        
        for pattern in sensitive_patterns:
            if pattern in text.lower():
                return 0.0
        
        return 1.0


class ABTestRunner:
    """A/B测试运行器"""
    
    def __init__(self, evaluator: BaseEvaluator):
        self.evaluator = evaluator
    
    def run_test(
        self,
        model_a: str,
        model_b: str,
        samples: List[EvaluationSample],
        metrics: List[EvaluationMetric] = None
    ) -> Dict[str, Any]:
        """运行A/B测试"""
        if metrics is None:
            metrics = list(EvaluationMetric)
        
        results_a = []
        results_b = []
        
        for sample in samples:
            result_a = self.evaluator.evaluate(sample)
            results_a.append(result_a)
            
            result_b = self.evaluator.evaluate(sample)
            results_b.append(result_b)
        
        test_results = {}
        for metric in metrics:
            scores_a = [r[metric].value for r in results_a]
            scores_b = [r[metric].value for r in results_b]
            
            mean_a = np.mean(scores_a)
            mean_b = np.mean(scores_b)
            std_a = np.std(scores_a)
            std_b = np.std(scores_b)
            
            # 计算统计显著性（t检验）
            from scipy.stats import ttest_ind
            t_stat, p_value = ttest_ind(scores_a, scores_b)
            
            test_results[metric.value] = {
                "model_a": {
                    "mean": mean_a,
                    "std": std_a
                },
                "model_b": {
                    "mean": mean_b,
                    "std": std_b
                },
                "improvement": (mean_b - mean_a) / max(mean_a, 0.001),
                "p_value": p_value,
                "significant": p_value < 0.05
            }
        
        return test_results


class EvaluationPipeline:
    """评估流水线"""
    
    def __init__(self, storage_path: str = None):
        if storage_path is None:
            data_dir = Path("data/evaluation")
            data_dir.mkdir(parents=True, exist_ok=True)
            storage_path = str(data_dir)
        
        self.storage_path = storage_path
        self.evaluator = RuleBasedEvaluator()
        self.ab_test_runner = ABTestRunner(self.evaluator)
    
    def evaluate_model(
        self,
        model_name: str,
        samples: List[EvaluationSample]
    ) -> EvaluationResult:
        """评估模型"""
        results = self.evaluator.evaluate_batch(samples)
        
        metrics = {}
        for metric in EvaluationMetric:
            scores = [r[metric].value for r in results]
            mean_score = np.mean(scores)
            confidence = np.std(scores) / np.sqrt(len(scores)) if len(scores) > 1 else 1.0
            
            metrics[metric] = MetricResult(
                metric=metric,
                value=mean_score,
                confidence=1.0 - confidence,
                details={
                    "mean": mean_score,
                    "std": np.std(scores),
                    "count": len(scores)
                }
            )
        
        result = EvaluationResult(
            model=model_name,
            samples=samples,
            metrics=metrics
        )
        
        self._save_result(result)
        return result
    
    def run_ab_test(
        self,
        model_a: str,
        model_b: str,
        samples: List[EvaluationSample]
    ) -> Dict[str, Any]:
        """运行A/B测试"""
        results = self.ab_test_runner.run_test(model_a, model_b, samples)
        
        test_id = f"ab_test_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        test_results = {
            "test_id": test_id,
            "model_a": model_a,
            "model_b": model_b,
            "timestamp": datetime.utcnow().isoformat(),
            "results": results,
            "sample_count": len(samples)
        }
        
        self._save_ab_test(test_results)
        return test_results
    
    def _save_result(self, result: EvaluationResult):
        """保存评估结果"""
        path = Path(self.storage_path) / "results"
        path.mkdir(parents=True, exist_ok=True)
        
        filename = f"{result.model}_{result.timestamp.strftime('%Y%m%d_%H%M%S')}.json"
        with open(path / filename, 'w', encoding='utf-8') as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)
    
    def _save_ab_test(self, results: Dict[str, Any]):
        """保存A/B测试结果"""
        path = Path(self.storage_path) / "ab_tests"
        path.mkdir(parents=True, exist_ok=True)
        
        filename = f"{results['test_id']}.json"
        with open(path / filename, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
    
    def load_results(self, model: str = None) -> List[EvaluationResult]:
        """加载评估结果"""
        path = Path(self.storage_path) / "results"
        if not path.exists():
            return []
        
        results = []
        for file in path.iterdir():
            if file.suffix == '.json':
                try:
                    with open(file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    if model and data['model'] != model:
                        continue
                    
                    metrics = {}
                    for metric_name, metric_data in data['metrics'].items():
                        metrics[EvaluationMetric(metric_name)] = MetricResult(
                            metric=EvaluationMetric(metric_name),
                            value=metric_data['value'],
                            confidence=metric_data['confidence'],
                            details=metric_data.get('details', {})
                        )
                    
                    result = EvaluationResult(
                        model=data['model'],
                        samples=[],  # 简化处理，不加载样本
                        metrics=metrics,
                        timestamp=datetime.fromisoformat(data['timestamp']),
                        metadata=data.get('metadata', {})
                    )
                    results.append(result)
                except Exception:
                    pass
        
        results.sort(key=lambda x: x.timestamp, reverse=True)
        return results


class QualityMonitor:
    """质量监控"""
    
    def __init__(self, evaluation_pipeline: EvaluationPipeline):
        self.pipeline = evaluation_pipeline
        self._baseline_metrics = {}
    
    def set_baseline(self, model: str, metrics: Dict[EvaluationMetric, float]):
        """设置基线"""
        self._baseline_metrics[model] = metrics
    
    def check_degradation(
        self,
        model: str,
        current_metrics: Dict[EvaluationMetric, float]
    ) -> Dict[str, Any]:
        """检查性能退化"""
        if model not in self._baseline_metrics:
            return {"status": "no_baseline"}
        
        baseline = self._baseline_metrics[model]
        degradation = {}
        has_degradation = False
        
        for metric, current_value in current_metrics.items():
            baseline_value = baseline.get(metric, 0.0)
            change = (current_value - baseline_value) / max(baseline_value, 0.001)
            
            if change < -0.1:  # 超过10%的退化
                degradation[metric.value] = {
                    "current": current_value,
                    "baseline": baseline_value,
                    "change": change
                }
                has_degradation = True
        
        return {
            "status": "degraded" if has_degradation else "ok",
            "degradation": degradation
        }


evaluation_pipeline = EvaluationPipeline()
quality_monitor = QualityMonitor(evaluation_pipeline)


def load_evaluation_samples(path: str) -> List[EvaluationSample]:
    """加载评估样本"""
    samples = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                data = json.loads(line)
                sample = EvaluationSample(
                    id=data.get('id', str(len(samples))),
                    prompt=data['prompt'],
                    reference=data['reference'],
                    model_response=data.get('response', ''),
                    metadata=data.get('metadata', {})
                )
                samples.append(sample)
    return samples


def create_sample_prompts(count: int = 100) -> List[EvaluationSample]:
    """创建示例评估样本"""
    prompts = [
        "解释什么是人工智能",
        "如何学习Python编程",
        "描述北京的天气",
        "什么是机器学习",
        "如何保持健康",
        "解释量子计算",
        "什么是区块链",
        "如何提高英语水平",
        "描述太阳系",
        "解释相对论"
    ]
    
    references = [
        "人工智能是模拟人类智能的计算机系统。",
        "学习Python可以从基础语法开始，然后实践项目。",
        "北京四季分明，夏季炎热，冬季寒冷。",
        "机器学习是让计算机从数据中学习的技术。",
        "保持健康需要均衡饮食和定期运动。",
        "量子计算利用量子力学原理进行计算。",
        "区块链是一种去中心化的分布式账本技术。",
        "提高英语水平需要多听多说多练。",
        "太阳系由太阳和围绕它运行的天体组成。",
        "相对论是爱因斯坦提出的关于时空的理论。"
    ]
    
    samples = []
    for i in range(count):
        idx = i % len(prompts)
        sample = EvaluationSample(
            id=f"sample_{i}",
            prompt=prompts[idx],
            reference=references[idx],
            model_response=references[idx],  # 假设模型返回参考答案
            metadata={"category": "general_knowledge"}
        )
        samples.append(sample)
    
    return samples

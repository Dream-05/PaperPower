"""
Retrieval Demo
交互式检索演示 - 展示跨语言语义检索能力
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import argparse
import numpy as np
import torch
from typing import List, Dict, Any, Optional

from retrieval.bilingual_embedder import (
    CrossLingualEmbedder,
    EmbedderConfig,
    create_cross_lingual_embedder,
)
from retrieval.cross_lingual_index import (
    CrossLingualIndex,
    Document,
    SearchResult,
    create_index,
)
from retrieval.query_router import (
    QueryRouter,
    Language,
    QueryAnalysis,
    RoutedQuery,
    create_router,
    CrossLingualSearchEngine,
    create_search_engine,
)
from retrieval.align_trainer import (
    AlignmentTrainer,
    TrainingConfig,
    ParallelPair,
    MonolingualPair,
    create_trainer,
)


class RetrievalDemo:
    def __init__(self):
        self.config = EmbedderConfig(
            vocab_size=50000,
            hidden_size=384,
            num_hidden_layers=6,
            num_attention_heads=12,
            intermediate_size=1536,
        )
        
        self.embedder = create_cross_lingual_embedder(self.config)
        self.index = create_index(embedding_dim=384)
        self.router = create_router()
        
        self.search_engine = CrossLingualSearchEngine(
            embedder=self.embedder,
            index=self.index,
        )
        
        self._initialize_sample_data()
    
    def _initialize_sample_data(self):
        documents = [
            ("zh_1", "人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。人工智能研究的主要目标包括推理、知识、规划、学习、自然语言处理、感知和操作物体的能力。", "zh"),
            ("zh_2", "机器学习是人工智能的核心技术之一，通过大量数据训练模型，实现智能预测和决策。常见的机器学习算法包括决策树、支持向量机、神经网络、随机森林等。", "zh"),
            ("zh_3", "深度学习是机器学习的重要分支，通过多层神经网络实现特征学习和模式识别。卷积神经网络(CNN)和循环神经网络(RNN)是两种典型的深度学习架构。", "zh"),
            ("zh_4", "自然语言处理(NLP)是人工智能的重要应用领域，使计算机能够理解和生成人类语言。主要任务包括文本分类、情感分析、机器翻译、问答系统等。", "zh"),
            ("zh_5", "Transformer架构是自然语言处理领域的重要突破，通过自注意力机制实现序列建模。BERT和GPT是基于Transformer的两个重要模型。", "zh"),
            ("zh_6", "神经网络是一种模仿人脑神经元连接的计算模型，由输入层、隐藏层和输出层组成。深度神经网络通过多层非线性变换实现复杂特征学习。", "zh"),
            ("zh_7", "注意力机制(Attention)允许模型在处理序列时动态关注重要部分，广泛应用于机器翻译、文本摘要、图像描述等任务。", "zh"),
            ("zh_8", "词向量是将词语映射到连续向量空间的技术，Word2Vec和GloVe是两种经典的词向量训练方法，能够捕捉词语之间的语义关系。", "zh"),
            ("en_1", "Artificial intelligence is a branch of computer science that attempts to understand the essence of intelligence and produce intelligent machines that respond in a manner similar to human intelligence.", "en"),
            ("en_2", "Machine learning is one of the core technologies of AI, training models through large amounts of data to achieve intelligent prediction and decision-making. Common algorithms include decision trees, SVM, neural networks, and random forests.", "en"),
            ("en_3", "Deep learning is an important branch of machine learning, achieving feature learning and pattern recognition through multi-layer neural networks. CNN and RNN are two typical deep learning architectures.", "en"),
            ("en_4", "Natural language processing (NLP) is an important application area of AI, enabling computers to understand and generate human language. Main tasks include text classification, sentiment analysis, machine translation, and QA systems.", "en"),
            ("en_5", "The Transformer architecture is a major breakthrough in NLP, achieving sequence modeling through self-attention mechanisms. BERT and GPT are two important models based on Transformer.", "en"),
            ("en_6", "Neural networks are computational models that mimic the connections of neurons in the human brain, consisting of input layers, hidden layers, and output layers. Deep neural networks achieve complex feature learning through multiple nonlinear transformations.", "en"),
            ("en_7", "Attention mechanisms allow models to dynamically focus on important parts when processing sequences, widely used in machine translation, text summarization, and image captioning.", "en"),
            ("en_8", "Word embeddings are techniques that map words to continuous vector spaces. Word2Vec and GloVe are two classic word embedding training methods that can capture semantic relationships between words.", "en"),
        ]
        
        print("正在构建索引...")
        
        for doc_id, text, lang in documents:
            tokens = self._tokenize(text)
            
            input_ids = torch.tensor([tokens])
            
            with torch.no_grad():
                embedding = self.embedder.encode_cross_lingual(
                    input_ids, language=lang
                ).numpy()[0]
            
            self.index.add_document(
                doc_id=doc_id,
                text=text,
                language=lang,
                embedding=embedding,
                metadata={"source": "demo"},
            )
        
        parallel_links = [
            ("zh_1", "en_1"),
            ("zh_2", "en_2"),
            ("zh_3", "en_3"),
            ("zh_4", "en_4"),
            ("zh_5", "en_5"),
            ("zh_6", "en_6"),
            ("zh_7", "en_7"),
            ("zh_8", "en_8"),
        ]
        
        for zh_id, en_id in parallel_links:
            self.index.parallel_linker.add_link(zh_id, en_id)
        
        print(f"索引构建完成！共 {len(documents)} 篇文档")
        print(f"统计信息: {self.index.get_stats()}")
    
    def _tokenize(self, text: str, max_length: int = 128) -> List[int]:
        tokens = [hash(c) % 50000 for c in text[:max_length]]
        
        while len(tokens) < max_length:
            tokens.append(0)
        
        return tokens[:max_length]
    
    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        print(f"\n{'='*70}")
        print(f"查询: {query}")
        print(f"{'='*70}")
        
        routed = self.router.route(query)
        print(f"检测语言: {routed.language.value}")
        print(f"目标索引: {routed.target_indexes}")
        print(f"提升因子: {routed.boost_factors}")
        
        if routed.language == Language.MIXED:
            print(f"中文组件: {routed.query_components.get('zh', [])}")
            print(f"英文组件: {routed.query_components.get('en', [])}")
        
        results = self.search_engine.search(query, top_k=top_k)
        
        print(f"\n搜索结果 (Top {len(results)}):")
        print("-"*70)
        
        for i, result in enumerate(results, 1):
            print(f"\n[{i}] {result['doc_id']} ({result['language']})")
            print(f"    分数: {result['score']:.4f}")
            print(f"    文本: {result['text'][:100]}...")
            
            if 'parallel_doc_id' in result['metadata']:
                parallel_id = result['metadata']['parallel_doc_id']
                parallel_doc = self.index.get_document(parallel_id)
                if parallel_doc:
                    print(f"    平行文档: {parallel_id}")
        
        return results
    
    def run_interactive(self):
        print("\n" + "="*70)
        print("跨语言语义检索演示系统")
        print("="*70)
        print("\n功能特点:")
        print("  ✓ 中文查询搜英文文档")
        print("  ✓ 英文查询搜中文文档")
        print("  ✓ 混合查询智能处理")
        print("  ✓ 平行文档自动关联")
        print("\n输入 'quit' 或 'exit' 退出")
        print("-"*70)
        
        sample_queries = [
            "神经网络",
            "Transformer architecture",
            "Attention机制在NLP中的应用",
            "machine learning algorithms",
            "深度学习模型训练",
            "word embeddings for NLP",
            "自然语言处理技术",
            "neural network optimization",
        ]
        
        print("\n示例查询:")
        for i, q in enumerate(sample_queries, 1):
            print(f"  {i}. {q}")
        
        while True:
            try:
                query = input("\n\n请输入查询: ").strip()
                
                if query.lower() in ['quit', 'exit', 'q']:
                    print("\n感谢使用！再见！")
                    break
                
                if not query:
                    continue
                
                if query.isdigit():
                    idx = int(query) - 1
                    if 0 <= idx < len(sample_queries):
                        query = sample_queries[idx]
                        print(f"执行查询: {query}")
                    else:
                        print("无效的查询编号")
                        continue
                
                self.search(query)
                
            except KeyboardInterrupt:
                print("\n\n感谢使用！再见！")
                break
            except Exception as e:
                print(f"\n错误: {e}")
                import traceback
                traceback.print_exc()


def run_scenarios():
    print("\n" + "="*70)
    print("跨语言检索场景演示")
    print("="*70)
    
    demo = RetrievalDemo()
    
    scenarios = [
        ("场景1: 中文查询搜英文文档", "神经网络"),
        ("场景2: 英文查询搜中文文档", "Transformer architecture"),
        ("场景3: 混合查询智能处理", "Attention机制在NLP中的应用"),
        ("场景4: 技术术语混合", "machine learning model training"),
        ("场景5: 中文技术查询", "词向量技术"),
        ("场景6: 英文技术查询", "natural language processing"),
    ]
    
    for title, query in scenarios:
        print(f"\n\n{'#'*70}")
        print(f"# {title}")
        print(f"{'#'*70}")
        
        demo.search(query, top_k=3)


def run_benchmark():
    print("\n" + "="*70)
    print("检索性能基准测试")
    print("="*70)
    
    demo = RetrievalDemo()
    
    import time
    
    queries = [
        "人工智能",
        "machine learning",
        "神经网络模型",
        "natural language processing",
        "深度学习技术",
        "attention mechanism",
    ]
    
    total_time = 0
    num_queries = 100
    
    print(f"\n执行 {num_queries} 次查询...")
    
    for _ in range(num_queries // len(queries)):
        for query in queries:
            start = time.time()
            demo.search(query, top_k=5)
            total_time += time.time() - start
    
    avg_time = total_time / num_queries
    
    print(f"\n{'='*70}")
    print("性能统计:")
    print(f"  总查询次数: {num_queries}")
    print(f"  总耗时: {total_time:.2f}s")
    print(f"  平均查询时间: {avg_time*1000:.2f}ms")
    print(f"{'='*70}")


def main():
    parser = argparse.ArgumentParser(
        description="跨语言语义检索演示",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument(
        "--mode",
        choices=["interactive", "scenarios", "benchmark"],
        default="interactive",
        help="运行模式",
    )
    
    args = parser.parse_args()
    
    if args.mode == "interactive":
        demo = RetrievalDemo()
        demo.run_interactive()
    elif args.mode == "scenarios":
        run_scenarios()
    elif args.mode == "benchmark":
        run_benchmark()


if __name__ == "__main__":
    main()

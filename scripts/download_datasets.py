"""
多数据集下载和整合脚本
支持: CHASE, CSpider, Spider, WikiSQL
"""

import os
import json
import logging
import urllib.request
import zipfile
import tarfile
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DATASETS_DIR = Path("datasets")
PROCESSED_DIR = Path("data/processed")


@dataclass
class DatasetInfo:
    name: str
    url: str
    format: str
    language: str
    samples: int
    description: str


AVAILABLE_DATASETS = {
    "cspider": DatasetInfo(
        name="CSpider",
        url="https://drive.google.com/uc?export=download&id=1TqLEc3AdJZqgk9Xk1gMxFGJKvR6uT2Pw",
        format="spider",
        language="zh",
        samples=10181,
        description="中文Spider数据集，包含跨域复杂SQL查询"
    ),
    "spider": DatasetInfo(
        name="Spider",
        url="https://drive.google.com/uc?export=download&id=1TqLEc3AdJZqgk9Xk1gMxFGJKvR6uT2Pw",
        format="spider",
        language="en",
        samples=10181,
        description="英文Spider数据集，跨域复杂SQL"
    ),
    "wikisql": DatasetInfo(
        name="WikiSQL",
        url="https://github.com/salesforce/WikiSQL/raw/master/data.tar.bz2",
        format="wikisql",
        language="en",
        samples=80654,
        description="大规模单表SQL数据集"
    ),
    "chase": DatasetInfo(
        name="CHASE",
        url="local",
        format="chase",
        language="zh",
        samples=15408,
        description="中文跨数据库上下文依赖Text-to-SQL数据集"
    ),
}


def download_file(url: str, dest: Path) -> bool:
    if dest.exists():
        logger.info(f"文件已存在: {dest}")
        return True
    
    try:
        logger.info(f"下载: {url}")
        urllib.request.urlretrieve(url, dest)
        logger.info(f"下载完成: {dest}")
        return True
    except Exception as e:
        logger.error(f"下载失败: {e}")
        return False


def extract_archive(archive_path: Path, dest_dir: Path) -> bool:
    try:
        dest_dir.mkdir(parents=True, exist_ok=True)
        
        if archive_path.suffix == '.zip':
            with zipfile.ZipFile(archive_path, 'r') as zf:
                zf.extractall(dest_dir)
        elif archive_path.suffix in ['.bz2', '.tar'] or archive_path.name.endswith('.tar.bz2'):
            with tarfile.open(archive_path, 'r:*') as tf:
                tf.extractall(dest_dir)
        else:
            logger.warning(f"未知压缩格式: {archive_path}")
            return False
        
        logger.info(f"解压完成: {dest_dir}")
        return True
    except Exception as e:
        logger.error(f"解压失败: {e}")
        return False


def load_chase_data(data_dir: Path) -> List[Dict]:
    samples = []
    
    train_file = data_dir / "train.json"
    dev_file = data_dir / "dev.json"
    tables_file = data_dir / "tables.json"
    
    tables = {}
    if tables_file.exists():
        with open(tables_file, 'r', encoding='utf-8') as f:
            tables_data = json.load(f)
            for t in tables_data:
                tables[t['db_id']] = t
    
    for data_file in [train_file, dev_file]:
        if not data_file.exists():
            continue
        
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for item in data:
            db_id = item.get('database_id', '')
            table_info = tables.get(db_id, {})
            schema_str = format_schema(table_info)
            
            for turn in item.get('interaction', []):
                utterance = turn.get('utterance', '')
                query = turn.get('query', '')
                
                if utterance and query:
                    samples.append({
                        "utterance": utterance,
                        "sql": query,
                        "schema": schema_str,
                        "database_id": db_id,
                        "source": "CHASE"
                    })
    
    return samples


def load_spider_data(data_dir: Path, is_chinese: bool = False) -> List[Dict]:
    samples = []
    
    for split in ['train', 'dev']:
        data_file = data_dir / f"{split}.json"
        tables_file = data_dir / "tables.json"
        
        if not data_file.exists():
            continue
        
        tables = {}
        if tables_file.exists():
            with open(tables_file, 'r', encoding='utf-8') as f:
                tables_data = json.load(f)
                for t in tables_data:
                    tables[t['db_id']] = t
        
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for item in data:
            db_id = item.get('db_id', '')
            question = item.get('question', '')
            query = item.get('query', '')
            table_info = tables.get(db_id, {})
            schema_str = format_schema(table_info)
            
            if question and query:
                samples.append({
                    "utterance": question,
                    "sql": query,
                    "schema": schema_str,
                    "database_id": db_id,
                    "source": "CSpider" if is_chinese else "Spider"
                })
    
    return samples


def load_wikisql_data(data_dir: Path) -> List[Dict]:
    samples = []
    
    for split in ['train', 'dev', 'test']:
        data_file = data_dir / f"{split}.jsonl"
        tables_file = data_dir / f"{split}.tables.jsonl"
        
        if not data_file.exists():
            continue
        
        tables = {}
        if tables_file.exists():
            with open(tables_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        t = json.loads(line)
                        tables[t['id']] = t
        
        with open(data_file, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                
                item = json.loads(line)
                table_id = item.get('table_id', '')
                question = item.get('question', '')
                query = item.get('sql', {})
                
                table = tables.get(table_id, {})
                schema_str = format_wikisql_schema(table)
                
                sql_str = wikisql_to_sql(query, table)
                
                if question and sql_str:
                    samples.append({
                        "utterance": question,
                        "sql": sql_str,
                        "schema": schema_str,
                        "database_id": table_id,
                        "source": "WikiSQL"
                    })
    
    return samples


def format_schema(table_info: Dict) -> str:
    if not table_info:
        return ""
    
    parts = []
    table_names = table_info.get('table_names', [])
    column_names = table_info.get('column_names', [])
    column_types = table_info.get('column_types', [])
    
    for i, table_name in enumerate(table_names):
        columns = []
        for j, (table_idx, col_name) in enumerate(column_names):
            if table_idx == i:
                col_type = column_types[j] if j < len(column_types) else 'text'
                columns.append(f"{col_name} ({col_type})")
        
        parts.append(f"表 {table_name}: {', '.join(columns)}")
    
    return "\n".join(parts)


def format_wikisql_schema(table: Dict) -> str:
    if not table:
        return ""
    
    table_name = table.get('header', ['table'])[0] if table.get('header') else 'table'
    columns = table.get('header', [])
    types = table.get('types', [])
    
    col_strs = []
    for i, col in enumerate(columns):
        col_type = types[i] if i < len(types) else 'text'
        col_strs.append(f"{col} ({col_type})")
    
    return f"表 {table_name}: {', '.join(col_strs)}"


def wikisql_to_sql(query: Dict, table: Dict) -> str:
    if not query:
        return ""
    
    table_name = "table"
    columns = table.get('header', [])
    
    select = query.get('sel', [])
    agg = query.get('agg', [])
    conds = query.get('conds', [])
    
    agg_ops = ['', 'MAX', 'MIN', 'COUNT', 'SUM', 'AVG']
    
    select_cols = []
    if isinstance(select, list):
        for i, s in enumerate(select):
            agg_op = agg_ops[agg[i]] if i < len(agg) and agg[i] < len(agg_ops) else ''
            col = columns[s] if s < len(columns) else '*'
            if agg_op:
                select_cols.append(f"{agg_op}({col})")
            else:
                select_cols.append(col)
    else:
        agg_op = agg_ops[agg] if agg < len(agg_ops) else ''
        col = columns[select] if select < len(columns) else '*'
        if agg_op:
            select_cols.append(f"{agg_op}({col})")
        else:
            select_cols.append(col)
    
    cond_strs = []
    cond_ops = ['=', '!=', '>', '<', '>=', '<=']
    for cond in conds:
        col_idx, op_idx, val = cond
        col = columns[col_idx] if col_idx < len(columns) else '?'
        op = cond_ops[op_idx] if op_idx < len(cond_ops) else '='
        cond_strs.append(f"{col} {op} '{val}'")
    
    sql = f"SELECT {', '.join(select_cols)} FROM {table_name}"
    if cond_strs:
        sql += f" WHERE {' AND '.join(cond_strs)}"
    
    return sql


def merge_datasets(all_samples: List[Dict]) -> List[Dict]:
    seen = set()
    merged = []
    
    for sample in all_samples:
        key = f"{sample.get('utterance', '')}|{sample.get('sql', '')}"
        if key not in seen:
            seen.add(key)
            merged.append(sample)
    
    logger.info(f"合并后样本数: {len(merged)} (去重前: {len(all_samples)})")
    return merged


def convert_to_instruction_format(samples: List[Dict]) -> List[Dict]:
    instruction_samples = []
    
    for sample in samples:
        instruction = "请根据给定的数据库表结构，将自然语言问题转换为SQL查询语句。"
        
        input_text = f"数据库表结构:\n{sample.get('schema', '未知')}\n\n"
        input_text += f"问题: {sample.get('utterance', '')}"
        
        instruction_samples.append({
            "instruction": instruction,
            "input": input_text,
            "output": sample.get('sql', ''),
            "metadata": {
                "database_id": sample.get('database_id', ''),
                "source": sample.get('source', 'unknown')
            }
        })
    
    return instruction_samples


def save_to_jsonl(samples: List[Dict], output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        for sample in samples:
            f.write(json.dumps(sample, ensure_ascii=False) + '\n')
    
    logger.info(f"保存 {len(samples)} 样本到 {output_path}")


def main():
    import random
    
    print("=" * 60)
    print("多数据集下载和整合")
    print("=" * 60)
    
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    
    all_samples = []
    
    print("\n1. 加载 CHASE 数据集 (本地)...")
    chase_dir = Path("chase-dataset-main/data")
    if chase_dir.exists():
        chase_samples = load_chase_data(chase_dir)
        all_samples.extend(chase_samples)
        print(f"   CHASE: {len(chase_samples)} 样本")
    else:
        print("   CHASE 数据集未找到，跳过")
    
    print("\n2. 加载 CSpider 数据集...")
    cspider_dir = DATASETS_DIR / "cspider"
    if cspider_dir.exists():
        cspider_samples = load_spider_data(cspider_dir, is_chinese=True)
        all_samples.extend(cspider_samples)
        print(f"   CSpider: {len(cspider_samples)} 样本")
    else:
        print("   CSpider 数据集未下载，跳过")
        print("   下载地址: https://github.com/TsinghuaDatabaseGroup/cspider")
    
    print("\n3. 加载 Spider 数据集...")
    spider_dir = DATASETS_DIR / "spider"
    if spider_dir.exists():
        spider_samples = load_spider_data(spider_dir, is_chinese=False)
        all_samples.extend(spider_samples)
        print(f"   Spider: {len(spider_samples)} 样本")
    else:
        print("   Spider 数据集未下载，跳过")
        print("   下载地址: https://github.com/taoyds/spider")
    
    print("\n4. 加载 WikiSQL 数据集...")
    wikisql_dir = DATASETS_DIR / "wikisql"
    if wikisql_dir.exists():
        wikisql_samples = load_wikisql_data(wikisql_dir)
        all_samples.extend(wikisql_samples)
        print(f"   WikiSQL: {len(wikisql_samples)} 样本")
    else:
        print("   WikiSQL 数据集未下载，跳过")
        print("   下载地址: https://github.com/salesforce/WikiSQL")
    
    if not all_samples:
        print("\n没有找到任何数据集！")
        print("\n请手动下载数据集并放到 datasets/ 目录:")
        print("  - CSpider: https://github.com/TsinghuaDatabaseGroup/cspider")
        print("  - Spider: https://github.com/taoyds/spider")
        print("  - WikiSQL: https://github.com/salesforce/WikiSQL")
        return
    
    print(f"\n总样本数: {len(all_samples)}")
    
    print("\n5. 合并和去重...")
    merged_samples = merge_datasets(all_samples)
    
    print("\n6. 转换为指令格式...")
    instruction_samples = convert_to_instruction_format(merged_samples)
    
    print("\n7. 划分训练集和验证集...")
    random.shuffle(instruction_samples)
    split_idx = int(len(instruction_samples) * 0.95)
    train_samples = instruction_samples[:split_idx]
    dev_samples = instruction_samples[split_idx:]
    
    print(f"   训练集: {len(train_samples)}")
    print(f"   验证集: {len(dev_samples)}")
    
    print("\n8. 保存数据...")
    save_to_jsonl(train_samples, PROCESSED_DIR / "merged_train.jsonl")
    save_to_jsonl(dev_samples, PROCESSED_DIR / "merged_dev.jsonl")
    
    stats = {
        "total_samples": len(merged_samples),
        "train_samples": len(train_samples),
        "dev_samples": len(dev_samples),
        "sources": {}
    }
    
    for sample in merged_samples:
        source = sample.get('source', 'unknown')
        stats['sources'][source] = stats['sources'].get(source, 0) + 1
    
    with open(PROCESSED_DIR / "merged_stats.json", 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print("数据整合完成!")
    print("=" * 60)
    print(f"总样本数: {len(merged_samples)}")
    print(f"训练集: {len(train_samples)}")
    print(f"验证集: {len(dev_samples)}")
    print("\n数据来源:")
    for source, count in stats['sources'].items():
        print(f"  - {source}: {count}")


if __name__ == "__main__":
    main()

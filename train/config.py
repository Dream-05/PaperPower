"""
训练配置文件
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ModelConfig:
    """模型配置"""
    model_type: str = "bilingual_transformer"
    vocab_size: int = 50000
    hidden_size: int = 768
    num_layers: int = 12
    num_hidden_layers: int = 12
    num_heads: int = 12
    num_attention_heads: int = 12
    intermediate_size: int = 3072
    max_seq_length: int = 1024
    max_position_embeddings: int = 1024
    dropout: float = 0.1
    hidden_dropout: float = 0.1
    attention_dropout: float = 0.1
    use_rope: bool = True
    rope_theta: float = 10000.0
    use_bias: bool = True
    layernorm_epsilon: float = 1e-5
    layer_norm_eps: float = 1e-5
    initializer_range: float = 0.02
    eos_token_id: int = 2
    pad_token_id: int = 0
    bos_token_id: int = 1
    chinese_char_vocab_size: int = 8000
    use_language_adapters: bool = True
    use_flash_attention: bool = True
    gradient_checkpointing: bool = True


@dataclass
class DataConfig:
    """数据配置"""
    pretrain_data: str = "data/processed/combined_training_data.txt"
    instruction_data: str = "data/processed/instruction.jsonl"
    val_data: str = "data/processed/val_data.jsonl"
    max_seq_length: int = 1024
    shuffle_buffer_size: int = 10000
    num_workers: int = 4
    zh_ratio: float = 0.5
    en_ratio: float = 0.5
    code_switch_ratio: float = 0.1
    parallel_ratio: float = 0.0
    instruction_ratio: float = 0.0


@dataclass
class LoRAConfig:
    """LoRA配置"""
    enabled: bool = False
    rank: int = 128
    alpha: int = 256
    dropout: float = 0.05
    bias: str = "none"
    target_modules: List[str] = field(default_factory=lambda: ["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])


@dataclass
class CurriculumStage:
    """课程学习阶段"""
    name: str
    zh_ratio: float = 0.5
    en_ratio: float = 0.5
    parallel_ratio: float = 0.0
    code_switch_ratio: float = 0.0
    instruction_ratio: float = 0.0
    target_ppl_zh: Optional[float] = None
    target_ppl_en: Optional[float] = None
    duration_steps: int = 100000


@dataclass
class CurriculumConfig:
    """课程学习配置"""
    enabled: bool = False
    stages: List[CurriculumStage] = field(default_factory=list)


@dataclass
class OptimizerConfig:
    """优化器配置"""
    learning_rate: float = 5e-5
    warmup_steps: int = 10000
    weight_decay: float = 0.01
    beta1: float = 0.9
    beta2: float = 0.95
    epsilon: float = 1e-8
    max_grad_norm: float = 1.0
    min_learning_rate: float = 1e-7


@dataclass
class TrainingConfig:
    """训练配置"""
    # 基础配置
    output_dir: str = "output"
    checkpoint_dir: str = "output/checkpoints"
    log_dir: str = "output/logs"
    save_steps: int = 1000
    eval_steps: int = 500
    logging_steps: int = 100
    max_steps: int = 100000
    warmup_steps: int = 10000
    learning_rate: float = 1e-4
    batch_size: int = 32
    gradient_accumulation_steps: int = 4
    max_grad_norm: float = 1.0
    weight_decay: float = 0.01
    adam_epsilon: float = 1e-8
    fp16: bool = True
    bf16: bool = False
    use_deepspeed: bool = False
    deepspeed_config: Optional[str] = None
    resume_from: Optional[str] = None
    use_amp: bool = True
    amp_dtype: str = "bf16"
    total_steps: int = 100000
    log_interval: int = 100
    save_interval: int = 1000
    eval_interval: int = 500
    use_tensorboard: bool = True
    tensorboard_dir: str = "runs"
    use_wandb: bool = False
    wandb_project: str = "paperpower-7b"
    
    # 模型配置
    model_config: ModelConfig = field(default_factory=ModelConfig)
    
    # 数据配置
    data_config: DataConfig = field(default_factory=DataConfig)
    
    # LoRA配置
    lora_config: LoRAConfig = field(default_factory=LoRAConfig)
    
    # 课程学习配置
    curriculum_config: CurriculumConfig = field(default_factory=CurriculumConfig)
    
    # 优化器配置
    optimizer_config: OptimizerConfig = field(default_factory=OptimizerConfig)
    
    # 评估配置
    eval_config: Dict[str, any] = field(default_factory=lambda: {
        "eval_batch_size": 16,
        "eval_max_steps": 100,
        "metrics": ["loss", "perplexity", "accuracy"]
    })

    def to_dict(self):
        """转换为字典"""
        def dataclass_to_dict(obj):
            if hasattr(obj, '__dataclass_fields__'):
                return {k: dataclass_to_dict(getattr(obj, k)) for k in obj.__dataclass_fields__}
            elif isinstance(obj, dict):
                return {k: dataclass_to_dict(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [dataclass_to_dict(item) for item in obj]
            else:
                return obj
        return dataclass_to_dict(self)


def load_config(config_path: str) -> TrainingConfig:
    """加载配置文件"""
    import yaml
    with open(config_path, 'r', encoding='utf-8') as f:
        config_dict = yaml.safe_load(f)
    
    # 构建配置
    config = TrainingConfig()
    
    # 递归更新配置
    def update_config(obj, config_dict):
        for key, value in config_dict.items():
            if hasattr(obj, key):
                attr = getattr(obj, key)
                if isinstance(attr, (dict, list)):
                    attr.update(value)
                elif hasattr(attr, '__dataclass_fields__'):
                    update_config(attr, value)
                else:
                    setattr(obj, key, value)
    
    update_config(config, config_dict)
    return config


def save_config(config: TrainingConfig, config_path: str):
    """保存配置文件"""
    import yaml
    
    def dataclass_to_dict(obj):
        if hasattr(obj, '__dataclass_fields__'):
            return {k: dataclass_to_dict(getattr(obj, k)) for k in obj.__dataclass_fields__}
        elif isinstance(obj, dict):
            return {k: dataclass_to_dict(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [dataclass_to_dict(item) for item in obj]
        else:
            return obj
    
    config_dict = dataclass_to_dict(config)
    
    with open(config_path, 'w', encoding='utf-8') as f:
        yaml.dump(config_dict, f, default_flow_style=False, allow_unicode=True)


# 默认配置
DEFAULT_CONFIG = TrainingConfig(
    output_dir="output/training",
    checkpoint_dir="output/training/checkpoints",
    log_dir="output/training/logs",
    save_steps=5000,
    eval_steps=2500,
    logging_steps=500,
    max_steps=200000,
    total_steps=200000,
    warmup_steps=20000,
    learning_rate=5e-5,
    batch_size=16,
    gradient_accumulation_steps=8,
    max_grad_norm=1.0,
    weight_decay=0.01,
    adam_epsilon=1e-8,
    fp16=True,
    bf16=False,
    use_deepspeed=False,
    use_amp=True,
    amp_dtype="bf16",
    use_tensorboard=True,
    tensorboard_dir="runs/bilingual-7b",
    use_wandb=False,
    wandb_project="paperpower-7b",
    
    model_config=ModelConfig(
        model_type="bilingual_transformer",
        vocab_size=50000,
        hidden_size=768,
        num_layers=12,
        num_hidden_layers=12,
        num_heads=12,
        num_attention_heads=12,
        intermediate_size=3072,
        max_seq_length=1024,
        max_position_embeddings=1024,
        dropout=0.1,
        hidden_dropout=0.1,
        attention_dropout=0.1,
        use_rope=True,
        rope_theta=10000.0,
        use_bias=True,
        layernorm_epsilon=1e-5,
        layer_norm_eps=1e-5,
        initializer_range=0.02,
        eos_token_id=2,
        pad_token_id=0,
        bos_token_id=1,
        chinese_char_vocab_size=8000,
        use_language_adapters=True,
        use_flash_attention=False,
        gradient_checkpointing=False
    ),
    
    data_config=DataConfig(
        pretrain_data="data/processed/combined_training_data.txt",
        instruction_data="data/processed/instruction.jsonl",
        val_data="data/processed/val_data.jsonl",
        max_seq_length=1024,
        shuffle_buffer_size=10000,
        num_workers=4,
        zh_ratio=0.5,
        en_ratio=0.5,
        code_switch_ratio=0.1,
        parallel_ratio=0.0,
        instruction_ratio=0.0
    ),
    
    lora_config=LoRAConfig(
        enabled=False,
        rank=128,
        alpha=256,
        dropout=0.05,
        bias="none",
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
    ),
    
    curriculum_config=CurriculumConfig(
        enabled=True,
        stages=[
            CurriculumStage(
                name="stage1_bilingual_pretrain",
                zh_ratio=0.5,
                en_ratio=0.5,
                code_switch_ratio=0.0,
                duration_steps=200000
            ),
            CurriculumStage(
                name="stage2_alignment",
                zh_ratio=0.35,
                en_ratio=0.35,
                parallel_ratio=0.3,
                duration_steps=50000
            )
        ]
    ),
    
    optimizer_config=OptimizerConfig(
        learning_rate=5e-5,
        warmup_steps=20000,
        weight_decay=0.01,
        beta1=0.9,
        beta2=0.95,
        epsilon=1e-8,
        max_grad_norm=1.0,
        min_learning_rate=1e-7
    ),
    
    eval_config={
        "eval_batch_size": 16,
        "eval_max_steps": 200,
        "metrics": ["loss", "perplexity", "accuracy"]
    }
)
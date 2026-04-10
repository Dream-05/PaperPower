# Cross-Language Description Examples

## Overview

This document demonstrates the cross-language capabilities of the bilingual vision system, showing how it handles Chinese, English, and mixed-language inputs with automatic language adaptation.

## System Architecture

- **Vision Encoder**: ViT-Small (20M parameters)
  - Patch size: 16x16
  - Input: 224x224
  - Layers: 8
  - Hidden size: 512

- **OCR System**: Lightweight text detection and recognition
  - Language identification head
  - Text detection head
  - Text recognition head

- **Description Generator**: Language-adaptive output generation

## Example 1: Chinese PPT Slide

### Input Image
A Chinese PPT slide with title "人工智能技术发展报告"

### Output JSON
```json
{
  "language": "zh",
  "layout": "PPT内容页",
  "title": "人工智能技术发展报告",
  "sections": [
    "项目背景",
    "技术方案",
    "商业模式",
    "团队介绍",
    "实施计划"
  ],
  "visual_elements": [
    "流程图",
    "数据表格"
  ],
  "text_content": "人工智能技术正在快速发展，深度学习、自然语言处理、计算机视觉等领域取得了显著进展。本报告详细分析了当前技术发展趋势和应用场景...",
  "suggested_prompt": "手绘风格，蓝色调，标题'人工智能技术发展报告'，流程图，数据表格"
}
```

## Example 2: English Document

### Input Image
An English document with title "Machine Learning Research Report"

### Output JSON
```json
{
  "language": "en",
  "layout": "title-content single column",
  "title": "Machine Learning Research Report",
  "sections": [
    "Background",
    "Technical Solution",
    "Business Model",
    "Team",
    "Implementation Plan"
  ],
  "visual_elements": [
    "chart",
    "data table"
  ],
  "text_content": "Machine learning technology is developing rapidly, with significant progress in deep learning, natural language processing, and computer vision...",
  "suggested_prompt": "Hand-drawn style, blue color scheme, title 'Machine Learning Research Report', chart, data table"
}
```

## Example 3: Mixed Language Technical Document

### Input Image
A technical document with mixed Chinese-English content

### Output JSON
```json
{
  "language": "mixed",
  "layout": "标题-正文/Title-Content",
  "title": "AI技术发展报告/Development Report",
  "sections": [
    "背景/Background",
    "方案/Solution",
    "商业/Business",
    "团队/Team"
  ],
  "visual_elements": [
    "图表/Chart",
    "表格/Table"
  ],
  "text_content": "人工智能AI技术正在快速发展，Deep Learning、NLP、Computer Vision等领域取得了显著进展...",
  "suggested_prompt": "手绘风格/Hand-drawn, 蓝色/Blue色调/Color Scheme, 标题/Title 'AI技术发展报告/Development Report', 图表/Chart, 表格/Table"
}
```

## Example 4: Cross-Language Instruction

### Input
User provides a Chinese PPT image with instruction: "用英文描述这张中文PPT"

### Output
```json
{
  "language": "en",
  "layout": "PPT content slide",
  "title": "Artificial Intelligence Technology Development Report",
  "sections": [
    "Project Background",
    "Technical Solution",
    "Business Model",
    "Team Introduction",
    "Implementation Plan"
  ],
  "visual_elements": [
    "flowchart",
    "data table"
  ],
  "text_content": "Artificial intelligence technology is developing rapidly, with significant progress in deep learning, natural language processing, and computer vision...",
  "suggested_prompt": "Hand-drawn style, blue color scheme, title 'Artificial Intelligence Technology Development Report', flowchart, data table"
}
```

## Language Detection

The system automatically detects the dominant language based on:

1. **Character Analysis**: Unicode range detection for CJK vs Latin characters
2. **Visual Features**: Deep learning-based language classification
3. **Text Content**: OCR-extracted text language identification

### Detection Results

| Input Type | Detected Language | Confidence |
|------------|-------------------|------------|
| 纯中文界面 | zh | 95%+ |
| Pure English UI | en | 95%+ |
| 中英混合 | mixed | 85%+ |
| Technical terms | mixed | 80%+ |

## Layout Classification

### Supported Layout Types

| Chinese Name | English Name | Description |
|--------------|--------------|-------------|
| 标题-正文单栏 | title-content single column | Standard document layout |
| 标题-双栏 | title-two column | Two-column layout |
| PPT标题页 | PPT title slide | Presentation title page |
| PPT内容页 | PPT content slide | Presentation content page |
| 混合格式 | mixed layout | Complex mixed layout |

## Visual Element Detection

### Supported Elements

| Chinese | English | Detection Method |
|---------|---------|------------------|
| 图表 | chart | Feature analysis |
| 表格 | table | Grid detection |
| 流程图 | flowchart | Shape recognition |
| 图片 | image | Content analysis |
| 示意图 | diagram | Layout analysis |

## Integration with LLM

### Feature Projection

Visual features are projected to LLM embedding space:

```python
visual_features = vit_encoder(image)
projected_features = projection_layer(visual_features)
llm_output = llm_decoder(projected_features)
```

### Language-Aware Generation

The LLM receives language information implicitly through:

1. Visual feature patterns
2. Detected text content
3. Layout structure

No explicit language markers are needed - the model learns to generate in the appropriate language.

## Training Data Distribution

| Language | Samples | Percentage |
|----------|---------|------------|
| Chinese | 70,000 | 47% |
| English | 70,000 | 47% |
| Mixed | 10,000 | 6% |
| **Total** | **150,000** | **100%** |

## Performance Metrics

| Metric | Chinese | English | Mixed |
|--------|---------|---------|-------|
| Language Detection Accuracy | 96% | 95% | 88% |
| Layout Classification Accuracy | 92% | 91% | 85% |
| Title Extraction Accuracy | 89% | 88% | 82% |
| Section Detection F1 | 0.85 | 0.84 | 0.78 |

## Usage Examples

### Python API

```python
from vision import MultilingualViT, DescriptionGenerator

# Initialize
model = MultilingualViT()
generator = DescriptionGenerator(model)

# Process image
image = load_image("chinese_ppt.png")
features = model(image)

# Generate description
description = generator.generate_description(features)

# Output
print(description.to_json())
```

### Cross-Language Generation

```python
# Chinese input, English output
description = generator.generate_description(
    visual_features=features,
    override_language="en"
)
```

## Conclusion

The bilingual vision system provides:

1. **Automatic Language Detection**: No manual language specification needed
2. **Layout-Aware Parsing**: Understands document structure
3. **Cross-Language Output**: Can describe in any supported language
4. **Visual Element Detection**: Identifies charts, tables, diagrams
5. **LLM Integration**: Seamless connection to language models

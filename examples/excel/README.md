# Excel多表汇总示例

本目录包含Excel多表汇总功能的示例数据和预期结果。

## 示例文件说明

### 输入文件

| 文件名 | 说明 | 数据量 |
|--------|------|--------|
| `sales_january.xlsx` | 1月销售数据 | 50行 |
| `sales_february.xlsx` | 2月销售数据 | 45行 |
| `sales_march.xlsx` | 3月销售数据 | 55行 |
| `employee_info.xlsx` | 员工基础信息 | 100行 |
| `employee_performance.xlsx` | 员工绩效数据 | 100行 |

### 输出文件

| 文件名 | 说明 |
|--------|------|
| `merged_sales_q1.xlsx` | Q1销售汇总结果 |
| `employee_full_data.xlsx` | 员工信息+绩效合并结果 |
| `sales_pivot_summary.xlsx` | 销售透视汇总 |

## 使用场景

### 场景1：纵向追加汇总

将多个月份的销售数据合并为一个表：

```
输入：sales_january.xlsx, sales_february.xlsx, sales_march.xlsx
输出：merged_sales_q1.xlsx

汇总模式：纵向追加
关键字段：自动对齐（日期、产品、销售额、区域）
```

### 场景2：横向关联合并

将员工信息表与绩效表按员工ID关联：

```
输入：employee_info.xlsx, employee_performance.xlsx
输出：employee_full_data.xlsx

汇总模式：横向合并
关联字段：员工ID
```

### 场景3：交叉透视汇总

按部门和月份交叉汇总销售数据：

```
输入：merged_sales_q1.xlsx
输出：sales_pivot_summary.xlsx

汇总模式：透视汇总
行维度：部门
列维度：月份
值：销售额（求和）
```

## 数据格式要求

### 表头识别

系统自动识别以下情况：
- 第一行为表头
- 表头行前有空行
- 多行合并表头

### 列名匹配

系统支持模糊匹配：
- "姓名" = "员工姓名" = "Name"
- "销售额" = "销售金额" = "Sales"
- "日期" = "时间" = "Date"

### 汇总行处理

系统自动识别并处理：
- "合计"、"小计"、"总计"
- "Sum"、"Total"
- 公式计算的汇总行

## 操作日志示例

```
[智办AI] 开始多表汇总...
[智办AI] 检测到3个文件：
  - sales_january.xlsx (50行, 5列)
  - sales_february.xlsx (45行, 5列)
  - sales_march.xlsx (55行, 5列)
[智办AI] 分析表结构...
[智办AI] 检测到相同结构，推荐纵向追加模式
[智办AI] 列对齐完成：日期、产品、销售额、区域、负责人
[智办AI] 发现并移除汇总行：2行
[智办AI] 执行合并...
[智办AI] 合并完成！
  - 总行数：150
  - 总列数：5
  - 数据范围：A1:E151
[智办AI] 生成统计信息...
  - 总销售额：¥1,234,567
  - 平均单笔：¥8,230
  - 最高销售：¥50,000
[智办AI] 汇总结果已保存至：merged_sales_q1.xlsx
```

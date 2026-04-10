"""
Excel示例数据生成器

生成用于测试多表汇总功能的示例Excel文件。
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os


def generate_sales_data(month: int, num_records: int, seed: int = None) -> pd.DataFrame:
    """生成销售数据"""
    if seed:
        np.random.seed(seed)
    
    products = ['产品A', '产品B', '产品C', '产品D', '产品E']
    regions = ['华东', '华南', '华北', '西南', '西北']
    salespeople = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十']
    
    base_date = datetime(2024, month, 1)
    
    data = {
        '日期': [base_date + timedelta(days=np.random.randint(0, 28)) for _ in range(num_records)],
        '产品': np.random.choice(products, num_records),
        '销售额': np.random.randint(1000, 50000, num_records),
        '区域': np.random.choice(regions, num_records),
        '负责人': np.random.choice(salespeople, num_records),
    }
    
    df = pd.DataFrame(data)
    df['日期'] = pd.to_datetime(df['日期']).dt.strftime('%Y-%m-%d')
    
    summary_row = pd.DataFrame({
        '日期': ['合计'],
        '产品': [''],
        '销售额': [df['销售额'].sum()],
        '区域': [''],
        '负责人': ['']
    })
    
    return pd.concat([df, summary_row], ignore_index=True)


def generate_employee_info(num_records: int = 100, seed: int = None) -> pd.DataFrame:
    """生成员工基础信息"""
    if seed:
        np.random.seed(seed)
    
    departments = ['技术部', '市场部', '财务部', '人事部', '运营部']
    positions = ['经理', '主管', '专员', '助理', '总监']
    
    data = {
        '员工ID': [f'E{str(i).zfill(4)}' for i in range(1, num_records + 1)],
        '姓名': [f'员工{i}' for i in range(1, num_records + 1)],
        '部门': np.random.choice(departments, num_records),
        '职位': np.random.choice(positions, num_records),
        '入职日期': [
            (datetime(2020, 1, 1) + timedelta(days=np.random.randint(0, 1500))).strftime('%Y-%m-%d')
            for _ in range(num_records)
        ],
        '基本工资': np.random.randint(8000, 30000, num_records),
    }
    
    return pd.DataFrame(data)


def generate_employee_performance(num_records: int = 100, seed: int = None) -> pd.DataFrame:
    """生成员工绩效数据"""
    if seed:
        np.random.seed(seed)
    
    data = {
        '员工ID': [f'E{str(i).zfill(4)}' for i in range(1, num_records + 1)],
        'Q1绩效': np.random.randint(60, 100, num_records),
        'Q2绩效': np.random.randint(60, 100, num_records),
        'Q3绩效': np.random.randint(60, 100, num_records),
        'Q4绩效': np.random.randint(60, 100, num_records),
        '年度评分': np.random.choice(['S', 'A', 'B', 'C'], num_records, p=[0.1, 0.3, 0.4, 0.2]),
    }
    
    return pd.DataFrame(data)


def generate_budget_data() -> pd.DataFrame:
    """生成预算数据"""
    data = {
        '项目': [
            '营业收入', '营业成本', '毛利润', 
            '销售费用', '管理费用', '财务费用',
            '营业利润', '所得税', '净利润'
        ],
        '预算金额': [1000000, 600000, 400000, 80000, 100000, 20000, 200000, 50000, 150000],
        '实际金额': [950000, 620000, 330000, 85000, 95000, 25000, 125000, 31250, 93750],
    }
    
    df = pd.DataFrame(data)
    df['差异'] = df['预算金额'] - df['实际金额']
    df['差异率'] = (df['差异'] / df['预算金额'] * 100).round(2).astype(str) + '%'
    
    return df


def generate_cashflow_data() -> pd.DataFrame:
    """生成现金流量数据"""
    data = {
        '项目': [
            '一、经营活动产生的现金流量',
            '  销售商品收到的现金',
            '  购买商品支付的现金',
            '  支付职工薪酬',
            '  经营活动现金流量净额',
            '',
            '二、投资活动产生的现金流量',
            '  购建固定资产支付的现金',
            '  投资活动现金流量净额',
            '',
            '三、筹资活动产生的现金流量',
            '  吸收投资收到的现金',
            '  偿还债务支付的现金',
            '  筹资活动现金流量净额',
            '',
            '现金及等价物净增加额'
        ],
        '本期金额': [
            '', 850000, -420000, -150000, 280000,
            '', '', -100000, -100000,
            '', '', 200000, -80000, 120000,
            '', 300000
        ],
        '上期金额': [
            '', 780000, -380000, -140000, 260000,
            '', '', -80000, -80000,
            '', '', 150000, -60000, 90000,
            '', 270000
        ]
    }
    
    return pd.DataFrame(data)


def main():
    output_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("生成销售数据示例...")
    
    sales_jan = generate_sales_data(1, 50, seed=42)
    sales_jan.to_excel(os.path.join(output_dir, 'sales_january.xlsx'), index=False)
    print(f"  - sales_january.xlsx ({len(sales_jan)}行)")
    
    sales_feb = generate_sales_data(2, 45, seed=43)
    sales_feb.to_excel(os.path.join(output_dir, 'sales_february.xlsx'), index=False)
    print(f"  - sales_february.xlsx ({len(sales_feb)}行)")
    
    sales_mar = generate_sales_data(3, 55, seed=44)
    sales_mar.to_excel(os.path.join(output_dir, 'sales_march.xlsx'), index=False)
    print(f"  - sales_march.xlsx ({len(sales_mar)}行)")
    
    print("\n生成员工数据示例...")
    
    employee_info = generate_employee_info(100, seed=45)
    employee_info.to_excel(os.path.join(output_dir, 'employee_info.xlsx'), index=False)
    print(f"  - employee_info.xlsx ({len(employee_info)}行)")
    
    employee_perf = generate_employee_performance(100, seed=46)
    employee_perf.to_excel(os.path.join(output_dir, 'employee_performance.xlsx'), index=False)
    print(f"  - employee_performance.xlsx ({len(employee_perf)}行)")
    
    print("\n生成财务数据示例...")
    
    budget = generate_budget_data()
    budget.to_excel(os.path.join(output_dir, 'budget_analysis.xlsx'), index=False)
    print(f"  - budget_analysis.xlsx ({len(budget)}行)")
    
    cashflow = generate_cashflow_data()
    cashflow.to_excel(os.path.join(output_dir, 'cashflow_statement.xlsx'), index=False)
    print(f"  - cashflow_statement.xlsx ({len(cashflow)}行)")
    
    print("\n✅ 所有示例文件生成完成！")
    print(f"输出目录: {output_dir}")


if __name__ == '__main__':
    main()

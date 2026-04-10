"""
多智能体系统测试
Multi-Agent System Tests
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from shared.multi_agent.system import MultiAgentSystem
from shared.multi_agent.message_bus import get_message_bus


async def test_system_initialization():
    """测试系统初始化"""
    print("\n=== 测试系统初始化 ===")
    
    system = MultiAgentSystem()
    success = await system.initialize()
    
    assert success, "系统初始化失败"
    print("✓ 系统初始化成功")
    
    status = await system.get_system_status()
    print(f"✓ 已注册 {len(status['agents'])} 个智能体")
    
    for agent_name, agent_status in status['agents'].items():
        print(f"  - {agent_name}: {agent_status['capability']}")
    
    await system.shutdown()
    print("✓ 系统关闭成功\n")


async def test_message_bus():
    """测试消息总线"""
    print("\n=== 测试消息总线 ===")
    
    from shared.multi_agent.message_bus import MessageBus, AgentMessage, MessageType, MessagePriority
    
    bus = MessageBus()
    
    queue = await bus.register_agent("test_agent")
    print("✓ 智能体注册成功")
    
    message = AgentMessage(
        id="test_msg_1",
        sender="system",
        receiver="test_agent",
        message_type=MessageType.TASK_ASSIGN,
        content={"task": "test"}
    )
    
    await bus.send(message)
    print("✓ 消息发送成功")
    
    received = await bus.receive("test_agent", timeout=1.0)
    assert received is not None, "消息接收失败"
    print("✓ 消息接收成功")
    
    stats = bus.get_statistics()
    print(f"✓ 消息总线统计: {stats}")
    
    await bus.unregister_agent("test_agent")
    print("✓ 智能体注销成功\n")


async def test_mini_ai_commander():
    """测试MiniAI指挥官"""
    print("\n=== 测试MiniAI指挥官 ===")
    
    from shared.multi_agent.agents.mini_ai_commander import MiniAICommander
    
    commander = MiniAICommander()
    
    test_cases = [
        "帮我生成一个关于人工智能的PPT",
        "分析这份Excel销售数据",
        "搜索Python编程教程",
        "写一份项目报告文档",
        "将数据可视化成图表"
    ]
    
    for test_input in test_cases:
        intent = await commander._understand_intent(test_input)
        print(f"输入: {test_input}")
        print(f"  → 意图: {intent.intent_type}")
        print(f"  → 置信度: {intent.confidence}")
        print(f"  → 分发智能体: {commander.AGENT_MAPPING.get(intent.intent_type, 'Unknown')}")
    
    print("✓ MiniAI指挥官测试完成\n")


async def test_excel_agent():
    """测试Excel智能体"""
    print("\n=== 测试Excel智能体 ===")
    
    from shared.multi_agent.agents.excel_agent import ExcelAgent
    
    agent = ExcelAgent()
    
    task = {
        "description": "帮我生成一个求和公式",
        "task_type": "formula"
    }
    
    result = await agent.execute(task)
    print(f"任务: {task['description']}")
    print(f"结果: {result.output}")
    assert result.success, "Excel任务执行失败"
    print("✓ Excel智能体测试完成\n")


async def test_ppt_agent():
    """测试PPT智能体"""
    print("\n=== 测试PPT智能体 ===")
    
    from shared.multi_agent.agents.ppt_agent import PPTAgent
    
    agent = PPTAgent()
    
    task = {
        "description": "生成一个关于项目汇报的PPT大纲",
        "task_type": "ppt_generation"
    }
    
    result = await agent.execute(task)
    print(f"任务: {task['description']}")
    print(f"大纲页数: {result.output['outline']['total_slides']}")
    assert result.success, "PPT任务执行失败"
    print("✓ PPT智能体测试完成\n")


async def test_word_agent():
    """测试Word智能体"""
    print("\n=== 测试Word智能体 ===")
    
    from shared.multi_agent.agents.word_agent import WordAgent
    
    agent = WordAgent()
    
    task = {
        "description": "写一份工作报告",
        "task_type": "document_writing"
    }
    
    result = await agent.execute(task)
    print(f"任务: {task['description']}")
    print(f"文档类型: {result.output['metadata']['document_type']}")
    assert result.success, "Word任务执行失败"
    print("✓ Word智能体测试完成\n")


async def test_search_agent():
    """测试搜索智能体"""
    print("\n=== 测试搜索智能体 ===")
    
    from shared.multi_agent.agents.search_agent import SearchAgent
    
    agent = SearchAgent()
    
    task = {
        "description": "搜索Python编程教程",
        "task_type": "search"
    }
    
    result = await agent.execute(task)
    print(f"任务: {task['description']}")
    print(f"查询: {result.output['query']}")
    print(f"结果数: {len(result.output['results'])}")
    assert result.success, "搜索任务执行失败"
    print("✓ 搜索智能体测试完成\n")


async def test_data_agent():
    """测试数据智能体"""
    print("\n=== 测试数据智能体 ===")
    
    from shared.multi_agent.agents.data_agent import DataAgent
    
    agent = DataAgent()
    
    task = {
        "description": "创建一个柱状图可视化数据",
        "task_type": "data_visualization"
    }
    
    result = await agent.execute(task)
    print(f"任务: {task['description']}")
    print(f"图表类型: {result.output['chart']['chart_type']}")
    assert result.success, "数据可视化任务执行失败"
    print("✓ 数据智能体测试完成\n")


async def test_full_workflow():
    """测试完整工作流"""
    print("\n=== 测试完整工作流 ===")
    
    system = MultiAgentSystem()
    await system.initialize()
    
    instruction = "帮我生成一个关于人工智能发展的PPT，包含5页内容"
    print(f"用户指令: {instruction}")
    
    result = await system.process_instruction(instruction)
    print(f"任务ID: {result['task_id']}")
    print(f"状态: {result['status']}")
    
    await asyncio.sleep(2)
    
    status = system.orchestrator.get_task_status(result['task_id'])
    if status:
        print(f"任务状态: {status['status']}")
    
    await system.shutdown()
    print("✓ 完整工作流测试完成\n")


async def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 50)
    print("  智办AI多智能体系统测试")
    print("=" * 50)
    
    try:
        await test_message_bus()
        await test_mini_ai_commander()
        await test_excel_agent()
        await test_ppt_agent()
        await test_word_agent()
        await test_search_agent()
        await test_data_agent()
        await test_system_initialization()
        await test_full_workflow()
        
        print("\n" + "=" * 50)
        print("  所有测试通过! ✓")
        print("=" * 50 + "\n")
    
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(run_all_tests())

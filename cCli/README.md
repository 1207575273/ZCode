# CCode

**开源多模型 AI 编程 CLI 助手** — 支持 Claude / OpenAI / GLM / DeepSeek / Ollama

> **C** = **C**odeYang（作者）· **C**hina（中国开发者出品）· **C**ode Agent

[![npm](https://img.shields.io/npm/v/ccode-cli)](https://www.npmjs.com/package/ccode-cli)
[![GitHub](https://img.shields.io/github/stars/1207575273/CCode)](https://github.com/1207575273/CCode)

## 安装

```bash
npm install -g ccode-cli
```

安装后执行 `ccode` 进入交互式对话。

```bash
# 或 npx 直接运行（不安装）
npx ccode-cli
```

## 快速配置

首次启动自动创建 `~/.ccode/config.json`，填入你的 API Key 即可使用：

```jsonc
{
  "defaultProvider": "glm",
  "defaultModel": "glm-5",
  "providers": {
    "glm": {
      "apiKey": "your-api-key",
      "baseURL": "https://open.bigmodel.cn/api/coding/paas/v4",
      "models": ["glm-5", "glm-4.7"]
    }
  }
}
```

支持任意 OpenAI 兼容协议的模型（GLM、DeepSeek、Ollama 等），也支持 Anthropic 原生协议（Claude）。

## 核心能力

- **多模型切换** — 运行时 `/model` 一键切换，不重启、不丢上下文
- **16 个内置工具** — 文件读写、Shell 执行、代码搜索、子 Agent 派发、任务规划
- **MCP 协议** — 动态注册外部工具（stdio / SSE / streamable-http）
- **Skills 生态** — 对接 [skills.sh](https://skills.sh/) 275+ 开放 skill
- **上下文管理** — `/compact` 三种压缩策略 + auto-compact
- **对话持久化** — `--resume` 恢复历史会话 + `/fork` 分支
- **SubAgent** — 后台并行运行，`Ctrl+B` 实时查看
- **Claude Code 兼容** — CLAUDE.md、.mcp.json、插件目录零迁移

## 常用指令

| 指令 | 说明 |
|------|------|
| `/model` | 切换模型 |
| `/compact` | 压缩上下文 |
| `/context` | 查看上下文使用率 |
| `/resume` | 恢复历史会话 |
| `/usage` | Token 用量统计 |
| `/help` | 查看所有指令 |

## 支持的模型

| Provider | 模型 | 协议 |
|----------|------|------|
| Anthropic | Claude Opus/Sonnet/Haiku 4.x | Anthropic 原生 |
| OpenAI | GPT-4o / GPT-4o-mini | OpenAI 兼容 |
| 智谱 GLM | GLM-5 / GLM-4.7 | OpenAI 兼容 |
| DeepSeek | deepseek-chat / deepseek-reasoner | OpenAI 兼容 |
| Ollama | 任意本地模型 | OpenAI 兼容 |

## 文档

详细文档见 [GitHub](https://github.com/1207575273/CCode)

## License

[BSL 1.1](https://github.com/1207575273/CCode/blob/main/LICENSE) — 个人和非商业使用自由，商业使用需授权。

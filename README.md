# ZCli

多模型 AI 编程 CLI 助手，支持 Claude、OpenAI、Gemini 等任意 OpenAI 兼容协议的模型。

## 目录结构

```
claude_cli_z01/
  docs/       # 需求与设计文档
  zCli/       # 项目代码
```

---

## 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | >= 20 |
| pnpm | >= 9 |

> 推荐使用 nvm 管理 Node.js 版本：
> ```bash
> nvm install 20
> nvm use 20
> ```

---

## 快速开始

### 1. 安装依赖

```bash
cd zCli
pnpm install
```

### 2. 开发模式启动（推荐）

```bash
pnpm dev
```

直接运行 TypeScript 源码，无需构建，修改代码后重启即可生效。

### 3. 构建后运行

```bash
pnpm build
node dist/bin/zcli.js
```

---

## 界面操作

| 操作 | 说明 |
|------|------|
| 直接打字 | 在底部输入框输入消息 |
| `Enter` | 发送消息 |
| `/exit` 或 `/quit` | 退出程序 |
| `Ctrl+C` | 强制退出 |

---

## 其他命令

```bash
# 运行测试
pnpm test

# 监听模式测试（开发时）
pnpm test:watch

# TypeScript 类型检查
pnpm typecheck

# 构建
pnpm build
```

---

## 配置

ZCli 的配置文件位于 `~/.zcli/` 目录下，首次启动时自动创建。

### config.json — 主配置

路径：`~/.zcli/config.json`

```jsonc
{
  // 默认使用的 Provider
  "defaultProvider": "anthropic",
  // 默认使用的模型
  "defaultModel": "claude-sonnet-4-6",
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-xxxxx",
      "models": ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
    },
    "openai": {
      "apiKey": "sk-xxxxx",
      "models": ["gpt-4o", "gpt-4o-mini"]
    },
    // 任意 OpenAI 兼容 Provider，通过 baseURL 指定
    "glm": {
      "apiKey": "your-api-key",
      "baseURL": "https://open.bigmodel.cn/api/coding/paas/v4",
      "models": ["glm-4-flash", "glm-4-air", "glm-4"]
    }
  }
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `defaultProvider` | `string` | 启动时默认使用的 Provider 名称 |
| `defaultModel` | `string` | 启动时默认使用的模型名称 |
| `providers.<name>.apiKey` | `string` | Provider 的 API Key |
| `providers.<name>.baseURL` | `string?` | 自定义 API 端点（OpenAI 兼容协议） |
| `providers.<name>.models` | `string[]` | 该 Provider 可用的模型列表 |

> 运行时可通过 `/model` 指令或 `/model <模型名>` 快速切换模型。

### .mcp.json — MCP Server 配置

ZCli 支持 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 协议，可连接外部工具服务器扩展 Agent 能力。

**配置文件搜索路径（按优先级从高到低）：**

| 优先级 | 路径 | 说明 |
|--------|------|------|
| 1（最高） | `~/.zcli/.mcp.json` | ZCli 专属配置 |
| 2 | `~/.claude.json` | Claude Code 用户配置（兼容） |
| 3 | `~/.mcp.json` | 通用 MCP 全局配置 |

同名 Server 出现在多个文件时，高优先级覆盖低优先级。

路径：`~/.zcli/.mcp.json`

```jsonc
{
  "mcpServers": {
    // Stdio 模式：启动本地子进程
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"],
      "env": {
        "NODE_ENV": "production"
      }
    },
    // Streamable HTTP 模式：连接远程服务
    "deepwiki": {
      "type": "streamable-http",
      "url": "https://mcp.deepwiki.com/mcp"
    },
    // SSE 模式
    "my-sse-server": {
      "type": "sse",
      "url": "http://localhost:3001/sse"
    },
    // HTTP 模式（兼容 .claude.json 格式，含自定义请求头）
    "remote-api": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

**Server 配置字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `command` | `string?` | Stdio 模式：要执行的命令 |
| `args` | `string[]?` | Stdio 模式：命令参数 |
| `env` | `Record<string, string>?` | Stdio 模式：附加环境变量 |
| `type` | `'stdio' \| 'sse' \| 'streamable-http' \| 'http'?` | 传输类型（有 `command` 时默认 stdio，有 `url` 时默认 streamable-http） |
| `url` | `string?` | 远程模式：服务端 URL |
| `headers` | `Record<string, string>?` | HTTP/Streamable HTTP 模式：自定义请求头 |

> 运行时可通过 `/mcp` 指令查看所有 Server 的连接状态和工具列表。

---

## 技术栈

- **运行时**：Node.js 20 + TypeScript 5（strict 模式）
- **终端 UI**：Ink 5 + React 18
- **LLM 调用层**：LangChain（`@langchain/openai` / `@langchain/anthropic` / `@langchain/google-genai`）
- **Agent Loop**：完全自研（不使用 LangGraph）
- **包管理**：pnpm
- **构建**：tsup
- **测试**：Vitest

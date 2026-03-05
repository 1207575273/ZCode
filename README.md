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

## 技术栈

- **运行时**：Node.js 20 + TypeScript 5（strict 模式）
- **终端 UI**：Ink 5 + React 18
- **LLM 调用层**：LangChain（`@langchain/openai` / `@langchain/anthropic` / `@langchain/google-genai`）
- **Agent Loop**：完全自研（不使用 LangGraph）
- **包管理**：pnpm
- **构建**：tsup
- **测试**：Vitest

// src/ui/ChatView.tsx

/**
 * ChatView — 消息列表渲染组件。
 *
 * 负责展示完整的对话历史（user / assistant / system 三种角色），
 * 工具执行状态（ToolStatusLine），以及实时流式气泡（streamingMessage）。
 *
 * system 消息来自指令系统（/help 输出、切换确认等），以灰色左竖线样式呈现，
 * 不发送给 LLM（useChat.submit() 在构建 history 时会过滤掉它们）。
 */

import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import { ToolStatusLine, type ToolEvent } from './ToolStatusLine.js'

/** 单条聊天消息的数据结构，与 LLM Message 类型分离（system 仅用于 UI）。 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** user/assistant 角色的颜色和标签配置，system 走独立渲染分支。 */
const ROLE_CONFIG = {
  user: { color: 'green' as const, label: '> 你' },
  assistant: { color: 'cyan' as const, label: '◆ ZCli' },
} as const

interface ChatViewProps {
  messages: ChatMessage[]
  /** null/undefined = 空闲；'' = 等待首 token；非空字符串 = 流式内容累积中 */
  streamingMessage?: string | null
  toolEvents?: ToolEvent[]
}

/**
 * 渲染对话区域。消息按时间顺序从上到下排列，
 * 工具事件显示在消息列表末尾、流式气泡之前。
 */
export function ChatView({ messages, streamingMessage, toolEvents }: ChatViewProps) {
  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      {messages.map((msg) => (
        <Box key={msg.id} marginBottom={1} flexDirection="column">
          {msg.role === 'system' ? (
            // system 消息：灰色 dimColor + 左侧单竖线，视觉上区别于对话气泡
            <Box paddingLeft={1} borderStyle="single" borderLeft={true} borderColor="gray" borderRight={false} borderTop={false} borderBottom={false}>
              <Text dimColor>{msg.content}</Text>
            </Box>
          ) : (
            <>
              <Text color={ROLE_CONFIG[msg.role].color} bold>
                {ROLE_CONFIG[msg.role].label}
              </Text>
              <Text>{msg.content}</Text>
            </>
          )}
        </Box>
      ))}

      {(toolEvents ?? []).map(e => (
        <ToolStatusLine key={e.id} event={e} />
      ))}

      {/* 流式气泡：streamingMessage 不为 null/undefined 时显示 */}
      {streamingMessage != null && (
        <Box marginBottom={1} flexDirection="column">
          <Text color="cyan" bold>◆ ZCli</Text>
          {streamingMessage === '' ? (
            // 等待首个 token：显示加载动画
            <Box>
              <Spinner type="dots" />
            </Box>
          ) : (
            <Text>{streamingMessage}</Text>
          )}
        </Box>
      )}
    </Box>
  )
}

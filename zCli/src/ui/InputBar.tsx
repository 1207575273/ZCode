// src/ui/InputBar.tsx

/**
 * InputBar — 底部文本输入组件。
 *
 * 受控组件：父组件（App.tsx）持有 value state 并通过 onChange 同步，
 * 以便 App.tsx 实时感知输入内容、计算指令建议列表。
 * 通过 onSubmit 将最终文本回传给 App.tsx 处理（指令分发或 LLM 提交）。
 */

import React from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { useTerminalSize } from './useTerminalSize.js'

interface InputBarProps {
  /** 当前输入值（受控） */
  value: string
  /** 输入变更回调，每次按键触发 */
  onChange: (value: string) => void
  /** 提交回调，用户按 Enter 时触发 */
  onSubmit: (value: string) => void
  placeholder?: string
  /** 为 true 时输入框变暗，提交被忽略（LLM 响应中） */
  disabled?: boolean
}

/**
 * 底部输入栏，包含上下分隔线和 "❯" 提示符。
 * 使用 ink-text-input 处理文本录入和光标。
 */
export function InputBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Try "how does <filepath> work?"',
  disabled = false,
}: InputBarProps) {
  const { columns } = useTerminalSize()

  function handleSubmit(text: string) {
    if (disabled) return
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{'─'.repeat(columns)}</Text>
      </Box>
      <Box paddingLeft={1}>
        {disabled
          ? <Text dimColor>❯ </Text>
          : <Text color="green">❯ </Text>
        }
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      </Box>
      <Box>
        <Text dimColor>{'─'.repeat(columns)}</Text>
      </Box>
    </Box>
  )
}

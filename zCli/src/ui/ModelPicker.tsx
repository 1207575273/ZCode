// src/ui/ModelPicker.tsx

/**
 * ModelPicker — 交互式模型选择弹窗。
 *
 * 替换 InputBar 渲染（与 PermissionDialog 相同的互斥模式），
 * 通过 ↑↓ 方向键导航，Enter 确认，Esc 取消。
 * items 由外部（App.tsx）传入，组件不直接读取 config，保持关注点分离。
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

/** model 列列宽（字符数），用于 padEnd 对齐显示 */
const MODEL_COL_WIDTH = 20
/** provider 列列宽（字符数） */
const PROVIDER_COL_WIDTH = 12

/** 单个可选模型项 */
export interface ModelItem {
  provider: string
  model: string
}

export interface ModelPickerProps {
  /** 当前激活的 provider，用于初始光标定位和 ✓ 标记 */
  currentProvider: string
  /** 当前激活的模型名，用于初始光标定位和 ✓ 标记 */
  currentModel: string
  /** 全部可选模型列表，由 App.tsx 从 config 枚举生成 */
  items: ModelItem[]
  /** 用户确认选择时回调 */
  onSelect: (provider: string, model: string) => void
  /** 用户按 Esc 取消时回调 */
  onCancel: () => void
}

/**
 * 模型选择弹窗组件。
 * 挂载时自动将光标定位到当前激活模型；若未找到匹配项则停在第一项。
 */
export function ModelPicker({
  currentProvider,
  currentModel,
  items,
  onSelect,
  onCancel,
}: ModelPickerProps) {
  // lazy initializer：只在首次渲染时查找当前模型的索引，避免每次渲染重复遍历
  const [selected, setSelected] = useState(() => {
    const idx = items.findIndex(
      item => item.provider === currentProvider && item.model === currentModel
    )
    return idx >= 0 ? idx : 0
  })

  useInput((_input, key) => {
    // 循环导航：到达边界时回绕到另一端
    if (key.upArrow) {
      setSelected(s => (s - 1 + items.length) % items.length)
    }
    if (key.downArrow) {
      setSelected(s => (s + 1) % items.length)
    }
    if (key.return) {
      const item = items[selected]
      if (item != null) {
        onSelect(item.provider, item.model)
      }
    }
    if (key.escape) {
      onCancel()
    }
  })

  if (items.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="yellow">暂无可用模型</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text>
        当前模型: <Text bold color="cyan">{currentModel}</Text>
        <Text dimColor> ({currentProvider})</Text>
      </Text>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>可用模型:</Text>
        {items.map((item, i) => {
          const isCurrent = item.provider === currentProvider && item.model === currentModel
          const isSelected = i === selected
          const cursor = isSelected ? '❯' : ' '
          // 价格数据待 F10 实现后填入，当前显示占位符
          const priceStr = '--  / --'

          return (
            <Box key={`${item.provider}:${item.model}`} paddingLeft={1}>
              {isSelected ? (
                <Text color="cyan">
                  {cursor} {i + 1}. {item.model.padEnd(MODEL_COL_WIDTH)} {item.provider.padEnd(PROVIDER_COL_WIDTH)} {priceStr}
                  {isCurrent ? <Text color="green"> ✓</Text> : ''}
                </Text>
              ) : (
                <Text dimColor={!isCurrent}>
                  {'  '}{i + 1}. {item.model.padEnd(MODEL_COL_WIDTH)} {item.provider.padEnd(PROVIDER_COL_WIDTH)} {priceStr}
                  {isCurrent ? <Text color="green"> ✓</Text> : ''}
                </Text>
              )}
            </Box>
          )
        })}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>↑↓ 选择   Enter 确认   Esc 取消</Text>
      </Box>
    </Box>
  )
}

// src/ui/ModelPicker.tsx
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

export interface ModelItem {
  provider: string
  model: string
}

export interface ModelPickerProps {
  currentProvider: string
  currentModel: string
  items: ModelItem[]
  onSelect: (provider: string, model: string) => void
  onCancel: () => void
}

export function ModelPicker({
  currentProvider,
  currentModel,
  items,
  onSelect,
  onCancel,
}: ModelPickerProps) {
  // 初始光标定位：找到匹配当前激活模型的项，找不到则停在第一项
  const initialIndex = () => {
    const idx = items.findIndex(
      item => item.provider === currentProvider && item.model === currentModel
    )
    return idx >= 0 ? idx : 0
  }

  const [selected, setSelected] = useState(initialIndex)

  useInput((_input, key) => {
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
          const priceStr = '--  / --'

          return (
            <Box key={`${item.provider}:${item.model}`} paddingLeft={1}>
              {isSelected ? (
                <Text color="cyan">
                  {cursor} {i + 1}. {item.model.padEnd(20)} {item.provider.padEnd(12)} {priceStr}
                  {isCurrent ? <Text color="green"> ✓</Text> : ''}
                </Text>
              ) : (
                <Text dimColor={!isCurrent}>
                  {'  '}{i + 1}. {item.model.padEnd(20)} {item.provider.padEnd(12)} {priceStr}
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

// src/ui/ChatView.tsx
import React from 'react'
import { Box, Text } from 'ink'

export function ChatView() {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text dimColor>ZCli 准备就绪，输入消息开始对话...</Text>
    </Box>
  )
}

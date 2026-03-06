// src/ui/WelcomeScreen.tsx
import React from 'react'
import { Box, Text } from 'ink'

const APP_VERSION = 'v0.1.0'
const LEFT_PANEL_WIDTH = 28

// 像素风格机器人（块元素字符 U+2580 系列）
const ROBOT_ART = [
  '  ▄██████▄  ',
  '  █ ■  ■ █  ',
  '  █  ▄▄  █  ',
  '  ▀██████▀  ',
  '   ██  ██   ',
]

// 竖分隔线：固定行数覆盖左栏最大高度（标题1 + 机器人5 + 信息3 + 间距2 = 11）
const DIVIDER_LINES = Array.from({ length: 11 }, (_, i) => i)

interface WelcomeScreenProps {
  model: string
  provider: string
  cwd: string
}

export function WelcomeScreen({ model, provider, cwd }: WelcomeScreenProps) {
  return (
    <Box
      borderStyle="round"
      borderColor="red"
      flexDirection="column"
      marginX={1}
    >
      {/* 标题行 */}
      <Box paddingX={1} marginBottom={1}>
        <Text color="red" bold>── ZCli {APP_VERSION} ──</Text>
      </Box>

      {/* 双栏主体 */}
      <Box flexDirection="row">
        {/* 左栏：用户信息 + ASCII 机器人 */}
        <Box
          flexDirection="column"
          width={LEFT_PANEL_WIDTH}
          paddingLeft={2}
          paddingRight={2}
        >
          <Text bold color="white">Welcome back!</Text>
          <Box flexDirection="column" marginY={1}>
            {ROBOT_ART.map((line) => (
              <Text key={line} color="red">{line}</Text>
            ))}
          </Box>
          <Text color="white">{model}</Text>
          <Text dimColor>{provider}</Text>
          <Text dimColor wrap="truncate">{cwd}</Text>
        </Box>

        {/* 竖分隔线 */}
        <Box flexDirection="column" marginRight={2}>
          {DIVIDER_LINES.map((i) => (
            <Text key={i} dimColor>│</Text>
          ))}
        </Box>

        {/* 右栏：提示 + 最近记录 */}
        <Box flexDirection="column" flexGrow={1} paddingRight={2}>
          <Text color="yellow" bold>Tips for getting started</Text>
          <Text>输入 <Text color="cyan">/help</Text> 查看可用命令</Text>
          <Text>输入 <Text color="cyan">/model</Text> 切换模型</Text>

          <Box marginTop={1} flexDirection="column">
            <Text color="yellow" bold>Recent sessions</Text>
            <Text dimColor>No recent activity</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

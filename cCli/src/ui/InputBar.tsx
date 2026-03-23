// src/ui/InputBar.tsx

/**
 * InputBar — 底部多行文本输入组件。
 *
 * 使用 ControlledMultilineInput（纯展示）+ 自管键盘逻辑。
 * Enter 提交，Alt+Enter 换行。
 * Home/Ctrl+A → 当前行首，End/Ctrl+E → 当前行尾。
 */

import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, useInput, useStdin } from 'ink'
import { ControlledMultilineInput } from 'ink-multiline-input'
import { useTerminalSize } from './useTerminalSize.js'

interface InputBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onInterruptSubmit?: ((value: string) => void) | undefined
  placeholder?: string
  streaming?: boolean
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

// ─── 已经被你验证成功的核心计算逻辑 ───
function findLastNewline(str: string, fromIdx: number): number {
  return Math.max(str.lastIndexOf('\n', fromIdx), str.lastIndexOf('\r', fromIdx))
}

function findNextNewline(str: string, fromIdx: number): number {
  const n = str.indexOf('\n', fromIdx)
  const r = str.indexOf('\r', fromIdx)
  if (n === -1) return r
  if (r === -1) return n
  return Math.min(n, r)
}

export function InputBar({
                           value,
                           onChange,
                           onSubmit,
                           onInterruptSubmit,
                           placeholder = 'Try "how does <filepath> work?"',
                           streaming = false,
                         }: InputBarProps) {
  const { columns } = useTerminalSize()

  // 【关键点1】拉取原生的 stdin 流
  const { stdin } = useStdin()

  const [cursorIndex, setCursorIndex] = useState(value.length)

  const valueRef = useRef(value)
  const cursorRef = useRef(cursorIndex)
  valueRef.current = value
  cursorRef.current = cursorIndex

  useEffect(() => {
    if (cursorIndex > value.length) {
      setCursorIndex(value.length)
    }
  }, [value, cursorIndex])

  // ─── 【关键点2】硬核手动劫持：专治 Windows 奇葩扫描码 ───
  useEffect(() => {
    if (!stdin) return

    const onData = (data: Buffer) => {
      // 拿到数据的十六进制表达和字符串表达
      const hex = data.toString('hex')
      const str = data.toString('utf8')

      const val = valueRef.current
      const cur = cursorRef.current

      // 匹配 Linux/Mac 标准序列 + Windows Terminal 序列 + Windows 原生 CMD/PowerShell 扫描码 (e047, 0047)
      const isHome =
          str === '\x1b[H' || str === '\x1b[1~' || str === '\x1b[7~' || str === '\x1bOH' ||
          hex === 'e047' || hex === '0047' || hex === '1b5b48'

      const isEnd =
          str === '\x1b[F' || str === '\x1b[4~' || str === '\x1b[8~' || str === '\x1bOF' ||
          hex === 'e04f' || hex === '004f' || hex === '1b5b46'

      if (isHome) {
        const lastNewline = findLastNewline(val, cur - 1)
        setCursorIndex(lastNewline === -1 ? 0 : lastNewline + 1)
      } else if (isEnd) {
        const nextNewline = findNextNewline(val, cur)
        setCursorIndex(nextNewline === -1 ? val.length : nextNewline)
      }
    }

    // prependListener：抢在 Ink 解析器之前拦截数据！
    stdin.prependListener('data', onData)
    return () => { stdin.removeListener('data', onData) }
  }, [stdin])

  function handleSubmit(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    if (streaming && onInterruptSubmit) {
      onInterruptSubmit(trimmed)
    } else {
      onSubmit(trimmed)
    }
  }

  // ─── useInput 只需要处理常规的业务按键 ───
  useInput((input, key) => {
    // 拦截残余转义乱码
    if (input && input.includes('\x1b')) return

    if (input === '' && !key.return && !key.escape && !key.backspace && !key.delete
        && !key.upArrow && !key.downArrow && !key.leftArrow && !key.rightArrow
        && !key.tab && !key.pageUp && !key.pageDown && !key.ctrl && !key.meta) {
      return
    }

    // Submit: Enter
    if (key.return && !key.meta && !key.shift) {
      handleSubmit(value)
      return
    }

    // Newline: Alt+Enter
    if (key.return && key.meta) {
      const newValue = value.slice(0, cursorIndex) + '\n' + value.slice(cursorIndex)
      onChange(newValue)
      setCursorIndex(cursorIndex + 1)
      return
    }

    if (key.tab || (key.ctrl && input === 'c')) return

    // Ctrl+A / Ctrl+E 依然作为兜底保留
    if (key.ctrl && input === 'a') {
      const lastNewline = findLastNewline(value, cursorIndex - 1)
      setCursorIndex(lastNewline === -1 ? 0 : lastNewline + 1)
      return
    }

    if (key.ctrl && input === 'e') {
      const nextNewline = findNextNewline(value, cursorIndex)
      setCursorIndex(nextNewline === -1 ? value.length : nextNewline)
      return
    }

    // ↑ 上箭头
    if (key.upArrow) {
      const lines = normalizeLineEndings(value).split('\n')
      let currentLineIndex = 0
      let currentPos = 0
      let col = 0
      for (let i = 0; i < lines.length; i++) {
        const lineLen = lines[i]!.length
        const lineEnd = currentPos + lineLen
        if (cursorIndex >= currentPos && cursorIndex <= lineEnd) {
          currentLineIndex = i
          col = cursorIndex - currentPos
          break
        }
        currentPos = lineEnd + 1
      }
      if (currentLineIndex > 0) {
        const targetLine = lines[currentLineIndex - 1]!
        const newCol = Math.min(col, targetLine.length)
        let newIndex = 0
        for (let i = 0; i < currentLineIndex - 1; i++) {
          newIndex += lines[i]!.length + 1
        }
        newIndex += newCol
        setCursorIndex(newIndex)
      }
      return
    }

    // ↓ 下箭头
    if (key.downArrow) {
      const lines = normalizeLineEndings(value).split('\n')
      let currentLineIndex = 0
      let currentPos = 0
      let col = 0
      for (let i = 0; i < lines.length; i++) {
        const lineLen = lines[i]!.length
        const lineEnd = currentPos + lineLen
        if (cursorIndex >= currentPos && cursorIndex <= lineEnd) {
          currentLineIndex = i
          col = cursorIndex - currentPos
          break
        }
        currentPos = lineEnd + 1
      }
      if (currentLineIndex < lines.length - 1) {
        const targetLine = lines[currentLineIndex + 1]!
        const newCol = Math.min(col, targetLine.length)
        let newIndex = 0
        for (let i = 0; i < currentLineIndex + 1; i++) {
          newIndex += lines[i]!.length + 1
        }
        newIndex += newCol
        setCursorIndex(newIndex)
      }
      return
    }

    // ← 左箭头
    if (key.leftArrow) {
      setCursorIndex(Math.max(0, cursorIndex - 1))
      return
    }

    // → 右箭头
    if (key.rightArrow) {
      setCursorIndex(Math.min(value.length, cursorIndex + 1))
      return
    }

    // Backspace
    if (key.backspace) {
      if (cursorIndex > 0) {
        const newValue = value.slice(0, cursorIndex - 1) + value.slice(cursorIndex)
        onChange(newValue)
        setCursorIndex(cursorIndex - 1)
      }
      return
    }

    // Delete
    if (key.delete) {
      if (cursorIndex < value.length) {
        const newValue = value.slice(0, cursorIndex) + value.slice(cursorIndex + 1)
        onChange(newValue)
      }
      return
    }

    // 普通文本输入
    if (input && !key.ctrl && !key.meta) {
      const newValue = value.slice(0, cursorIndex) + input + value.slice(cursorIndex)
      onChange(newValue)
      setCursorIndex(cursorIndex + input.length)
    }
  })

  return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>{'─'.repeat(columns)}</Text>
        </Box>
        <Box paddingLeft={1}>
          {streaming
              ? <Text dimColor>❯ </Text>
              : <Text color="green">❯ </Text>
          }
          <ControlledMultilineInput
              value={value}
              cursorIndex={cursorIndex}
              placeholder={placeholder}
              rows={1}
              maxRows={10}
          />
        </Box>
        <Box>
          <Text dimColor>{'─'.repeat(columns)}</Text>
        </Box>
      </Box>
  )
}
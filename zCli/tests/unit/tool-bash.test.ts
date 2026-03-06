import { describe, it, expect } from 'vitest'
import { BashTool } from '@tools/bash.js'

describe('BashTool', () => {
  it('执行简单命令返回输出', async () => {
    const tool = new BashTool()
    const result = await tool.execute({ command: 'echo hello' }, { cwd: process.cwd() })
    expect(result.success).toBe(true)
    expect(result.output).toContain('hello')
  })

  it('命令失败返回 error', async () => {
    const tool = new BashTool()
    // nonexistent_command_xyz 在任何 shell 中都会失败
    const result = await tool.execute({ command: 'nonexistent_command_xyz' }, { cwd: process.cwd() })
    expect(result.success).toBe(false)
  })

  it('dangerous 为 true', () => {
    expect(new BashTool().dangerous).toBe(true)
  })
})

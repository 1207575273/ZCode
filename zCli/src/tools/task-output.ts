// src/tools/task-output.ts

/**
 * TaskOutput — 读取后台任务输出。
 *
 * 补全 bash run_in_background 的闭环：启动后台进程后可读取其 stdout/stderr 输出。
 * 支持两种模式：
 * - block=false（默认）：立即返回当前已有的输出
 * - block=true：等待进程结束或超时，再返回全部输出
 */

import { getProcess, getOutput } from './process-tracker.js'
import type { Tool, ToolContext, ToolResult } from './types.js'

/** 默认阻塞超时 10 秒 */
const DEFAULT_BLOCK_TIMEOUT_MS = 10_000
/** 最大阻塞超时 5 分钟 */
const MAX_BLOCK_TIMEOUT_MS = 300_000
/** 等待轮询间隔 */
const POLL_INTERVAL_MS = 200

export class TaskOutputTool implements Tool {
  readonly name = 'task_output'
  readonly dangerous = false
  readonly description =
    '读取后台任务（bash run_in_background）的输出。传入 pid 获取已捕获的 stdout/stderr。block=true 时阻塞等待进程结束。'
  readonly parameters = {
    type: 'object',
    properties: {
      pid: { type: 'number', description: '后台进程 PID' },
      block: {
        type: 'boolean',
        description: '是否阻塞等待进程结束（默认 false，立即返回已有输出）',
      },
      timeout: {
        type: 'number',
        description: '阻塞超时（毫秒），仅 block=true 时生效，默认 10000，上限 300000',
      },
    },
    required: ['pid'],
  }

  async execute(args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const pid = Number(args['pid'])
    if (!Number.isFinite(pid) || pid <= 0) {
      return { success: false, output: '', error: 'pid 必须是正整数' }
    }

    const proc = getProcess(pid)
    if (!proc) {
      return {
        success: false,
        output: '',
        error: `PID ${pid} 不在追踪列表中（只能读取由 bash run_in_background 启动的进程输出）`,
      }
    }

    const block = args['block'] === true
    const rawTimeout = Number(args['timeout'])
    const timeout = block
      ? (!Number.isFinite(rawTimeout) || rawTimeout <= 0
          ? DEFAULT_BLOCK_TIMEOUT_MS
          : Math.min(rawTimeout, MAX_BLOCK_TIMEOUT_MS))
      : 0

    // 阻塞模式：轮询等待进程结束
    if (block && !proc.done) {
      const deadline = Date.now() + timeout
      while (!proc.done && Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS)
      }
    }

    const output = getOutput(pid) ?? ''
    const status = proc.done
      ? `进程已结束 (exitCode: ${proc.exitCode ?? 'unknown'})`
      : '进程仍在运行'

    return {
      success: true,
      output: output
        ? `[${status}]\n${output}`
        : `[${status}]\n(暂无输出)`,
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

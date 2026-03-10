// src/core/agent-loop.ts

/**
 * AgentLoop — LLM ↔ 工具的多轮执行引擎。
 *
 * 单次 run() 调用对应一次用户提问的完整处理过程：
 *   1. 调用 LLM → 收集文本和工具调用
 *   2. 如有工具调用 → 逐个执行（含权限检查） → 将结果追加到历史
 *   3. 回到步骤 1 进入下一轮，直到 LLM 不再调用工具
 *
 * 所有中间状态通过 AsyncGenerator<AgentEvent> yield 出去，
 * 调用方（useChat）和观察者（SessionLogger）各取所需。
 */

import type { LLMProvider } from '@providers/provider.js'
import type { ToolRegistry } from '@tools/registry.js'
import type { Message, ToolCallContent, StreamChunk } from './types.js'
import type { AgentConfig, AgentEvent } from './agent-event.js'

export type { AgentEvent, AgentConfig } from './agent-event.js'

/** 最大自动执行轮次，防止死循环 */
const MAX_TURNS = 20

/** resultSummary 最大长度 */
const RESULT_SUMMARY_MAX_LENGTH = 200

export class AgentLoop {
  readonly #provider: LLMProvider
  readonly #registry: ToolRegistry
  readonly #config: AgentConfig

  constructor(
    provider: LLMProvider,
    registry: ToolRegistry,
    config: AgentConfig,
  ) {
    this.#provider = provider
    this.#registry = registry
    this.#config = config
  }

  /**
   * 执行多轮对话循环。
   *
   * 流程：LLM 调用 → [工具执行 → LLM 调用]* → 文本回复
   * 每轮结果通过 yield 推送给调用方，调用方可随时 abort。
   */
  async *run(messages: Message[]): AsyncIterable<AgentEvent> {
    const history: Message[] = [...messages]

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // ── 阶段 1：调用 LLM ──
      const llmResult = yield* this.#callLLM(history)
      if (llmResult.aborted) return

      // 无工具调用 → 对话结束
      if (llmResult.toolCalls.length === 0) {
        yield { type: 'done' }
        return
      }

      // ── 阶段 2：执行工具 ──
      yield* this.#executeToolCalls(llmResult.toolCalls, history)
    }

    yield { type: 'error', error: `超过最大轮次限制 (${MAX_TURNS})` }
  }

  // ─────────────────────────────────────────────
  // 阶段 1：LLM 调用（流式 + 观测事件）
  // ─────────────────────────────────────────────

  /**
   * 调用 LLM 并收集流式输出。
   *
   * yield 的事件：llm_start → text* → llm_usage | llm_error
   * 返回值：收集到的工具调用列表，aborted=true 表示因错误中止。
   */
  async *#callLLM(
    history: Message[],
  ): AsyncGenerator<AgentEvent, { toolCalls: ToolCallContent[]; aborted: boolean }> {
    const toolDefs = this.#registry.toToolDefinitions()
    const chatRequest = {
      model: this.#config.model,
      messages: history,
      tools: toolDefs,
      ...(this.#config.signal !== undefined ? { signal: this.#config.signal } : {}),
    }

    yield { type: 'llm_start', provider: this.#config.provider, model: this.#config.model, messageCount: history.length }

    const pendingToolCalls: ToolCallContent[] = []
    let inputTokens = 0
    let outputTokens = 0

    try {
      for await (const chunk of this.#provider.chat(chatRequest)) {
        const event = this.#handleStreamChunk(chunk, pendingToolCalls)
        if (event) {
          if (event.type === 'error') {
            // Provider 报告错误 → yield 观测事件 + 业务错误，中止循环
            yield this.#makeLlmError(chunk.error ?? 'unknown error', outputTokens)
            yield event
            return { toolCalls: [], aborted: true }
          }
          if (event.type === 'text') yield event
        }
        // 更新 token 计数
        if (chunk.type === 'usage' && chunk.usage) {
          inputTokens = chunk.usage.inputTokens
          outputTokens = chunk.usage.outputTokens
        }
      }

      yield { type: 'llm_usage', inputTokens, outputTokens, stopReason: 'end_turn' }
      return { toolCalls: pendingToolCalls, aborted: false }
    } catch (err) {
      yield* this.#handleLLMCatchError(err, inputTokens, outputTokens)
      throw err // 向上抛出，由 useChat 的 try-catch 处理
    }
  }

  /** 将单个 StreamChunk 映射为 AgentEvent（text / error），或 null（无需 yield） */
  #handleStreamChunk(chunk: StreamChunk, pendingToolCalls: ToolCallContent[]): AgentEvent | null {
    switch (chunk.type) {
      case 'text':
        return chunk.text ? { type: 'text', text: chunk.text } : null
      case 'tool_call':
        if (chunk.toolCall) pendingToolCalls.push(chunk.toolCall)
        return null
      case 'error':
        return { type: 'error', error: chunk.error ?? 'unknown error' }
      default:
        // 'usage' / 'done' 不产生业务事件
        return null
    }
  }

  /** 构造 llm_error 事件（处理 exactOptionalPropertyTypes） */
  #makeLlmError(error: string, partialTokens: number): AgentEvent {
    return partialTokens > 0
      ? { type: 'llm_error', error, partialOutputTokens: partialTokens }
      : { type: 'llm_error', error }
  }

  /** LLM 调用 catch 分支：区分 abort 和异常 */
  *#handleLLMCatchError(err: unknown, inputTokens: number, outputTokens: number): Generator<AgentEvent> {
    if ((err as Error).name === 'AbortError') {
      yield { type: 'llm_usage', inputTokens, outputTokens, stopReason: 'abort' }
    } else {
      const msg = err instanceof Error ? err.message : String(err)
      yield this.#makeLlmError(msg, outputTokens)
    }
  }

  // ─────────────────────────────────────────────
  // 阶段 2：工具执行（权限 + 执行 + 历史追加）
  // ─────────────────────────────────────────────

  /** 依次执行本轮所有工具调用 */
  async *#executeToolCalls(
    toolCalls: ToolCallContent[],
    history: Message[],
  ): AsyncGenerator<AgentEvent> {
    for (const tc of toolCalls) {
      yield* this.#executeOneTool(tc, history)
    }
  }

  /**
   * 执行单个工具调用。
   *
   * 流程：tool_start → [permission_request → permission_grant] → 执行 → tool_done
   */
  async *#executeOneTool(
    tc: ToolCallContent,
    history: Message[],
  ): AsyncGenerator<AgentEvent> {
    yield { type: 'tool_start', toolName: tc.toolName, toolCallId: tc.toolCallId, args: tc.args }

    // ── 权限检查 ──
    const allowed = yield* this.#checkPermission(tc)
    if (!allowed) {
      history.push({ role: 'user', content: `[Tool ${tc.toolName} was rejected by user]` })
      yield { type: 'tool_done', toolName: tc.toolName, toolCallId: tc.toolCallId, durationMs: 0, success: false, resultSummary: 'rejected by user' }
      return
    }

    // ── 执行 ──
    const start = Date.now()
    const result = await this.#registry.execute(tc.toolName, tc.args, { cwd: process.cwd() })
    const durationMs = Date.now() - start

    // 工具结果追加到历史，供下一轮 LLM 参考
    history.push({
      role: 'user',
      content: result.success
        ? `[Tool ${tc.toolName} result]: ${result.output}`
        : `[Tool ${tc.toolName} error]: ${result.error ?? 'error'}`,
    })

    const resultSummary = result.success
      ? truncate(result.output, RESULT_SUMMARY_MAX_LENGTH)
      : (result.error ?? 'error')

    yield { type: 'tool_done', toolName: tc.toolName, toolCallId: tc.toolCallId, durationMs, success: result.success, resultSummary }
  }

  /**
   * 检查工具权限。
   *
   * 安全工具直接返回 true；危险工具 yield permission_request 暂停等待用户确认。
   */
  async *#checkPermission(tc: ToolCallContent): AsyncGenerator<AgentEvent, boolean> {
    if (!this.#registry.isDangerous(tc.toolName)) {
      return true
    }

    // yield permission_request，暂停 generator 等待调用方 resolve
    let resolvePermission!: (v: boolean) => void
    const permissionPromise = new Promise<boolean>(r => { resolvePermission = r })
    yield { type: 'permission_request', toolName: tc.toolName, args: tc.args, resolve: resolvePermission }
    const allowed = await permissionPromise

    if (allowed) {
      yield { type: 'permission_grant', toolName: tc.toolName, always: false }
    }
    return allowed
  }
}

// ── 工具函数 ──

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

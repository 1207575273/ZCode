// src/observability/token-meter.ts

/**
 * TokenMeter — 独立观察者，订阅 AgentEvent 中的 llm_usage 事件。
 *
 * 职责：
 * - 写入 SQLite usage_logs（四维 token + 费用）
 * - 内聚计价匹配逻辑（查 pricing_rules 表）
 * - 维护会话级累计统计（供 StatusBar 实时读取）
 * - 提供 getTodayStats / getMonthStats 查询接口
 */

import type { Database as DatabaseType } from 'better-sqlite3'
import { getDb } from '@persistence/db.js'
import type { AgentEvent } from '@core/agent-loop.js'

export interface SessionCostStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  totalCost: number
  callCount: number
}

export interface AggregateStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  callCount: number
}

interface PricingRule {
  id: number
  input_price: number
  output_price: number
  cache_read_price: number
  cache_write_price: number
}

export class TokenMeter {
  readonly #db: DatabaseType
  #sessionId: string | null = null
  #provider: string = ''
  #model: string = ''
  #stats: SessionCostStats = TokenMeter.#emptyStats()

  constructor(db?: DatabaseType) {
    this.#db = db ?? getDb()
  }

  /** 绑定到当前会话（submit 时调用） */
  bind(sessionId: string, provider: string, model: string): void {
    if (this.#sessionId !== sessionId) {
      this.#stats = TokenMeter.#emptyStats()
    }
    this.#sessionId = sessionId
    this.#provider = provider
    this.#model = model
  }

  /** 消费 AgentEvent，只处理 llm_usage */
  consume(event: AgentEvent): void {
    if (event.type !== 'llm_usage') return
    if (!this.#sessionId) return

    const rule = this.#matchPricingRule(this.#provider, this.#model)
    const cost = rule
      ? this.#calculateCost(event.inputTokens, event.outputTokens, event.cacheReadTokens, event.cacheWriteTokens, rule)
      : null

    this.#db.prepare(`
      INSERT INTO usage_logs (session_id, timestamp, provider, model, input_tokens, output_tokens, cache_read, cache_write, cost_amount, cost_currency, pricing_rule_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?)
    `).run(
      this.#sessionId,
      new Date().toISOString(),
      this.#provider,
      this.#model,
      event.inputTokens,
      event.outputTokens,
      event.cacheReadTokens,
      event.cacheWriteTokens,
      cost,
      rule?.id ?? null,
    )

    // 累计会话统计
    this.#stats.totalInputTokens += event.inputTokens
    this.#stats.totalOutputTokens += event.outputTokens
    this.#stats.totalCacheReadTokens += event.cacheReadTokens
    this.#stats.totalCacheWriteTokens += event.cacheWriteTokens
    this.#stats.totalCost += cost ?? 0
    this.#stats.callCount++
  }

  /** 当前会话统计（内存累计，无 SQL 查询） */
  getSessionStats(): SessionCostStats {
    return { ...this.#stats }
  }

  /** 今日汇总（SQL 聚合） */
  getTodayStats(): AggregateStats {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const row = this.#db.prepare(`
      SELECT
        COALESCE(SUM(input_tokens), 0) as totalInputTokens,
        COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
        COALESCE(SUM(cost_amount), 0) as totalCost,
        COUNT(*) as callCount
      FROM usage_logs
      WHERE timestamp >= ?
    `).get(today + 'T00:00:00.000Z') as AggregateStats
    return row
  }

  /** 本月汇总（SQL 聚合） */
  getMonthStats(): AggregateStats {
    const month = new Date().toISOString().slice(0, 7) // YYYY-MM
    const row = this.#db.prepare(`
      SELECT
        COALESCE(SUM(input_tokens), 0) as totalInputTokens,
        COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
        COALESCE(SUM(cost_amount), 0) as totalCost,
        COUNT(*) as callCount
      FROM usage_logs
      WHERE timestamp >= ?
    `).get(month + '-01T00:00:00.000Z') as AggregateStats
    return row
  }

  /** 匹配计价规则：provider 精确匹配 + model_pattern 通配符匹配 */
  #matchPricingRule(provider: string, model: string): PricingRule | null {
    const now = new Date().toISOString()
    const rules = this.#db.prepare(`
      SELECT id, model_pattern, input_price, output_price, cache_read_price, cache_write_price
      FROM pricing_rules
      WHERE provider = ?
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to > ?)
      ORDER BY priority DESC, effective_from DESC
    `).all(provider, now, now) as Array<PricingRule & { model_pattern: string }>

    for (const rule of rules) {
      if (this.#matchPattern(rule.model_pattern, model)) {
        return rule
      }
    }
    return null
  }

  /** 简单通配符匹配：仅支持末尾 * */
  #matchPattern(pattern: string, value: string): boolean {
    if (pattern === '*') return true
    if (pattern.endsWith('*')) {
      return value.startsWith(pattern.slice(0, -1))
    }
    return pattern === value
  }

  /** 四维费用计算 */
  #calculateCost(input: number, output: number, cacheRead: number, cacheWrite: number, rule: PricingRule): number {
    return (
      input * rule.input_price +
      output * rule.output_price +
      cacheRead * rule.cache_read_price +
      cacheWrite * rule.cache_write_price
    ) / 1_000_000
  }

  static #emptyStats(): SessionCostStats {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalCost: 0,
      callCount: 0,
    }
  }
}

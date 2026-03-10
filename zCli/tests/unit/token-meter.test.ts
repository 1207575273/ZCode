import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TokenMeter } from '@observability/token-meter.js'
import { createDb } from '@persistence/db.js'
import type { AgentEvent } from '@core/agent-loop.js'
import type { Database } from 'better-sqlite3'

let tempDir: string
let db: Database

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'token-meter-test-'))
  db = createDb(join(tempDir, 'test.db'))
})

afterEach(() => {
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('TokenMeter.consume', () => {
  it('should_write_usage_log_on_llm_usage', () => {
    const meter = new TokenMeter(db)
    meter.bind('session-1', 'anthropic', 'claude-opus-4-6')

    const event: AgentEvent = {
      type: 'llm_usage', inputTokens: 1000, outputTokens: 200,
      cacheReadTokens: 500, cacheWriteTokens: 0, stopReason: 'end_turn',
    }
    meter.consume(event)

    const rows = db.prepare('SELECT * FROM usage_logs').all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0]!.input_tokens).toBe(1000)
    expect(rows[0]!.output_tokens).toBe(200)
    expect(rows[0]!.cache_read).toBe(500)
  })

  it('should_calculate_cost_with_matching_pricing_rule', () => {
    const meter = new TokenMeter(db)
    meter.bind('session-1', 'anthropic', 'claude-opus-4-6')

    const event: AgentEvent = {
      type: 'llm_usage', inputTokens: 1_000_000, outputTokens: 100_000,
      cacheReadTokens: 0, cacheWriteTokens: 0, stopReason: 'end_turn',
    }
    meter.consume(event)

    const row = db.prepare('SELECT cost_amount FROM usage_logs').get() as { cost_amount: number }
    // claude-opus-4-* : input $15/M + output $75/M = 15 + 7.5 = 22.5
    expect(row.cost_amount).toBeCloseTo(22.5, 1)
  })

  it('should_set_null_cost_when_no_pricing_rule_matches', () => {
    const meter = new TokenMeter(db)
    meter.bind('session-1', 'unknown-provider', 'unknown-model')

    const event: AgentEvent = {
      type: 'llm_usage', inputTokens: 100, outputTokens: 50,
      cacheReadTokens: 0, cacheWriteTokens: 0, stopReason: 'end_turn',
    }
    meter.consume(event)

    const row = db.prepare('SELECT cost_amount FROM usage_logs').get() as { cost_amount: number | null }
    expect(row.cost_amount).toBeNull()
  })

  it('should_ignore_non_llm_usage_events', () => {
    const meter = new TokenMeter(db)
    meter.bind('session-1', 'anthropic', 'claude-opus-4-6')

    meter.consume({ type: 'text', text: 'hello' })
    meter.consume({ type: 'done' })
    meter.consume({ type: 'error', error: 'oops' })

    const rows = db.prepare('SELECT * FROM usage_logs').all()
    expect(rows).toHaveLength(0)
  })
})

describe('TokenMeter.getSessionStats', () => {
  it('should_accumulate_tokens_and_cost', () => {
    const meter = new TokenMeter(db)
    meter.bind('session-1', 'anthropic', 'claude-opus-4-6')

    meter.consume({ type: 'llm_usage', inputTokens: 1000, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0, stopReason: 'end_turn' })
    meter.consume({ type: 'llm_usage', inputTokens: 500, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, stopReason: 'end_turn' })

    const stats = meter.getSessionStats()
    expect(stats.totalInputTokens).toBe(1500)
    expect(stats.totalOutputTokens).toBe(300)
    expect(stats.callCount).toBe(2)
    expect(stats.totalCost).toBeGreaterThan(0)
  })
})

describe('TokenMeter.getTodayStats', () => {
  it('should_query_today_usage_from_sqlite', () => {
    const meter = new TokenMeter(db)
    meter.bind('session-1', 'anthropic', 'claude-opus-4-6')

    meter.consume({ type: 'llm_usage', inputTokens: 1000, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0, stopReason: 'end_turn' })

    const stats = meter.getTodayStats()
    expect(stats.totalInputTokens).toBe(1000)
    expect(stats.totalOutputTokens).toBe(200)
  })
})

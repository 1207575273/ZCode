// tests/unit/session-store.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SessionStore } from '@persistence/session-store'
import type { SessionEvent } from '@persistence/session-types'
import { toProjectSlug, generateEventId } from '@persistence/session-utils'

let tempDir: string
let store: SessionStore

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'session-store-test-'))
  store = new SessionStore(tempDir)
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('SessionStore.create', () => {
  it('should_create_session_and_write_session_start_event', () => {
    const cwd = '/tmp/test-project'
    const sessionId = store.create(cwd, 'anthropic', 'claude-opus-4-20250514')

    expect(sessionId).toBeTruthy()
    expect(typeof sessionId).toBe('string')

    // Verify the JSONL file contains a session_start event
    const snapshot = store.loadMessages(sessionId)
    expect(snapshot.sessionId).toBe(sessionId)
    expect(snapshot.provider).toBe('anthropic')
    expect(snapshot.model).toBe('claude-opus-4-20250514')
    expect(snapshot.cwd).toBe(cwd)
    expect(snapshot.messages).toEqual([])
  })

  it('should_create_jsonl_in_correct_project_subdirectory', () => {
    const cwd = '/home/user/my-project'
    const sessionId = store.create(cwd, 'openai', 'gpt-4')

    const projectSlug = toProjectSlug(cwd)
    const projectDir = join(tempDir, projectSlug)

    // The project directory should contain exactly one JSONL file
    const { readdirSync } = require('node:fs')
    const files = readdirSync(projectDir) as string[]
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^\d{17}_.+\.jsonl$/)
    expect(files[0]).toContain(sessionId)
  })
})

describe('SessionStore.append + loadMessages', () => {
  it('should_round_trip_user_and_assistant_messages', () => {
    const cwd = '/tmp/test-project'
    const sessionId = store.create(cwd, 'anthropic', 'claude-opus-4-20250514')

    const userEvent: SessionEvent = {
      sessionId,
      type: 'user',
      timestamp: new Date().toISOString(),
      uuid: generateEventId(),
      parentUuid: null,
      cwd,
      message: { role: 'user', content: 'Hello, world!' },
    }
    store.append(sessionId, userEvent)

    const assistantEvent: SessionEvent = {
      sessionId,
      type: 'assistant',
      timestamp: new Date().toISOString(),
      uuid: generateEventId(),
      parentUuid: userEvent.uuid,
      cwd,
      message: { role: 'assistant', content: 'Hi there!' },
    }
    store.append(sessionId, assistantEvent)

    const snapshot = store.loadMessages(sessionId)
    expect(snapshot.messages).toHaveLength(2)
    expect(snapshot.messages[0]).toEqual({
      id: userEvent.uuid,
      role: 'user',
      content: 'Hello, world!',
    })
    expect(snapshot.messages[1]).toEqual({
      id: assistantEvent.uuid,
      role: 'assistant',
      content: 'Hi there!',
    })
  })

  it('should_skip_system_and_tool_events_in_loadMessages', () => {
    const cwd = '/tmp/test-project'
    const sessionId = store.create(cwd, 'anthropic', 'claude-opus-4-20250514')

    // Add a user message
    store.append(sessionId, {
      sessionId,
      type: 'user',
      timestamp: new Date().toISOString(),
      uuid: generateEventId(),
      parentUuid: null,
      cwd,
      message: { role: 'user', content: 'Run a tool' },
    })

    // Add a system event — should be skipped
    store.append(sessionId, {
      sessionId,
      type: 'system',
      timestamp: new Date().toISOString(),
      uuid: generateEventId(),
      parentUuid: null,
      cwd,
      message: { role: 'system', content: 'System prompt' },
    })

    // Add a tool_call event — should be skipped
    store.append(sessionId, {
      sessionId,
      type: 'tool_call',
      timestamp: new Date().toISOString(),
      uuid: generateEventId(),
      parentUuid: null,
      cwd,
      toolCallId: 'tc_1',
      toolName: 'bash',
      args: { command: 'ls' },
    })

    // Add a tool_result event — should be skipped
    store.append(sessionId, {
      sessionId,
      type: 'tool_result',
      timestamp: new Date().toISOString(),
      uuid: generateEventId(),
      parentUuid: null,
      cwd,
      toolCallId: 'tc_1',
      result: 'file1.txt\nfile2.txt',
    })

    // Add an assistant message
    store.append(sessionId, {
      sessionId,
      type: 'assistant',
      timestamp: new Date().toISOString(),
      uuid: generateEventId(),
      parentUuid: null,
      cwd,
      message: { role: 'assistant', content: 'Done!' },
    })

    const snapshot = store.loadMessages(sessionId)
    expect(snapshot.messages).toHaveLength(2)
    expect(snapshot.messages[0]!.role).toBe('user')
    expect(snapshot.messages[1]!.role).toBe('assistant')
  })

  it('should_restore_provider_and_model_from_session_start_event', () => {
    const cwd = '/tmp/test-project'
    const sessionId = store.create(cwd, 'anthropic', 'claude-opus-4-20250514')

    const snapshot = store.loadMessages(sessionId)
    expect(snapshot.provider).toBe('anthropic')
    expect(snapshot.model).toBe('claude-opus-4-20250514')
  })
})

describe('SessionStore.list', () => {
  function createSessionWithMessage(
    store: SessionStore,
    cwd: string,
    provider: string,
    model: string,
    userMessage: string,
    timestamp?: string,
  ): string {
    const sessionId = store.create(cwd, provider, model)
    const ts = timestamp ?? new Date().toISOString()
    store.append(sessionId, {
      sessionId,
      type: 'user',
      timestamp: ts,
      uuid: generateEventId(),
      parentUuid: null,
      cwd,
      message: { role: 'user', content: userMessage },
    })
    return sessionId
  }

  it('should_list_sessions_for_specific_project', () => {
    const cwd = '/tmp/project-a'
    createSessionWithMessage(store, cwd, 'anthropic', 'claude', 'Hello A')
    createSessionWithMessage(store, '/tmp/project-b', 'anthropic', 'claude', 'Hello B')

    const slug = toProjectSlug(cwd)
    const result = store.list({ projectSlug: slug })

    expect(result).toHaveLength(1)
    expect(result[0]!.projectSlug).toBe(slug)
    expect(result[0]!.firstMessage).toBe('Hello A')
  })

  it('should_list_all_projects_when_no_slug_specified', () => {
    createSessionWithMessage(store, '/tmp/project-a', 'anthropic', 'claude', 'Hello A')
    createSessionWithMessage(store, '/tmp/project-b', 'openai', 'gpt-4', 'Hello B')

    const result = store.list()

    expect(result).toHaveLength(2)
    // Both project slugs should be present
    const slugs = result.map((s) => s.projectSlug)
    expect(slugs).toContain(toProjectSlug('/tmp/project-a'))
    expect(slugs).toContain(toProjectSlug('/tmp/project-b'))
  })

  it('should_respect_limit', () => {
    for (let i = 0; i < 5; i++) {
      createSessionWithMessage(store, '/tmp/project', 'anthropic', 'claude', `Message ${i}`)
    }

    const result = store.list({ limit: 3 })
    expect(result).toHaveLength(3)
  })

  it('should_extract_firstMessage_from_jsonl', () => {
    const longMessage = 'A'.repeat(100)
    createSessionWithMessage(store, '/tmp/project', 'anthropic', 'claude', longMessage)

    const result = store.list()
    expect(result).toHaveLength(1)
    // Should be truncated to 80 chars + "..."
    expect(result[0]!.firstMessage).toBe('A'.repeat(80) + '...')
  })

  it('should_sort_by_updatedAt_descending', () => {
    const id1 = createSessionWithMessage(
      store, '/tmp/project', 'anthropic', 'claude', 'First',
      '2025-01-01T00:00:00.000Z',
    )
    const id2 = createSessionWithMessage(
      store, '/tmp/project', 'anthropic', 'claude', 'Second',
      '2025-06-01T00:00:00.000Z',
    )
    const id3 = createSessionWithMessage(
      store, '/tmp/project', 'anthropic', 'claude', 'Third',
      '2025-03-01T00:00:00.000Z',
    )

    const result = store.list()
    expect(result).toHaveLength(3)
    // id2 (June) should be first, id3 (March) second, id1 (Jan) third
    expect(result[0]!.sessionId).toBe(id2)
    expect(result[1]!.sessionId).toBe(id3)
    expect(result[2]!.sessionId).toBe(id1)
  })
})

describe('SessionStore.cleanup', () => {
  it('should_delete_files_older_than_retention_days', () => {
    const cwd = '/tmp/project'
    const sessionId = store.create(cwd, 'anthropic', 'claude')

    // Manually set file mtime to 60 days ago
    const filePath = store.list()[0]!.filePath
    const { utimesSync } = require('node:fs')
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    utimesSync(filePath, oldDate, oldDate)

    store.cleanup(30)

    const remaining = store.list()
    expect(remaining).toHaveLength(0)
  })
})

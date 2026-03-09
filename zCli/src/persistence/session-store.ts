// src/persistence/session-store.ts

import {
  mkdirSync,
  readFileSync,
  appendFileSync,
  readdirSync,
  statSync,
  rmSync,
  existsSync,
} from 'node:fs'
import { join, basename } from 'node:path'
import type { SessionEvent, SessionSnapshot, SessionSummary } from './session-types.js'
import {
  toProjectSlug,
  generateSessionId,
  generateEventId,
  formatSessionFilename,
  extractSessionId,
  getGitBranch,
} from './session-utils.js'

const DEFAULT_LIST_LIMIT = 10
const DEFAULT_RETENTION_DAYS = 30
const FIRST_MESSAGE_MAX_LENGTH = 80

export class SessionStore {
  readonly baseDir: string
  #pathCache = new Map<string, string>()

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  /** Create a new session, write session_start event, return sessionId */
  create(cwd: string, provider: string, model: string): string {
    const sessionId = generateSessionId()
    const projectSlug = toProjectSlug(cwd)
    const projectDir = join(this.baseDir, projectSlug)
    mkdirSync(projectDir, { recursive: true })

    const filename = formatSessionFilename(sessionId)
    const filePath = join(projectDir, filename)

    const gitBranch = getGitBranch(cwd)
    const eventId = generateEventId()

    const event: SessionEvent = {
      sessionId,
      type: 'session_start',
      timestamp: new Date().toISOString(),
      uuid: eventId,
      parentUuid: null,
      cwd,
      gitBranch,
      provider,
      model,
    }

    appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf-8')
    this.#pathCache.set(sessionId, filePath)

    return sessionId
  }

  /** Append an event line to the session's JSONL file */
  append(sessionId: string, event: SessionEvent): void {
    const filePath = this.#resolveFilePath(sessionId)
    if (!filePath) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf-8')
  }

  /** Read JSONL, extract user/assistant text messages, return snapshot */
  loadMessages(sessionId: string): SessionSnapshot {
    const filePath = this.#resolveFilePath(sessionId)
    if (!filePath) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    let provider = ''
    let model = ''
    let cwd = ''
    const messages: SessionSnapshot['messages'] = []

    for (const line of lines) {
      const event = JSON.parse(line) as SessionEvent

      // Extract provider/model from session_start or session_resume (last one wins)
      if (event.type === 'session_start' || event.type === 'session_resume') {
        if (event.provider) provider = event.provider
        if (event.model) model = event.model
        if (event.cwd) cwd = event.cwd
      }

      // Only extract user/assistant events with string content
      if (
        (event.type === 'user' || event.type === 'assistant') &&
        event.message &&
        typeof event.message.content === 'string'
      ) {
        messages.push({
          id: event.uuid,
          role: event.type,
          content: event.message.content,
        })
      }
    }

    return { sessionId, provider, model, cwd, messages }
  }

  /** List sessions, optionally filtered by projectSlug, sorted by updatedAt desc */
  list(options?: { projectSlug?: string; limit?: number }): SessionSummary[] {
    const limit = options?.limit ?? DEFAULT_LIST_LIMIT
    const slugs = options?.projectSlug
      ? [options.projectSlug]
      : this.#listProjectSlugs()

    const summaries: SessionSummary[] = []

    for (const slug of slugs) {
      const projectDir = join(this.baseDir, slug)
      if (!existsSync(projectDir)) continue

      let entries: string[]
      try {
        entries = readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'))
      } catch {
        continue
      }

      for (const entry of entries) {
        const filePath = join(projectDir, entry)
        const sessionId = extractSessionId(entry)

        // Cache for future lookups
        this.#pathCache.set(sessionId, filePath)

        const stat = statSync(filePath)
        const extracted = this.#extractSummary(filePath)

        summaries.push({
          sessionId,
          projectSlug: slug,
          firstMessage: extracted.firstMessage,
          updatedAt: extracted.updatedAt || stat.mtime.toISOString(),
          gitBranch: extracted.gitBranch,
          fileSize: stat.size,
          filePath,
        })
      }
    }

    // Sort by updatedAt descending
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return summaries.slice(0, limit)
  }

  /** Delete JSONL files older than retentionDays */
  cleanup(retentionDays: number = DEFAULT_RETENTION_DAYS): void {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    const slugs = this.#listProjectSlugs()

    for (const slug of slugs) {
      const projectDir = join(this.baseDir, slug)
      let entries: string[]
      try {
        entries = readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'))
      } catch {
        continue
      }

      for (const entry of entries) {
        const filePath = join(projectDir, entry)
        try {
          const stat = statSync(filePath)
          if (stat.mtime.getTime() < cutoff) {
            rmSync(filePath)
            // Remove from cache
            const sessionId = extractSessionId(entry)
            this.#pathCache.delete(sessionId)
          }
        } catch {
          // File may have been deleted concurrently, skip
        }
      }

      // Remove empty project directories
      try {
        const remaining = readdirSync(projectDir)
        if (remaining.length === 0) {
          rmSync(projectDir, { recursive: true })
        }
      } catch {
        // Ignore
      }
    }
  }

  /** Extract firstMessage, updatedAt, gitBranch from JSONL content */
  #extractSummary(filePath: string): {
    firstMessage: string
    updatedAt: string
    gitBranch: string
  } {
    let firstMessage = ''
    let updatedAt = ''
    let gitBranch = 'unknown'

    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)

      for (const line of lines) {
        const event = JSON.parse(line) as SessionEvent

        // Track latest timestamp
        if (event.timestamp) {
          updatedAt = event.timestamp
        }

        // Extract gitBranch from first event that has it
        if (event.gitBranch && gitBranch === 'unknown') {
          gitBranch = event.gitBranch
        }

        // Extract first user message
        if (
          !firstMessage &&
          event.type === 'user' &&
          event.message &&
          typeof event.message.content === 'string'
        ) {
          firstMessage =
            event.message.content.length > FIRST_MESSAGE_MAX_LENGTH
              ? event.message.content.slice(0, FIRST_MESSAGE_MAX_LENGTH) + '...'
              : event.message.content
        }
      }
    } catch {
      // Corrupted file, return defaults
    }

    return { firstMessage, updatedAt, gitBranch }
  }

  /** Find JSONL file by sessionId — cache first, then scan directories */
  #resolveFilePath(sessionId: string): string | undefined {
    const cached = this.#pathCache.get(sessionId)
    if (cached && existsSync(cached)) {
      return cached
    }

    // Scan all project directories
    const slugs = this.#listProjectSlugs()
    for (const slug of slugs) {
      const projectDir = join(this.baseDir, slug)
      let entries: string[]
      try {
        entries = readdirSync(projectDir)
      } catch {
        continue
      }

      for (const entry of entries) {
        if (extractSessionId(entry) === sessionId) {
          const filePath = join(projectDir, entry)
          this.#pathCache.set(sessionId, filePath)
          return filePath
        }
      }
    }

    return undefined
  }

  /** List subdirectories (project slugs) under baseDir */
  #listProjectSlugs(): string[] {
    if (!existsSync(this.baseDir)) return []

    try {
      return readdirSync(this.baseDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch {
      return []
    }
  }
}

/** One line of the roadmap's "Owner's queue" tables. */
export type QueueItem = {
  kind: 'ruling' | 'action'
  since: string
  text: string
  where: string
}

/** One `▶ … inbox` note as `tools/inbox.py <REPO>` listed it. */
export type InboxNote = {
  state: 'open' | 'partial' | 'picked up'
  /** `roadmap.md:357` — the file and line the note sits at, as `tools/inbox.py` printed it. */
  where: string
  /** The date it was filed, `YYYY-MM-DD`, or `?` when the note carries none. */
  filed: string
  /** Days since it was filed, or null when the date is unknown. */
  age: number | null
  /** The note's heading, after `▶`. */
  title: string
  /** The partial pick-up line, when there is one. */
  pickup: string | null
}

/** What `tools/inbox.py <REPO>` printed: its notes, and the raw lines as a fallback. */
export type Inbox = {
  lines: string[]
  notes: InboxNote[]
  open: number
  partial: number
}

/** The desk as last read: where it read, when, and what it found. */
export type Desk = {
  repo: string
  hub: string
  readAt: string
  inbox: Inbox | null
  queue: QueueItem[]
  error: string | null
  isBusy: boolean
}

/** One inbox note opened from the desk: where it is in the hub, and its text as read there. */
export type NoteView = {
  /** `where` as the inbox listed it, e.g. `roadmap.md:357`. */
  where: string
  title: string
  /** The file, relative to the hub checkout. */
  path: string
  /** The 1-based line the note starts at; 1 for a one-note file. */
  line: number
  /** The note's own text — from its heading to the next heading — or why it could not be read. */
  text: string
}

declare module 'claude-code' {
  interface PluginState {
    'hub-desk': { desk: Desk | null; note: NoteView | null }
  }
}

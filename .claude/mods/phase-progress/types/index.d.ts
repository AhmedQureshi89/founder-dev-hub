/** The boxes of one verification.md, or of one section of it. */
export type BoxCount = {
  /** `- [x]` — ticked. */
  done: number
  /** `- [ ]` — not ticked. */
  open: number
  /** `- [~]` (any mark but `x` and a space) — marked, not ticked; counted as still to go. */
  partial: number
  /** `- [ ] ~~…~~` — struck through: a record kept on purpose, never work; left out of the total. */
  setAside: number
  /** Boxes that are 🚦 verdict gates (`VERDICT GATE` in the line, or the line opens with 🚦). */
  gates: number
  /** Of those, the ticked ones. */
  gatesDone: number
}

/** The boxes under one `##` or `###` heading, up to the next one. */
export type SectionCount = {
  heading: string
  count: BoxCount
}

/** One verification.md, counted. */
export type PhaseCount = {
  /** The `#` heading, without its leading "Phase N Verification —". */
  title: string
  total: BoxCount
  /** In file order; only the sections that hold a box. */
  sections: SectionCount[]
}

/** One commit on the default branch's first-parent line that changed the phase's verification.md. */
export type MergeStep = {
  sha: string
  /** Committer date, ISO 8601 with the committer's offset. */
  at: string
  /** The pull request's number, read from the merge commit's subject; null for a direct commit. */
  pr: number | null
  title: string
  /** Boxes ticked, and their total, as that commit left them. */
  done: number
  total: number
  /** `done` minus the commit before it — the ticks this merge brought (negative: ticks removed). */
  delta: number
}

/** The phase as last read. */
export type Progress = {
  /** The session's working tree, where git runs. */
  root: string
  /** The id prefix of this repository as hub.json names it (WEB, API or JOB in the example hub), by the main working tree's folder name; HUB for the hub itself and for a folder hub.json does not list. */
  lane: string
  branch: string
  /** The default branch, `main` or `master`. */
  base: string
  /** What was counted: `refs/remotes/origin/<base>`, or `HEAD` where there is no origin. */
  tipRef: string
  tip: string
  readAt: string
  /** The phase folder, e.g. `phase-5`; null when the repo has none. */
  phase: string | null
  /** How the phase is named on screen: `JOB-5`, `API-4.7`; the folder name in the hub. */
  id: string
  /** `specs/phase-5/verification.md`. */
  path: string | null
  /** Why this phase: pinned, named by the branch, or changed last. */
  reason: string
  /** Counted at `tip` — what is merged. Null while the phase exists only on this branch. */
  merged: PhaseCount | null
  /** Counted in the working tree — what this branch holds. */
  local: PhaseCount | null
  /** Newest first. */
  history: MergeStep[]
  /** Every phase folder found, for the command's answer. */
  phases: string[]
  /** A read that half-worked: origin unreachable, a pin that names nothing. */
  warning: string | null
  error: string | null
  isBusy: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'phase-progress': { progress: Progress | null }
  }
}

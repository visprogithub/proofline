import type { DiffEvidence, DiffEvidenceHunk, DiffEvidenceLine } from './types'

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/** Parses one GitHub or unified-diff patch into line-addressable evidence provenance. */
export function parseDiffEvidence(path: string, patch: string | undefined): DiffEvidence {
  if (patch === undefined) return { availability: 'patch-unavailable', path, hunks: [] }

  const hunks: DiffEvidenceHunk[] = []
  let hunk: DiffEvidenceHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const rawLine of patch.replaceAll('\r\n', '\n').split('\n')) {
    const header = HUNK_HEADER.exec(rawLine)
    if (header?.[1] && header[2]) {
      oldLine = Number(header[1])
      newLine = Number(header[2])
      hunk = {
        id: `${path}:hunk-${hunks.length + 1}`,
        header: rawLine,
        oldStart: oldLine,
        newStart: newLine,
        lines: [],
      }
      hunks.push(hunk)
      continue
    }
    if (!hunk || rawLine.startsWith('\\ No newline at end of file')) continue

    let line: DiffEvidenceLine | null = null
    const id = `${hunk.id}:line-${hunk.lines.length + 1}`
    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      line = { id, content: rawLine.slice(1), change: 'added', newLine }
      newLine += 1
    } else if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      line = { id, content: rawLine.slice(1), change: 'deleted', oldLine }
      oldLine += 1
    } else if (rawLine.startsWith(' ')) {
      line = { id, content: rawLine.slice(1), change: 'context', oldLine, newLine }
      oldLine += 1
      newLine += 1
    }
    if (line) hunk.lines.push(line)
  }

  return { availability: 'available', path, hunks }
}

/** Returns the hunk containing a normalized diff line. */
export function findEvidenceHunk(diff: DiffEvidence, lineId: string): DiffEvidenceHunk | undefined {
  return diff.hunks.find(({ lines }) => lines.some(({ id }) => id === lineId))
}

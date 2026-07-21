import type { ChangedLine } from '../../domain/integrity/types'
import type { PullRequestFile } from '../../integrations/github/types'
import { parseDiffEvidence } from '../../domain/evidence/diff-evidence'

/**
 * Converts one unified patch fragment into normalized changed-line evidence.
 *
 * Unchanged hunk context is retained alongside added lines so the interpreted integrity
 * pass can see the surrounding code. The deterministic scanner filters to added lines,
 * so retaining context does not affect its findings or its scanned-line count.
 */
export function changedLinesFromPatch(path: string, patch: string | undefined): ChangedLine[] {
  const diff = parseDiffEvidence(path, patch)
  return diff.hunks.flatMap(({ lines }) => lines.flatMap((line): ChangedLine[] => {
    if (line.change === 'added') {
      return [{ path, line: line.newLine ?? 0, content: line.content, change: 'added' as const }]
    }
    if (line.change === 'context') {
      return [{ path, line: line.newLine ?? 0, content: line.content, change: 'context' as const }]
    }
    return []
  }))
}

/** Converts GitHub unified patch fragments into normalized changed-line evidence. */
export function changedLinesFromFiles(files: PullRequestFile[]): ChangedLine[] {
  return files.flatMap((file) => changedLinesFromPatch(file.filename, file.patch))
}

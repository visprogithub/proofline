import type { ChangedLine } from '../../domain/integrity/types'
import type { PullRequestFile } from '../../integrations/github/types'
import { parseDiffEvidence } from '../../domain/evidence/diff-evidence'

/** Converts one unified patch fragment into normalized added-line evidence. */
export function changedLinesFromPatch(path: string, patch: string | undefined): ChangedLine[] {
  const diff = parseDiffEvidence(path, patch)
  return diff.hunks.flatMap(({ lines }) => lines.flatMap((line) => (
    line.change === 'added'
      ? [{ path, line: line.newLine ?? 0, content: line.content, change: 'added' as const }]
      : []
  )))
}

/** Converts GitHub unified patch fragments into normalized added-line evidence. */
export function changedLinesFromFiles(files: PullRequestFile[]): ChangedLine[] {
  return files.flatMap((file) => changedLinesFromPatch(file.filename, file.patch))
}

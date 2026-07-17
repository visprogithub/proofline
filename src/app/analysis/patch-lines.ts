import type { ChangedLine } from '../../domain/integrity/types'
import type { PullRequestFile } from '../../integrations/github/types'

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/** Converts GitHub unified patch fragments into normalized added-line evidence. */
export function changedLinesFromFiles(files: PullRequestFile[]): ChangedLine[] {
  return files.flatMap((file) => {
    if (!file.patch) return []
    const changed: ChangedLine[] = []
    let newLine = 0

    for (const content of file.patch.split('\n')) {
      const hunk = HUNK.exec(content)
      if (hunk?.[1]) {
        newLine = Number(hunk[1])
        continue
      }
      if (content.startsWith('+++') || content.startsWith('---')) continue
      if (content.startsWith('+')) {
        changed.push({ path: file.filename, line: newLine, content: content.slice(1), change: 'added' })
        newLine += 1
      } else if (!content.startsWith('-')) {
        newLine += 1
      }
    }
    return changed
  })
}

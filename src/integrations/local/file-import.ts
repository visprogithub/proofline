import type { OperationalLimits } from '../../config/limits'
import { DEFAULT_LIMITS, formatByteLimit } from '../../config/limits'

export type LocalFileKind = 'requirements' | 'diff' | 'junit'

const EXTENSIONS: Record<LocalFileKind, RegExp> = {
  requirements: /\.(?:md|mdx|txt|rst|adoc)$/i,
  diff: /\.(?:diff|patch)$/i,
  junit: /\.xml$/i,
}

/** Classifies one supported local evidence file by its extension. */
export function classifyLocalFile(file: Pick<File, 'name'>): LocalFileKind | null {
  for (const [kind, pattern] of Object.entries(EXTENSIONS) as [LocalFileKind, RegExp][]) {
    if (pattern.test(file.name)) return kind
  }
  return null
}

/** Reads one bounded supported file as UTF-8 text without persisting its content. */
export async function readLocalTextFile(
  file: File,
  limits: OperationalLimits = DEFAULT_LIMITS,
): Promise<{ kind: LocalFileKind; name: string; text: string }> {
  const kind = classifyLocalFile(file)
  if (!kind) throw new Error(`Unsupported file type: ${file.name}`)
  if (file.size > limits.maxLocalImportBytes) {
    throw new Error(`${file.name} exceeds the configured ${formatByteLimit(limits.maxLocalImportBytes)} local import limit.`)
  }
  const text = await file.text()
  if (text.includes('\u0000')) throw new Error(`${file.name} does not appear to be a UTF-8 text file.`)
  return { kind, name: file.name, text }
}

/** Reads a small local evidence bundle and rejects duplicate file roles. */
export async function readLocalBundle(
  files: File[],
  limits: OperationalLimits = DEFAULT_LIMITS,
): Promise<Partial<Record<LocalFileKind, { name: string; text: string }>>> {
  const bundle: Partial<Record<LocalFileKind, { name: string; text: string }>> = {}
  for (const file of files) {
    const result = await readLocalTextFile(file, limits)
    if (bundle[result.kind]) throw new Error(`Choose only one ${result.kind} file per analysis.`)
    bundle[result.kind] = { name: result.name, text: result.text }
  }
  return bundle
}

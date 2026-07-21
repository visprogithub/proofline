import type { OperationalLimits } from '../../config/limits'
import { DEFAULT_LIMITS } from '../../config/limits'
import { SkepticServiceError, type IntegrityInterpreter } from '../../domain/evidence/model-provider'
import { scanOutboundText } from '../../domain/evidence/outbound-safety'
import { isSourcePath } from '../../domain/integrity/changed-line-scanner'
import {
  createInterpretedFinding,
  isReportableVerdict,
  type IntegrityBatch,
  type InterpretedCitedLine,
  type InterpretedFinding,
  type InterpretedIntegrityRun,
} from '../../domain/integrity/interpreted-findings'
import type { AnalysisCase } from './types'

const MAX_BATCH_CHARS = 6_000
const MAX_BATCH_LINES = 60

function normalize(path: string): string {
  return path.replaceAll('\\', '/')
}

function lineId(path: string, line: number): string {
  return `${path}:${line}`
}

/**
 * Groups every added source line into bounded per-file batches. The interpreted pass
 * reads all changed lines, not only the excerpts linked to a requirement.
 */
export function buildIntegrityBatches(
  analysis: AnalysisCase,
  limits: OperationalLimits = DEFAULT_LIMITS,
): IntegrityBatch[] {
  const byPath = new Map<string, InterpretedCitedLine[]>()
  for (const changed of analysis.changedLines ?? []) {
    if (changed.change !== 'added') continue
    const path = normalize(changed.path)
    if (!isSourcePath(path)) continue
    const lines = byPath.get(path) ?? []
    lines.push({ id: lineId(path, changed.line), content: changed.content, sourceLine: changed.line })
    byPath.set(path, lines)
  }

  const batches: IntegrityBatch[] = []
  for (const [path, lines] of byPath) {
    let current: InterpretedCitedLine[] = []
    let characters = 0
    for (const line of lines) {
      if (current.length >= MAX_BATCH_LINES || characters + line.content.length > MAX_BATCH_CHARS) {
        batches.push({ id: `integrity:${path}:${batches.length}`, path, lines: current })
        current = []
        characters = 0
      }
      current.push(line)
      characters += line.content.length
    }
    if (current.length) batches.push({ id: `integrity:${path}:${batches.length}`, path, lines: current })
  }
  return batches.slice(0, limits.maxHostedAssessments)
}

function batchText(batch: IntegrityBatch): string {
  return batch.lines.map(({ content }) => content).join('\n')
}

/**
 * Runs the optional advisory integrity pass over all changed source lines. Findings the
 * deterministic scanner already reports are dropped so this lane only adds new signal.
 * Deterministic findings and requirement evidence states are never modified.
 */
export async function interpretIntegrity(
  analysis: AnalysisCase,
  interpreter: IntegrityInterpreter,
  signal?: AbortSignal,
  limits: OperationalLimits = DEFAULT_LIMITS,
): Promise<AnalysisCase> {
  const eligible: IntegrityBatch[] = []
  let skipped = 0
  for (const batch of buildIntegrityBatches(analysis, limits)) {
    if (scanOutboundText(batchText(batch)).length) {
      skipped += 1
      continue
    }
    eligible.push(batch)
  }

  const alreadyFlagged = new Set(
    analysis.integrity.findings.map(({ path, line }) => lineId(normalize(path), line)),
  )

  const findings: InterpretedFinding[] = []
  let interpreted = 0
  let duplicates = 0
  let serviceError: SkepticServiceError | undefined
  let halted = false
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < eligible.length) {
      const batch = eligible[cursor]
      cursor += 1
      if (!batch) continue
      if (halted || signal?.aborted) {
        skipped += 1
        continue
      }
      try {
        const response = await interpreter.interpret(batch, signal)
        interpreted += 1
        if (!isReportableVerdict(response.result.verdict)) continue
        const byId = new Map(batch.lines.map((line) => [line.id, line]))
        const citedLines = response.result.citedLineIds.flatMap((id) => {
          const line = byId.get(id)
          return line ? [line] : []
        })
        if (citedLines.length && citedLines.every(({ id }) => alreadyFlagged.has(id))) {
          duplicates += 1
          continue
        }
        findings.push(createInterpretedFinding({
          verdict: response.result.verdict,
          contextId: batch.id,
          path: batch.path,
          rationale: response.result.rationale,
          citedLines,
          provenance: response.provenance,
        }))
      } catch (error) {
        skipped += 1
        if (error instanceof SkepticServiceError) {
          serviceError ??= error
          if (
            error.code === 'client-daily-limit'
            || error.code === 'global-daily-limit'
            || error.code === 'global-token-limit'
            || error.code === 'service-unavailable'
          ) halted = true
        }
      }
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(limits.maxAiConcurrency, eligible.length) },
    () => worker(),
  ))

  const run: InterpretedIntegrityRun = {
    findings,
    interpreted,
    skipped,
    duplicatesDropped: duplicates,
    ...(serviceError
      ? {
        message: serviceError.message,
        ...(serviceError.resetAt ? { resetAt: serviceError.resetAt } : {}),
      }
      : {}),
  }
  return { ...analysis, interpretedIntegrity: run }
}

import type { OperationalLimits } from '../../config/limits'
import { DEFAULT_LIMITS } from '../../config/limits'
import {
  haltsRemainingWork,
  SkepticServiceError,
  type IntegrityInterpreter,
} from '../../domain/evidence/model-provider'
import { runBounded } from './bounded-run'
import { scanOutboundText } from '../../domain/evidence/outbound-safety'
import { isSourcePath, normalizePath } from '../../domain/integrity/changed-line-scanner'
import {
  createInterpretedFinding,
  isReportableVerdict,
  type IntegrityBatch,
  type InterpretedCitedLine,
  type InterpretedFinding,
  type InterpretedIntegrityRun,
} from '../../domain/integrity/interpreted-findings'
import type { AnalysisCase } from './types'

function lineId(path: string, line: number): string {
  return `${path}:${line}`
}

/**
 * Groups every added source line into bounded per-file batches. No per-run ceiling is
 * applied here; callers decide how many batches they can afford to send.
 */
export function buildIntegrityBatches(
  analysis: AnalysisCase,
  limits: OperationalLimits = DEFAULT_LIMITS,
): IntegrityBatch[] {
  const byPath = new Map<string, InterpretedCitedLine[]>()
  for (const changed of analysis.changedLines ?? []) {
    if (changed.change !== 'added') continue
    // The hosted schema requires a positive source line; a malformed patch that yields
    // line 0 would otherwise turn the whole batch into an opaque rejection.
    if (!Number.isInteger(changed.line) || changed.line < 1) continue
    const path = normalizePath(changed.path)
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
      // Only flush a batch that actually holds lines; a single oversized line must not
      // emit an empty batch, which the server rejects as an invalid request.
      if (current.length
        && (current.length >= limits.maxIntegrityBatchLines
          || characters + line.content.length > limits.maxIntegrityBatchChars)) {
        batches.push({ id: `integrity:${path}:${batches.length}`, path, lines: current })
        current = []
        characters = 0
      }
      current.push(line)
      characters += line.content.length
    }
    if (current.length) batches.push({ id: `integrity:${path}:${batches.length}`, path, lines: current })
  }
  return batches
}

function batchText(batch: IntegrityBatch): string {
  return batch.lines.map(({ content }) => content).join('\n')
}

function countLines(batches: IntegrityBatch[]): number {
  return batches.reduce((total, { lines }) => total + lines.length, 0)
}

/**
 * Runs the optional advisory integrity pass over added source lines, up to the per-run
 * batch ceiling. Findings the deterministic scanner already reports are dropped, and a
 * finding that cites no submitted line is discarded rather than shown without evidence.
 * Deterministic findings and requirement evidence states are never modified.
 */
export async function interpretIntegrity(
  analysis: AnalysisCase,
  interpreter: IntegrityInterpreter,
  signal?: AbortSignal,
  limits: OperationalLimits = DEFAULT_LIMITS,
): Promise<AnalysisCase> {
  const allBatches = buildIntegrityBatches(analysis, limits)
  const linesEligible = countLines(allBatches)
  const affordable = allBatches.slice(0, limits.maxHostedAssessments)

  const eligible: IntegrityBatch[] = []
  let skipped = allBatches.length - affordable.length
  for (const batch of affordable) {
    if (scanOutboundText(batchText(batch)).length) {
      skipped += 1
      continue
    }
    eligible.push(batch)
  }

  const alreadyFlagged = new Set(
    analysis.integrity.findings.map(({ path, line }) => lineId(normalizePath(path), line)),
  )

  const findings: InterpretedFinding[] = []
  let interpreted = 0
  let linesInterpreted = 0
  let duplicatesDropped = 0
  let serviceError: SkepticServiceError | undefined
  let halted = false

  await runBounded(eligible, limits.maxAiConcurrency, async (batch) => {
    if (halted || signal?.aborted) {
      skipped += 1
      return
    }

    // Only the provider call is guarded. A failure in the mapping below is a defect in
    // this code, not a provider problem, and must not be silently counted as "skipped".
    let response
    try {
      response = await interpreter.interpret(batch, signal)
    } catch (error) {
      skipped += 1
      if (!(error instanceof SkepticServiceError)) throw error
      serviceError ??= error
      if (haltsRemainingWork(error)) halted = true
      return
    }

    interpreted += 1
    linesInterpreted += batch.lines.length
    if (!isReportableVerdict(response.result.verdict)) return
    const byId = new Map(batch.lines.map((line) => [line.id, line]))
    const citedLines = response.result.citedLineIds.flatMap((id) => {
      const line = byId.get(id)
      return line ? [line] : []
    })
    // An interpreted finding must point at submitted lines. Without them it cannot be
    // checked against the deterministic findings, so it is not shown at all.
    if (!citedLines.length) {
      skipped += 1
      return
    }
    if (citedLines.every(({ id }) => alreadyFlagged.has(id))) {
      duplicatesDropped += 1
      return
    }
    findings.push(createInterpretedFinding({
      verdict: response.result.verdict,
      contextId: batch.id,
      path: batch.path,
      rationale: response.result.rationale,
      citedLines,
      provenance: response.provenance,
    }))
  })

  const run: InterpretedIntegrityRun = {
    findings,
    interpreted,
    skipped,
    duplicatesDropped,
    linesEligible,
    linesInterpreted,
    ...(serviceError
      ? {
        message: serviceError.message,
        ...(serviceError.resetAt ? { resetAt: serviceError.resetAt } : {}),
      }
      : {}),
  }
  return { ...analysis, interpretedIntegrity: run }
}

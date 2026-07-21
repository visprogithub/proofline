import type { OperationalLimits } from '../../config/limits'
import { DEFAULT_LIMITS } from '../../config/limits'
import { findEvidenceHunk } from './diff-evidence'
import type {
  AnalysisResult,
  ArtifactRole,
  DiffChangeType,
  EvidenceArtifact,
  EvidenceAssociation,
  Requirement,
} from './types'

export type AssessmentContextStatus = 'complete' | 'partial' | 'insufficient'
export type AssessmentContextReason =
  | 'source-unavailable'
  | 'patch-unavailable'
  | 'test-body-unavailable'
  | 'context-limit-reached'

export interface AssessmentInputLine {
  id: string
  content: string
  change?: DiffChangeType
  sourceLine?: number
}

export interface AssessmentContext {
  schemaVersion: 1
  id: string
  requirement: Requirement
  association: EvidenceAssociation
  artifactId: string
  artifactLabel: string
  artifactRole: ArtifactRole
  status: AssessmentContextStatus
  reasons: AssessmentContextReason[]
  lines: AssessmentInputLine[]
}

function artifactRole(artifact: EvidenceArtifact): ArtifactRole {
  return artifact.role ?? (artifact.kind === 'test' ? 'test-execution' : 'implementation')
}

function boundedLines(
  artifact: EvidenceArtifact,
  association: EvidenceAssociation,
  limit: number,
): { lines: AssessmentInputLine[]; truncated: boolean } {
  if (!artifact.diff || !association.matchedLine) return { lines: [], truncated: false }
  const hunk = findEvidenceHunk(artifact.diff, association.matchedLine.id)
  if (!hunk) return { lines: [], truncated: false }
  const lines: AssessmentInputLine[] = []
  let characters = 0
  for (const line of hunk.lines) {
    if (characters + line.content.length > limit) return { lines, truncated: true }
    lines.push({
      id: line.id,
      content: line.content,
      change: line.change,
      ...((line.newLine ?? line.oldLine) !== undefined
        ? { sourceLine: line.newLine ?? line.oldLine }
        : {}),
    })
    characters += line.content.length
  }
  return { lines, truncated: false }
}

function enrichedLines(
  artifact: EvidenceArtifact,
  association: EvidenceAssociation,
  existing: AssessmentInputLine[],
  limit: number,
): { lines: AssessmentInputLine[]; truncated: boolean } {
  if (!artifact.headSource || !association.matchedLine?.newLine) {
    return { lines: existing, truncated: false }
  }
  const source = artifact.headSource.content.replaceAll('\r\n', '\n').split('\n')
  const matchedIndex = association.matchedLine.newLine - 1
  const nearbyStart = Math.max(0, matchedIndex - 14)
  const nearbyEnd = Math.min(source.length, matchedIndex + 15)
  const importIndexes = source
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\s*(?:import\b|using\b|(?:const|let|var)\s+.+?=\s*require\s*\()/i.test(line))
    .slice(0, 12)
    .map(({ index }) => index)
  const indexes = Array.from(new Set([
    ...importIndexes,
    ...Array.from({ length: nearbyEnd - nearbyStart }, (_, offset) => nearbyStart + offset),
  ])).sort((left, right) => left - right)
  const lines = [...existing]
  let characters = existing.reduce((total, line) => total + line.content.length, 0)
  let truncated = false
  for (const index of indexes) {
    const content = source[index] ?? ''
    if (characters + content.length > limit) {
      truncated = true
      break
    }
    lines.push({
      id: `source-line-${index + 1}`,
      content,
      change: 'context',
      sourceLine: index + 1,
    })
    characters += content.length
  }
  return { lines, truncated }
}

interface ContextCandidate {
  item: AnalysisResult['requirements'][number]
  association: EvidenceAssociation
  artifact: EvidenceArtifact
  /** Position of the owning requirement, used to restore grouped presentation order. */
  order: number
  /** Position within that requirement's own candidates, used for breadth-first rounds. */
  depth: number
}

/** Builds bounded, inspectable model-input contexts from displayed strong associations. */
export function buildAssessmentContexts(
  result: AnalysisResult,
  limits: OperationalLimits = DEFAULT_LIMITS,
): AssessmentContext[] {
  const seen = new Set<string>()
  const candidatesByRequirement: ContextCandidate[][] = []

  result.requirements.forEach((item, order) => {
    const artifactById = new Map(item.artifacts.map((artifact) => [artifact.id, artifact]))
    const candidates: ContextCandidate[] = []
    for (const association of item.associations) {
      const assessableSuggestion = association.rule === 'phrase-overlap' && Boolean(association.matchedLine)
      if (association.strength !== 'strong' && !assessableSuggestion) continue
      const artifact = artifactById.get(association.artifactId)
      if (!artifact) continue
      const key = `${item.requirement.id}:${artifact.id}:${association.hunkId ?? 'artifact'}`
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push({ item, association, artifact, order, depth: candidates.length })
    }
    if (candidates.length) candidatesByRequirement.push(candidates)
  })

  // Allocate the context budget breadth-first: every requirement gets its first excerpt
  // before any requirement gets a second. Walking requirements in order instead would let
  // the first few consume the whole budget and leave later ones with no excerpts at all.
  const selected: ContextCandidate[] = []
  for (let depth = 0; selected.length < limits.maxAssessmentContexts; depth += 1) {
    let addedAtThisDepth = false
    for (const candidates of candidatesByRequirement) {
      if (selected.length >= limits.maxAssessmentContexts) break
      const candidate = candidates[depth]
      if (!candidate) continue
      selected.push(candidate)
      addedAtThisDepth = true
    }
    if (!addedAtThisDepth) break
  }

  // Fairness decides which excerpts make the cut, not the order they are read in. Restore
  // requirement grouping so a reviewer works through one claim at a time instead of a
  // batch that hops between claims.
  selected.sort((left, right) => left.order - right.order || left.depth - right.depth)

  const contexts: AssessmentContext[] = []
  for (const { item, association, artifact } of selected) {
    const key = `${item.requirement.id}:${artifact.id}:${association.hunkId ?? 'artifact'}`
    const role = artifactRole(artifact)
    const bounded = boundedLines(artifact, association, limits.maxAssessmentContextChars)
    const enriched = enrichedLines(
      artifact, association, bounded.lines, limits.maxAssessmentContextChars,
    )
    const reasons: AssessmentContextReason[] = []
    if (role === 'test-execution') reasons.push('test-body-unavailable')
    if (artifact.diff?.availability === 'patch-unavailable') reasons.push('patch-unavailable')
    if (role !== 'test-execution' && !artifact.headSource) {
      reasons.push('source-unavailable')
    }
    if (bounded.truncated || enriched.truncated) reasons.push('context-limit-reached')
    if (!artifact.diff && role !== 'test-execution') reasons.push('source-unavailable')

    const status: AssessmentContextStatus = role === 'test-execution' || !enriched.lines.length
      ? 'insufficient'
      : artifact.headSource
        ? 'complete'
        : 'partial'
    contexts.push({
      schemaVersion: 1,
      id: `context:${key}`,
      requirement: item.requirement,
      association,
      artifactId: artifact.id,
      artifactLabel: artifact.label,
      artifactRole: role,
      status,
      reasons: Array.from(new Set(reasons)),
      lines: enriched.lines,
    })
  }
  return contexts
}

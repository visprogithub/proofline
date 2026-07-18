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

/** Builds bounded, inspectable model-input contexts from displayed strong associations. */
export function buildAssessmentContexts(
  result: AnalysisResult,
  limits: OperationalLimits = DEFAULT_LIMITS,
): AssessmentContext[] {
  const contexts: AssessmentContext[] = []
  const seen = new Set<string>()

  for (const item of result.requirements) {
    const artifactById = new Map(item.artifacts.map((artifact) => [artifact.id, artifact]))
    for (const association of item.associations) {
      const assessableSuggestion = association.rule === 'phrase-overlap' && Boolean(association.matchedLine)
      if (association.strength !== 'strong' && !assessableSuggestion) continue
      const artifact = artifactById.get(association.artifactId)
      if (!artifact) continue
      const key = `${item.requirement.id}:${artifact.id}:${association.hunkId ?? 'artifact'}`
      if (seen.has(key)) continue
      if (contexts.length >= limits.maxAssessmentContexts) return contexts
      seen.add(key)

      const role = artifactRole(artifact)
      const bounded = boundedLines(artifact, association, limits.maxAssessmentContextChars)
      const reasons: AssessmentContextReason[] = []
      if (role === 'test-execution') reasons.push('test-body-unavailable')
      if (artifact.diff?.availability === 'patch-unavailable') reasons.push('patch-unavailable')
      if (role !== 'test-execution' && artifact.diff?.availability === 'available') {
        reasons.push('source-unavailable')
      }
      if (bounded.truncated) reasons.push('context-limit-reached')
      if (!artifact.diff && role !== 'test-execution') reasons.push('source-unavailable')

      const status: AssessmentContextStatus = role === 'test-execution' || !bounded.lines.length
        ? 'insufficient'
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
        lines: bounded.lines,
      })
    }
  }
  return contexts
}

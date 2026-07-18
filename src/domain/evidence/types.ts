export type EvidenceState =
  | 'test-evidence-found'
  | 'implementation-evidence-only'
  | 'failing-test-evidence'
  | 'no-evidence-found'
  | 'suggested-evidence-found'
  | 'ambiguous-evidence'

export type SourceKind =
  | 'pull-request'
  | 'github-commit'
  | 'github-compare'
  | 'github-issue'
  | 'repository-document'
  | 'pasted-text'
  | 'uploaded-file'
  | 'demo'

export interface SourceProvenance {
  kind: SourceKind
  label: string
  url?: string
}

export interface SourceLocation {
  source: SourceProvenance
  line?: number
  path?: string
}

export interface Requirement {
  id: string
  identifierOrigin: 'source' | 'generated'
  title: string
  acceptanceCriteria: string[]
  location: SourceLocation
  rawText: string
}

export type ArtifactKind = 'implementation' | 'test'
export type ArtifactRole = 'implementation' | 'test-source' | 'test-execution'
export type TestOutcome = 'passed' | 'failed' | 'skipped' | 'unknown'

export type DiffChangeType = 'added' | 'context' | 'deleted'
export type DiffAvailability = 'available' | 'patch-unavailable'

export interface DiffEvidenceLine {
  id: string
  content: string
  change: DiffChangeType
  oldLine?: number
  newLine?: number
}

export interface DiffEvidenceHunk {
  id: string
  header: string
  oldStart: number
  newStart: number
  lines: DiffEvidenceLine[]
}

export interface DiffEvidence {
  availability: DiffAvailability
  path: string
  hunks: DiffEvidenceHunk[]
}

export interface EvidenceArtifact {
  id: string
  kind: ArtifactKind
  label: string
  content: string
  role?: ArtifactRole
  diff?: DiffEvidence
  location: SourceLocation
  outcome?: TestOutcome
}

export type AssociationStrength = 'strong' | 'suggested'

export interface EvidenceAssociation {
  requirementId: string
  artifactId: string
  strength: AssociationStrength
  rule:
    | 'exact-requirement-id'
    | 'exact-requirement-id-context'
    | 'removed-requirement-id'
    | 'phrase-overlap'
  matchedText: string[]
  location: SourceLocation
  matchedLine?: DiffEvidenceLine
  hunkId?: string
  advisory?: AdvisoryAssessment
}

export type ImplementationVerdict =
  | 'substantively-related'
  | 'contradicts'
  | 'hollow-stub'
  | 'insufficient-context'

export type TestVerdict =
  | 'meaningful-assertion'
  | 'vacuous-test'
  | 'contradicts'
  | 'insufficient-context'

export type AdvisoryVerdict = ImplementationVerdict | TestVerdict
export type AdvisoryNotAssessedReason =
  | 'insufficient-context'
  | 'secret-detected'
  | 'limit-reached'
  | 'cancelled'
  | 'provider-error'
  | 'invalid-response'

export interface ModelProvenance {
  providerId: string
  modelId: string
  modelRevision?: string
  promptVersion: string
}

export interface AdvisoryAssessment {
  schemaVersion: 1
  status: 'assessed' | 'not-assessed'
  kind: 'implementation' | 'test'
  verdict?: AdvisoryVerdict
  rationale?: string
  citedLineIds: string[]
  reason?: AdvisoryNotAssessedReason
  provenance?: ModelProvenance
  assessedAt?: string
}

export interface RequirementEvidence {
  requirement: Requirement
  state: EvidenceState
  associations: EvidenceAssociation[]
  artifacts: EvidenceArtifact[]
  explanation: string
}

export interface AnalysisResult {
  schemaVersion: 1 | 2
  generatedAt: string
  sourceLabel: string
  requirements: RequirementEvidence[]
  disclaimer: string
}

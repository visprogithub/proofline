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
export type TestOutcome = 'passed' | 'failed' | 'skipped' | 'unknown'

export interface EvidenceArtifact {
  id: string
  kind: ArtifactKind
  label: string
  content: string
  location: SourceLocation
  outcome?: TestOutcome
}

export type AssociationStrength = 'strong' | 'suggested'

export interface EvidenceAssociation {
  requirementId: string
  artifactId: string
  strength: AssociationStrength
  rule: 'exact-requirement-id' | 'phrase-overlap'
  matchedText: string[]
  location: SourceLocation
}

export interface RequirementEvidence {
  requirement: Requirement
  state: EvidenceState
  associations: EvidenceAssociation[]
  artifacts: EvidenceArtifact[]
  explanation: string
}

export interface AnalysisResult {
  schemaVersion: 1
  generatedAt: string
  sourceLabel: string
  requirements: RequirementEvidence[]
  disclaimer: string
}

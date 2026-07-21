import { associateEvidence } from '../../domain/evidence/association-engine'
import { parseRequirements } from '../../domain/evidence/requirements-parser'
import { deriveRequirementEvidence } from '../../domain/evidence/state-derivation'
import { parseDeclaredChangeClaims } from '../../domain/evidence/change-claims-parser'
import { scanChangedLines } from '../../domain/integrity/changed-line-scanner'
import { GitHubClient } from '../../integrations/github/client'
import { discoverRequirementDocuments } from '../../integrations/github/document-discovery'
import { parseGitHubChangeUrl } from '../../integrations/github/change-url'
import type { EvidenceArtifact, SourceProvenance, TestOutcome } from '../../domain/evidence/types'
import type {
  CheckRunSummary,
  GitHubChangeIdentity,
  GitHubChangeSummary,
} from '../../integrations/github/types'
import type { AnalysisCase } from './types'
import { changedLinesFromFiles } from './patch-lines'
import { parseDiffEvidence } from '../../domain/evidence/diff-evidence'
import { artifactClassification } from '../../domain/evidence/artifact-role'
import { buildAssessmentContexts } from '../../domain/evidence/assessment-context'
import { DEFAULT_LIMITS, type OperationalLimits } from '../../config/limits'

function checkOutcome(check: CheckRunSummary): TestOutcome {
  if (check.conclusion === 'success') return 'passed'
  if (check.conclusion === 'failure' || check.conclusion === 'timed_out'
    || check.conclusion === 'cancelled' || check.conclusion === 'action_required') return 'failed'
  if (check.conclusion === 'skipped' || check.conclusion === 'neutral') return 'skipped'
  return 'unknown'
}

async function loadChange(
  identity: GitHubChangeIdentity,
  client: GitHubClient,
  signal?: AbortSignal,
): Promise<GitHubChangeSummary> {
  if (identity.kind === 'commit') return client.getCommitChange(identity, signal)
  if (identity.kind === 'compare') return client.getComparison(identity, signal)

  const summary = await client.getPullRequest(identity, signal)
  const files = await client.listPullRequestFiles(identity, signal)
  return {
    title: summary.title,
    body: summary.body,
    htmlUrl: summary.htmlUrl,
    headSha: summary.headSha,
    files,
  }
}

function changeSource(identity: GitHubChangeIdentity, summary: GitHubChangeSummary): SourceProvenance {
  if (identity.kind === 'pull-request') {
    return { kind: 'pull-request', label: `PR #${identity.number} description`, url: summary.htmlUrl }
  }
  if (identity.kind === 'commit') {
    return { kind: 'github-commit', label: `Commit ${summary.headSha.slice(0, 7)} message`, url: summary.htmlUrl }
  }
  return { kind: 'github-compare', label: `Comparison ${identity.base}…${identity.head}`, url: summary.htmlUrl }
}

function changeLabel(identity: GitHubChangeIdentity): string {
  if (identity.kind === 'pull-request') return 'Open pull request'
  if (identity.kind === 'commit') return 'Open commit'
  return 'Open comparison'
}

/** Runs public GitHub PR, commit, or comparison evidence analysis. */
export async function analyzeGitHubChange(
  url: string,
  client = new GitHubClient(),
  signal?: AbortSignal,
  limits: OperationalLimits = DEFAULT_LIMITS,
): Promise<AnalysisCase> {
  const identity = parseGitHubChangeUrl(url)
  const summary = await loadChange(identity, client, signal)
  const files = summary.files
  const checks = await client.listCheckRuns(identity, summary.headSha, signal)
  let requirementSource = changeSource(identity, summary)
  let analysisBasis: AnalysisCase['analysisBasis'] = 'formal-requirements'
  let requirementText = summary.body
  let requirements = parseRequirements(requirementText, requirementSource)
  if (!requirements.length) {
    const tree = await client.getRepositoryTree(identity, summary.headSha, signal)
    const discovery = await discoverRequirementDocuments(
      tree,
      (path) => client.getTextFile(identity, path, summary.headSha, signal),
    )
    if (discovery.ambiguous) {
      const paths = discovery.candidates.slice(0, 3).map(({ path }) => path).join(', ')
      throw new Error(`Multiple requirement documents are equally plausible: ${paths}. Manual source selection is required.`)
    }
    if (discovery.selected) {
      requirementText = discovery.selected.content
      requirementSource = {
        kind: 'repository-document',
        label: discovery.selected.path,
        url: `https://github.com/${identity.owner}/${identity.repository}/blob/${summary.headSha}/${discovery.selected.path}`,
      }
      requirements = parseRequirements(requirementText, requirementSource)
    } else {
      analysisBasis = 'declared-claims'
      requirementSource = {
        ...requirementSource,
        label: `Declared change claims from ${requirementSource.label}`,
      }
      requirements = parseDeclaredChangeClaims(
        summary.body, summary.title, requirementSource,
      )
    }
  }

  const implementationArtifacts: EvidenceArtifact[] = files.map((file) => {
    const classification = artifactClassification(file.filename)
    return {
      id: `file:${file.filename}`,
      ...classification,
      label: file.filename,
      content: file.patch ?? '',
      diff: parseDiffEvidence(file.filename, file.patch),
      location: { source: requirementSource, path: file.filename },
    }
  })
  const testArtifacts: EvidenceArtifact[] = checks.map((check) => ({
    id: `check:${check.id}`,
    kind: 'test',
    role: 'test-execution',
    label: check.name,
    content: check.name,
    outcome: checkOutcome(check),
    location: { source: requirementSource, path: `check/${check.id}` },
  }))
  const initialArtifacts = [...implementationArtifacts, ...testArtifacts]
  const associations = associateEvidence(requirements, initialArtifacts)
  const sourceArtifactIds = Array.from(new Set(
    associations
      .filter(({ matchedLine }) => Boolean(matchedLine))
      .map(({ artifactId }) => artifactId),
  )).slice(0, limits.maxAssessmentSourceFiles)
  const sourceEntries = await Promise.all(sourceArtifactIds.map(async (artifactId) => {
    const artifact = implementationArtifacts.find(({ id }) => id === artifactId)
    const file = artifact ? files.find(({ filename }) => filename === artifact.label) : undefined
    if (!artifact || !file || file.status === 'removed') return null
    try {
      const content = await client.getTextFile(
        identity, file.filename, summary.headSha, signal, limits.maxAssessmentSourceBytes,
      )
      return [artifactId, { content, revision: summary.headSha }] as const
    } catch (error) {
      if (signal?.aborted) throw error
      return null
    }
  }))
  const sourceByArtifact = new Map(sourceEntries.filter((entry) => entry !== null))
  const artifacts = initialArtifacts.map((artifact) => {
    const headSource = sourceByArtifact.get(artifact.id)
    return headSource ? { ...artifact, headSource } : artifact
  })
  const evidence = {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    sourceLabel: requirementSource.label,
    requirements: deriveRequirementEvidence(requirements, artifacts, associations),
    disclaimer: analysisBasis === 'declared-claims'
      ? 'Generated claim labels reflect author-declared change text, not formal requirements. Associations are suggestions, not correctness, test, security, or merge proof.'
      : 'Observed artifacts, not a correctness, security, or merge claim.',
  }

  const changedLines = changedLinesFromFiles(files)

  return {
    id: `github:${identity.owner}/${identity.repository}:${identity.kind}:${summary.headSha.slice(0, 12)}`,
    mode: 'github',
    analysisBasis,
    title: summary.title,
    repository: `${identity.owner}/${identity.repository}`,
    changeUrl: summary.htmlUrl,
    changeLabel: changeLabel(identity),
    evidence,
    integrity: scanChangedLines(changedLines),
    changedLines,
    assessmentContexts: buildAssessmentContexts(evidence),
  }
}

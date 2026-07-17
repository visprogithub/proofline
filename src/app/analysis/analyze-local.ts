import { associateEvidence } from '../../domain/evidence/association-engine'
import { parseJunit } from '../../domain/evidence/junit-parser'
import { parseRequirements } from '../../domain/evidence/requirements-parser'
import { deriveRequirementEvidence } from '../../domain/evidence/state-derivation'
import type { EvidenceArtifact, SourceProvenance } from '../../domain/evidence/types'
import { scanChangedLines } from '../../domain/integrity/changed-line-scanner'
import type { ChangedLine } from '../../domain/integrity/types'
import type { LocalFileKind } from '../../integrations/local/file-import'
import type { AnalysisCase } from './types'

type LocalBundle = Partial<Record<LocalFileKind, { name: string; text: string }>>

interface ParsedDiff {
  artifacts: EvidenceArtifact[]
  changedLines: ChangedLine[]
}

function parseUnifiedDiff(text: string, source: SourceProvenance): ParsedDiff {
  const artifacts: EvidenceArtifact[] = []
  const changedLines: ChangedLine[] = []
  let path = 'uploaded.patch'
  let newLine = 0
  let artifactLines: string[] = []

  function flush(): void {
    if (!artifactLines.length) return
    artifacts.push({
      id: `diff:${path}:${artifacts.length}`,
      kind: 'implementation',
      label: path,
      content: artifactLines.join('\n'),
      location: { source, path },
    })
    artifactLines = []
  }

  for (const line of text.replaceAll('\r\n', '\n').split('\n')) {
    const file = /^diff --git a\/.+ b\/(.+)$/.exec(line)
    if (file?.[1]) {
      flush()
      path = file[1]
      artifactLines.push(line)
      continue
    }
    artifactLines.push(line)
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk?.[1]) {
      newLine = Number(hunk[1])
      continue
    }
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('+')) {
      changedLines.push({ path, line: newLine, content: line.slice(1), change: 'added' })
      newLine += 1
    } else if (!line.startsWith('-')) {
      newLine += 1
    }
  }
  flush()
  return { artifacts, changedLines }
}

/** Analyzes an in-memory local requirements/diff/JUnit evidence bundle. */
export function analyzeLocalBundle(bundle: LocalBundle): AnalysisCase {
  if (!bundle.requirements) throw new Error('Local analysis requires one requirements document.')
  if (!bundle.diff) throw new Error('Local analysis requires one .diff or .patch file.')

  const requirementSource: SourceProvenance = {
    kind: 'uploaded-file', label: bundle.requirements.name,
  }
  const diffSource: SourceProvenance = { kind: 'uploaded-file', label: bundle.diff.name }
  const requirements = parseRequirements(bundle.requirements.text, requirementSource)
  if (!requirements.length) throw new Error('The requirements file contains no stable requirement IDs.')
  const parsedDiff = parseUnifiedDiff(bundle.diff.text, diffSource)
  const testArtifacts = bundle.junit
    ? parseJunit(bundle.junit.text, { kind: 'uploaded-file', label: bundle.junit.name })
    : []
  const artifacts = [...parsedDiff.artifacts, ...testArtifacts]
  const associations = associateEvidence(requirements, artifacts)

  return {
    id: `local:${bundle.requirements.name}`,
    mode: 'local',
    analysisBasis: 'formal-requirements',
    title: 'Local evidence analysis',
    repository: 'Files remain in this browser session',
    evidence: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceLabel: bundle.requirements.name,
      requirements: deriveRequirementEvidence(requirements, artifacts, associations),
      disclaimer: 'Locally observed artifacts, not a correctness, security, or merge claim.',
    },
    integrity: scanChangedLines(parsedDiff.changedLines),
  }
}

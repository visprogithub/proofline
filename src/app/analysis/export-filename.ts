import type { AnalysisCase } from './types'

type ExportIdentity = Pick<AnalysisCase, 'id' | 'mode' | 'repository' | 'changeUrl'> & {
  evidence: Pick<AnalysisCase['evidence'], 'sourceLabel'>
}

function slug(value: string, fallback: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function githubChangeSlug(changeUrl: string | undefined): string | null {
  if (!changeUrl) return null
  try {
    const path = new URL(changeUrl).pathname
    const pullRequest = /\/pull\/(\d+)/i.exec(path)
    if (pullRequest?.[1]) return `pr-${pullRequest[1]}`
    const commit = /\/commit\/([a-f0-9]+)/i.exec(path)
    if (commit?.[1]) return `commit-${commit[1].slice(0, 12).toLowerCase()}`
    const comparison = /\/compare\/(.+)$/i.exec(path)
    if (comparison?.[1]) return `compare-${slug(decodeURIComponent(comparison[1]), 'change')}`
  } catch {
    return null
  }
  return null
}

/** Builds a filesystem-safe export prefix tied to the analyzed repository and change. */
export function exportFilenameBase(analysis: ExportIdentity): string {
  if (analysis.mode === 'local') {
    const requirementsFile = analysis.evidence.sourceLabel.replace(/\.[^.]+$/, '')
    return `proofline-local-${slug(requirementsFile, 'evidence')}`
  }

  const repository = slug(analysis.repository, 'evidence')
  let change: string
  if (analysis.mode === 'github') {
    change = githubChangeSlug(analysis.changeUrl)
      ?? slug(analysis.id.split(':').slice(-2).join('-'), 'github-change')
  } else {
    change = 'demo'
  }
  return `proofline-${repository}-${change}`
}

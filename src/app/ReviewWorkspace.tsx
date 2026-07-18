import { ArrowLeft, Download, ExternalLink, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_LIMITS } from '../config/limits'
import type { AssessmentContext } from '../domain/evidence/assessment-context'
import { serializeJsonReport, serializeMarkdownReport, serializeMermaidReport } from '../domain/evidence/review-report'
import type { AdvisoryAssessment, AdvisoryVerdict } from '../domain/evidence/types'
import type { AnalysisCase } from './analysis/types'
import { stateLabel } from './evidence-labels'
import { EvidenceGraph } from '../components/evidence/EvidenceGraph'
import { ProoflineSkeptic } from '../integrations/model/proofline-skeptic'
import { augmentAnalysis } from './analysis/augment-analysis'

interface ReviewWorkspaceProps {
  analysis: AnalysisCase
  onReset: () => void
}

const SKEPTIC_CONSENT_KEY = 'proofline:hosted-skeptic-consent:v1'

function persistedConsent(): boolean {
  try {
    return window.localStorage.getItem(SKEPTIC_CONSENT_KEY) === 'true'
  } catch {
    return false
  }
}

function contextAssociationKey(context: AssessmentContext): string {
  return `${context.requirement.id}:${context.artifactId}:${context.association.hunkId ?? 'artifact'}`
}

function ClaimCheckbox({ checked, mixed, label, disabled, onChange }: {
  checked: boolean
  mixed: boolean
  label: string
  disabled: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed
  }, [mixed])
  return <input ref={ref} type="checkbox" checked={checked} aria-label={label} disabled={disabled} onChange={onChange} />
}

function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function needsHumanReview(verdict: AdvisoryVerdict | undefined): boolean {
  return verdict === 'contradicts' || verdict === 'hollow-stub' || verdict === 'vacuous-test'
}

/** Renders a completed traceability case with optional, memory-only AI enrichment. */
export function ReviewWorkspace({ analysis, onReset }: ReviewWorkspaceProps) {
  const [currentAnalysis, setCurrentAnalysis] = useState(analysis)
  const [showSkeptic, setShowSkeptic] = useState(false)
  const [consent, setConsent] = useState(persistedConsent)
  const [selectedContextIds, setSelectedContextIds] = useState<Set<string>>(() => new Set())
  const [assessing, setAssessing] = useState(false)
  const [assessmentError, setAssessmentError] = useState<string | null>(null)
  const assessmentController = useRef<AbortController | null>(null)

  const assessableContexts = currentAnalysis.assessmentContexts.filter(({ status }) => status !== 'insufficient')
  const advisoryByContextId = useMemo(() => {
    const advisoryByAssociation = new Map<string, AdvisoryAssessment>()
    for (const item of currentAnalysis.evidence.requirements) {
      for (const association of item.associations) {
        if (association.advisory) {
          advisoryByAssociation.set(`${item.requirement.id}:${association.artifactId}:${association.hunkId ?? 'artifact'}`, association.advisory)
        }
      }
    }
    return new Map(currentAnalysis.assessmentContexts.map((context) => [
      context.id,
      advisoryByAssociation.get(contextAssociationKey(context)),
    ]))
  }, [currentAnalysis])
  const contextsByClaim = useMemo(() => {
    const groups = new Map<string, AssessmentContext[]>()
    for (const context of assessableContexts) {
      const group = groups.get(context.requirement.id) ?? []
      group.push(context)
      groups.set(context.requirement.id, group)
    }
    return Array.from(groups.entries())
  }, [assessableContexts])
  const advisoryCounts = currentAnalysis.evidence.requirements
    .flatMap(({ associations }) => associations)
    .reduce((counts, { advisory }) => {
      if (advisory) counts[advisory.status] += 1
      return counts
    }, { assessed: 0, 'not-assessed': 0 })
  const usesDeclaredClaims = currentAnalysis.analysisBasis === 'declared-claims'
  const subjectCount = currentAnalysis.evidence.requirements.length
  const subjectLabel = usesDeclaredClaims
    ? (subjectCount === 1 ? 'claim' : 'claims')
    : (subjectCount === 1 ? 'requirement' : 'requirements')

  async function handleSkeptic(): Promise<void> {
    setAssessmentError(null)
    const controller = new AbortController()
    assessmentController.current = controller
    setAssessing(true)
    try {
      const provider = new ProoflineSkeptic()
      setCurrentAnalysis(await augmentAnalysis(currentAnalysis, provider, controller.signal, selectedContextIds))
      setSelectedContextIds(new Set())
    } catch (caught) {
      if (!controller.signal.aborted) {
        setAssessmentError(caught instanceof Error ? caught.message : 'The advisory assessment failed.')
      }
    } finally {
      setAssessing(false)
      assessmentController.current = null
    }
  }

  function updateConsent(approved: boolean): void {
    setConsent(approved)
    try {
      if (approved) window.localStorage.setItem(SKEPTIC_CONSENT_KEY, 'true')
      else window.localStorage.removeItem(SKEPTIC_CONSENT_KEY)
    } catch {
      // Consent still applies to this tab when browser storage is unavailable.
    }
  }

  function toggleContext(contextId: string): void {
    setSelectedContextIds((current) => {
      const next = new Set(current)
      if (next.has(contextId)) next.delete(contextId)
      else if (next.size < DEFAULT_LIMITS.maxHostedAssessments) next.add(contextId)
      return next
    })
  }

  function toggleClaim(contexts: AssessmentContext[]): void {
    setSelectedContextIds((current) => {
      const next = new Set(current)
      const hasSelectedContext = contexts.some(({ id }) => next.has(id))
      if (hasSelectedContext) {
        for (const { id } of contexts) next.delete(id)
      } else {
        for (const { id } of contexts) {
          if (next.size >= DEFAULT_LIMITS.maxHostedAssessments) break
          next.add(id)
        }
      }
      return next
    })
  }

  function selectNextBatch(): void {
    const candidates = assessableContexts.filter(({ id }) => advisoryByContextId.get(id)?.status !== 'assessed')
    setSelectedContextIds(new Set(candidates.slice(0, DEFAULT_LIMITS.maxHostedAssessments).map(({ id }) => id)))
  }

  function reset(): void {
    assessmentController.current?.abort()
    onReset()
  }

  return (
    <main className="review-shell">
      <header className="review-masthead">
        <button className="back-action" type="button" onClick={reset}>
          <ArrowLeft aria-hidden="true" size={17} /> New case
        </button>
        <div className="review-title">
          <p>{currentAnalysis.mode === 'demo' ? 'Sample / synthetic case' : currentAnalysis.mode === 'local' ? 'Local / in-memory case' : currentAnalysis.repository}</p>
          <h1>{currentAnalysis.title}</h1>
        </div>
        <div className="export-actions">
          <button type="button" onClick={() => downloadText(
            'proofline-evidence.md', serializeMarkdownReport(currentAnalysis.evidence), 'text/markdown',
          )}><Download aria-hidden="true" size={16} /> Markdown</button>
          <button type="button" onClick={() => downloadText(
            'proofline-evidence.json', serializeJsonReport(currentAnalysis.evidence), 'application/json',
          )}><Download aria-hidden="true" size={16} /> JSON</button>
          <button type="button" onClick={() => downloadText(
            'proofline-evidence-map.mmd', serializeMermaidReport(currentAnalysis.evidence), 'text/plain',
          )}><Download aria-hidden="true" size={16} /> Mermaid map</button>
        </div>
      </header>

      <section className="case-meta" aria-label="Analysis context">
        <span>Case {currentAnalysis.id}</span>
        <span>{currentAnalysis.evidence.sourceLabel}</span>
        {currentAnalysis.changeUrl && (
          <a href={currentAnalysis.changeUrl} target="_blank" rel="noreferrer">
            {currentAnalysis.changeLabel ?? 'Open GitHub change'} <ExternalLink aria-hidden="true" size={14} />
          </a>
        )}
      </section>

      {usesDeclaredClaims && (
        <aside className="basis-notice" role="note">
          <strong>No formal requirement IDs found.</strong>
          <span>Proofline extracted author-declared change claims instead. Generated claim IDs are labels only; all associations remain suggestions.</span>
        </aside>
      )}

      <section className="skeptic-panel" aria-labelledby="skeptic-title">
        <div className="skeptic-heading">
          <div>
            <span>Optional / advisory</span>
            <h2 id="skeptic-title">AI evidence skeptic</h2>
            <p>Challenge hollow, contradictory, or weakly linked evidence without changing deterministic states.</p>
          </div>
          <button type="button" onClick={() => setShowSkeptic((shown) => !shown)}>
            {showSkeptic ? 'Close preview' : 'Preview skeptic'}
          </button>
        </div>
        {(advisoryCounts.assessed > 0 || advisoryCounts['not-assessed'] > 0) && (
          <p className="skeptic-summary" aria-live="polite">
            {advisoryCounts.assessed} assessed · {advisoryCounts['not-assessed']} not assessed · deterministic states unchanged
          </p>
        )}
        {showSkeptic && (
          <div className="skeptic-config">
            <div className="skeptic-service-note">
              <strong>Hosted by Proofline</strong>
              <span>No API key is requested or sent by your browser. Best-effort per-connection and warm-instance budgets protect the hosted model.</span>
            </div>
            <details className="payload-preview" open>
              <summary>Choose from {assessableContexts.length} assessable payload excerpt{assessableContexts.length === 1 ? '' : 's'}</summary>
              {assessableContexts.length ? (
                <div className="payload-queue">
                  <div className="payload-queue-toolbar">
                    <span><strong>{selectedContextIds.size}</strong> selected · {DEFAULT_LIMITS.maxHostedAssessments} maximum per run</span>
                    <div>
                      <button type="button" disabled={assessing} onClick={selectNextBatch}>Select next batch</button>
                      <button type="button" disabled={assessing || !selectedContextIds.size} onClick={() => setSelectedContextIds(new Set())}>Clear</button>
                      <button type="button" disabled={assessing} onClick={() => setShowSkeptic(false)}>Minimize</button>
                    </div>
                  </div>
                  {contextsByClaim.map(([claimId, contexts]) => {
                    const selectedInClaim = contexts.filter(({ id }) => selectedContextIds.has(id)).length
                    return (
                      <section className="payload-claim" key={claimId}>
                        <label className="payload-claim-heading">
                          <ClaimCheckbox
                            checked={selectedInClaim === contexts.length}
                            mixed={selectedInClaim > 0 && selectedInClaim < contexts.length}
                            label={`Select payloads for ${claimId}`}
                            disabled={assessing}
                            onChange={() => toggleClaim(contexts)}
                          />
                          <strong>{claimId}</strong>
                          <span>{selectedInClaim}/{contexts.length} selected</span>
                        </label>
                        {contexts.map((context) => {
                          const advisory = advisoryByContextId.get(context.id)
                          const selected = selectedContextIds.has(context.id)
                          const selectionFull = selectedContextIds.size >= DEFAULT_LIMITS.maxHostedAssessments
                          return (
                            <article className={selected ? 'payload-selected' : ''} key={context.id}>
                              <label className="payload-item-heading">
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${context.requirement.id} payload ${context.artifactLabel}`}
                                  checked={selected}
                                  disabled={assessing || (!selected && selectionFull)}
                                  onChange={() => toggleContext(context.id)}
                                />
                                <strong>{context.artifactLabel}</strong>
                                <span className={`payload-status payload-status-${advisory?.status ?? 'pending'}`}>
                                  {advisory?.status === 'assessed' ? 'Assessed' : advisory ? 'Retry available' : 'Not yet assessed'}
                                </span>
                              </label>
                              <details className="payload-code">
                                <summary>Preview excerpt</summary>
                                <pre>{context.lines.map(({ id, content }) => `${id}: ${content}`).join('\n')}</pre>
                              </details>
                            </article>
                          )
                        })}
                      </section>
                    )
                  })}
                </div>
              ) : <p>No strong association has enough source context for hosted assessment.</p>}
            </details>
            <label className="skeptic-consent">
              <input type="checkbox" checked={consent} onChange={(event) => updateConsent(event.target.checked)} disabled={assessing} />
              <span>Remember my approval to send only excerpts I select to Proofline's server-side Hugging Face provider. Hugging Face may process or retain them under its policy.</span>
            </label>
            <div className="skeptic-actions">
              <button type="button" disabled={!consent || !selectedContextIds.size || assessing} onClick={() => void handleSkeptic()}>
                {assessing ? 'Assessing evidence…' : `Run selected excerpts (${selectedContextIds.size})`}
              </button>
              {assessing && <button type="button" onClick={() => assessmentController.current?.abort()}>Cancel</button>}
            </div>
            {assessmentError && <p className="skeptic-error" role="alert">{assessmentError}</p>}
            {currentAnalysis.advisoryRun && (
              <p className={`skeptic-run-status ${currentAnalysis.advisoryRun.code === 'completed' ? '' : 'skeptic-error'}`} role="status">
                {currentAnalysis.advisoryRun.message}
                {currentAnalysis.advisoryRun.resetAt && <> Reset: {new Date(currentAnalysis.advisoryRun.resetAt).toLocaleString()}.</>}
              </p>
            )}
            <p className="skeptic-footnote">Proofline does not persist submitted excerpts or model results. Model output may be wrong and never changes deterministic evidence.</p>
          </div>
        )}
      </section>

      <EvidenceGraph
        requirements={currentAnalysis.evidence.requirements}
        subject={usesDeclaredClaims ? 'claims' : 'requirements'}
      />

      <div className="review-grid">
        <section className="traceability-panel" aria-labelledby="traceability-title">
          <div className="panel-heading">
            <div><span>01 / Traceability</span><h2 id="traceability-title">{usesDeclaredClaims ? 'Declared change claims' : 'Requirement evidence'}</h2></div>
            <strong>{subjectCount} {subjectLabel}</strong>
          </div>
          <div className="requirement-list">
            {currentAnalysis.evidence.requirements.map((item, index) => {
              const caveated = item.associations.some(({ advisory }) => needsHumanReview(advisory?.verdict))
              return (
                <article className={`requirement-card state-${item.state}${caveated ? ' needs-human-review' : ''}`} key={item.requirement.id}>
                  <div className="requirement-index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="requirement-copy">
                    <p className="requirement-id">{item.requirement.id}</p>
                    <h3>{item.requirement.title}</h3>
                    <p>{item.explanation}</p>
                    <details>
                      <summary>{item.associations.length} evidence {item.associations.length === 1 ? 'association' : 'associations'}</summary>
                      {item.associations.length ? (
                        <ul>{item.associations.map((association) => (
                          <li key={`${association.artifactId}:${association.rule}`}>
                            <strong>{association.strength}</strong> · {association.rule} · {association.matchedText.join(', ')}
                            {association.advisory && (
                              <div className={`advisory-note advisory-${association.advisory.status}`}>
                                <strong>{association.advisory.status === 'assessed' ? association.advisory.verdict : 'Not assessed'}</strong>
                                {association.advisory.rationale && <span>{association.advisory.rationale}</span>}
                                {association.advisory.reason && <span>{association.advisory.reason.replaceAll('-', ' ')}</span>}
                                {association.advisory.provenance && <small>{association.advisory.provenance.providerId} · {association.advisory.provenance.modelId} · advisory only</small>}
                              </div>
                            )}
                          </li>
                        ))}</ul>
                      ) : <p>No associated artifacts were observed.</p>}
                    </details>
                  </div>
                  <span className="state-chip">{caveated ? 'Needs human review' : stateLabel(item.state)}</span>
                </article>
              )
            })}
          </div>
        </section>

        <aside className="integrity-panel" aria-labelledby="integrity-title">
          <div className="panel-heading compact">
            <div><span>02 / Integrity</span><h2 id="integrity-title">Changed-line signals</h2></div>
            <ShieldAlert aria-hidden="true" size={24} />
          </div>
          <p className="integrity-intro">
            {currentAnalysis.integrity.scannedAddedLines} added lines scanned. Findings describe observed syntax, not intent.
          </p>
          {currentAnalysis.integrity.findings.length ? currentAnalysis.integrity.findings.map((finding) => (
            <article className={`integrity-finding ${finding.confidence}`} key={finding.id}>
              <div className="finding-label"><span>{finding.confidence}</span><code>{finding.path}:{finding.line}</code></div>
              <h3>{finding.summary}</h3>
              <pre>{finding.matchedText}</pre>
              <p>{finding.impact}</p>
              <strong>Next: {finding.remediation}</strong>
            </article>
          )) : <p className="empty-integrity">No configured integrity signals were observed.</p>}
        </aside>
      </div>

      <footer className="case-disclaimer">{currentAnalysis.evidence.disclaimer}</footer>
    </main>
  )
}

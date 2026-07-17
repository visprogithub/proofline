import { ArrowLeft, Download, ExternalLink, ShieldAlert } from 'lucide-react'
import { serializeJsonReport, serializeMarkdownReport } from '../domain/evidence/review-report'
import type { AnalysisCase } from './analysis/types'
import { stateLabel } from './evidence-labels'
import { EvidenceGraph } from '../components/evidence/EvidenceGraph'

interface ReviewWorkspaceProps {
  analysis: AnalysisCase
  onReset: () => void
}

function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Renders a completed traceability and implementation-integrity case. */
export function ReviewWorkspace({ analysis, onReset }: ReviewWorkspaceProps) {
  const usesDeclaredClaims = analysis.analysisBasis === 'declared-claims'
  const subjectCount = analysis.evidence.requirements.length
  const subjectLabel = usesDeclaredClaims
    ? (subjectCount === 1 ? 'claim' : 'claims')
    : (subjectCount === 1 ? 'requirement' : 'requirements')
  return (
    <main className="review-shell">
      <header className="review-masthead">
        <button className="back-action" type="button" onClick={onReset}>
          <ArrowLeft aria-hidden="true" size={17} /> New case
        </button>
        <div className="review-title">
          <p>{analysis.mode === 'demo' ? 'Sample / synthetic case' : analysis.mode === 'local' ? 'Local / in-memory case' : analysis.repository}</p>
          <h1>{analysis.title}</h1>
        </div>
        <div className="export-actions">
          <button type="button" onClick={() => downloadText(
            'proofline-evidence.md', serializeMarkdownReport(analysis.evidence), 'text/markdown',
          )}><Download aria-hidden="true" size={16} /> Markdown</button>
          <button type="button" onClick={() => downloadText(
            'proofline-evidence.json', serializeJsonReport(analysis.evidence), 'application/json',
          )}><Download aria-hidden="true" size={16} /> JSON</button>
        </div>
      </header>

      <section className="case-meta" aria-label="Analysis context">
        <span>Case {analysis.id}</span>
        <span>{analysis.evidence.sourceLabel}</span>
        {analysis.changeUrl && (
          <a href={analysis.changeUrl} target="_blank" rel="noreferrer">
            {analysis.changeLabel ?? 'Open GitHub change'} <ExternalLink aria-hidden="true" size={14} />
          </a>
        )}
      </section>

      {usesDeclaredClaims && (
        <aside className="basis-notice" role="note">
          <strong>No formal requirement IDs found.</strong>
          <span>Proofline extracted author-declared change claims instead. Generated claim IDs are labels only; all associations remain suggestions.</span>
        </aside>
      )}

      <EvidenceGraph
        requirements={analysis.evidence.requirements}
        subject={usesDeclaredClaims ? 'claims' : 'requirements'}
      />

      <div className="review-grid">
        <section className="traceability-panel" aria-labelledby="traceability-title">
          <div className="panel-heading">
            <div><span>01 / Traceability</span><h2 id="traceability-title">{usesDeclaredClaims ? 'Declared change claims' : 'Requirement evidence'}</h2></div>
            <strong>{subjectCount} {subjectLabel}</strong>
          </div>
          <div className="requirement-list">
            {analysis.evidence.requirements.map((item, index) => (
              <article className={`requirement-card state-${item.state}`} key={item.requirement.id}>
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
                        </li>
                      ))}</ul>
                    ) : <p>No associated artifacts were observed.</p>}
                  </details>
                </div>
                <span className="state-chip">{stateLabel(item.state)}</span>
              </article>
            ))}
          </div>
        </section>

        <aside className="integrity-panel" aria-labelledby="integrity-title">
          <div className="panel-heading compact">
            <div><span>02 / Integrity</span><h2 id="integrity-title">Changed-line signals</h2></div>
            <ShieldAlert aria-hidden="true" size={24} />
          </div>
          <p className="integrity-intro">
            {analysis.integrity.scannedAddedLines} added lines scanned. Findings describe observed syntax, not intent.
          </p>
          {analysis.integrity.findings.length ? analysis.integrity.findings.map((finding) => (
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

      <footer className="case-disclaimer">{analysis.evidence.disclaimer}</footer>
    </main>
  )
}

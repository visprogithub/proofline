import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, FileSearch, GitPullRequest, KeyRound, LogOut } from 'lucide-react'
import { motion } from 'motion/react'
import { analyzeGitHubChange } from './analysis/analyze-github'
import type { AnalysisCase } from './analysis/types'
import { createDemoCase } from '../demo/demo-fixture'
import { stateLabel, stateStamp } from './evidence-labels'
import { readLocalBundle } from '../integrations/local/file-import'
import { analyzeLocalBundle } from './analysis/analyze-local'
import { useGitHubAuth } from './use-github-auth'
import { GitHubClient } from '../integrations/github/client'

type AnalysisStatus = 'idle' | 'loading' | 'ready' | 'error'

const ReviewWorkspace = lazy(async () => {
  const module = await import('./ReviewWorkspace')
  return { default: module.ReviewWorkspace }
})

/** Hosts the in-memory Proofline landing, analysis, and reset workflow. */
export function App() {
  const githubAuth = useGitHubAuth()
  const preview = useMemo(() => createDemoCase(), [])
  const githubToken = githubAuth.state.status === 'authenticated' ? githubAuth.state.token : undefined
  const githubClient = useMemo(
    () => new GitHubClient(undefined, undefined, githubToken),
    [githubToken],
  )
  const githubAnalysisCache = useRef(new WeakMap<GitHubClient, Map<string, AnalysisCase>>())
  const abortController = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [analysis, setAnalysis] = useState<AnalysisCase | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze(): Promise<void> {
    abortController.current?.abort()
    const controller = new AbortController()
    abortController.current = controller
    setStatus('loading')
    setError(null)
    try {
      const cacheKey = url.trim()
      let clientCache = githubAnalysisCache.current.get(githubClient)
      if (!clientCache) {
        clientCache = new Map<string, AnalysisCase>()
        githubAnalysisCache.current.set(githubClient, clientCache)
      }
      const cached = clientCache.get(cacheKey)
      if (cached) {
        setAnalysis(cached)
        setStatus('ready')
        return
      }
      const result = await analyzeGitHubChange(
        cacheKey, githubClient, controller.signal,
      )
      clientCache.set(cacheKey, result)
      setAnalysis(result)
      setStatus('ready')
    } catch (caught) {
      if (controller.signal.aborted) return
      setError(caught instanceof Error ? caught.message : 'The GitHub change could not be analyzed.')
      setStatus('error')
    }
  }

  function handleDemo(): void {
    abortController.current?.abort()
    setAnalysis(createDemoCase())
    setError(null)
    setStatus('ready')
  }

  function handleReset(): void {
    abortController.current?.abort()
    setAnalysis(null)
    setError(null)
    setStatus('idle')
  }

  async function handleLocalFiles(files: FileList | null): Promise<void> {
    if (!files?.length) return
    setStatus('loading')
    setError(null)
    try {
      const bundle = await readLocalBundle(Array.from(files))
      setAnalysis(analyzeLocalBundle(bundle))
      setStatus('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The local evidence could not be analyzed.')
      setStatus('error')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  if (status === 'ready' && analysis) {
    return (
      <Suspense fallback={<main className="review-loading" aria-live="polite">Opening evidence dossier…</main>}>
        <ReviewWorkspace analysis={analysis} onReset={handleReset} />
      </Suspense>
    )
  }

  return (
    <main className="shell">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Proofline home">
          <span className="wordmark-mark" aria-hidden="true">P/</span>
          Proofline
        </a>
        <span className="classification">Review evidence / build 001</span>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow"><span>Case 001</span> Evidence before approval</p>
          <h1 id="hero-title">The diff says <em>done.</em><br />Show the proof.</h1>
          <p className="lede">
            Trace requirements across pull requests, commits, and comparisons to exact code and test evidence—without
            sending your source to a model or trusting an opaque summary.
          </p>

          <form
            className="pr-form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleAnalyze()
            }}
          >
            <div className={`auth-rail auth-${githubAuth.state.status}`} aria-label="GitHub connection status">
              <div className="auth-copy">
                <span><i aria-hidden="true" />{
                  githubAuth.state.status === 'authenticated'
                    ? `Connected as ${githubAuth.state.username}`
                    : githubAuth.state.status === 'loading'
                      ? 'Checking GitHub connection'
                      : 'Anonymous GitHub access'
                }</span>
                <small>{githubAuth.state.status === 'authenticated'
                  ? 'Authenticated API allowance: 5,000 requests / hour'
                  : 'Anonymous API allowance: 60 requests / hour / IP'}</small>
              </div>
              {githubAuth.configured && githubAuth.state.status === 'authenticated' && (
                <button className="auth-action" type="button" onClick={() => void githubAuth.disconnect()}>
                  <LogOut aria-hidden="true" size={14} /> Use anonymous
                </button>
              )}
              {githubAuth.configured && githubAuth.state.status !== 'authenticated' && (
                <button
                  className="auth-action"
                  type="button"
                  disabled={githubAuth.state.status === 'loading'}
                  onClick={() => void githubAuth.connect()}
                >
                  <KeyRound aria-hidden="true" size={15} /> Connect GitHub
                </button>
              )}
            </div>
            {githubAuth.state.status === 'error' && (
              <p className="auth-error" role="alert">{githubAuth.state.error}</p>
            )}
            <label htmlFor="github-url">Public GitHub change</label>
            <div className="input-frame">
              <GitPullRequest aria-hidden="true" size={20} />
              <input
                id="github-url"
                name="github-url"
                type="url"
                placeholder="https://github.com/owner/repo/commit/abc1234"
                autoComplete="url"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={status === 'loading'}
              />
              <button type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Reading evidence…' : 'Analyze evidence'}
                <ArrowUpRight aria-hidden="true" size={18} />
              </button>
            </div>
            <p className="input-hint">Pull request / single commit / base…head comparison</p>
          </form>

          <div className="secondary-actions">
            <button className="text-action" type="button" onClick={handleDemo}>
              <FileSearch aria-hidden="true" size={18} /> Try the evidence dossier
            </button>
            <button className="text-action muted-action" type="button" onClick={() => fileInput.current?.click()}>
              Import local evidence
            </button>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              multiple
              accept=".md,.mdx,.txt,.rst,.adoc,.diff,.patch,.xml"
              aria-label="Choose local requirements, diff, and optional JUnit files"
              onChange={(event) => void handleLocalFiles(event.target.files)}
            />
          </div>
          <div className="status-region" aria-live="polite" aria-atomic="true">
            {status === 'loading' && <p>Retrieving public change artifacts from GitHub.</p>}
            {status === 'error' && error && <p className="error-message">{error}</p>}
          </div>
        </motion.div>

        <motion.aside
          className="evidence-preview"
          aria-label="Synthetic sample evidence overview"
          initial={{ opacity: 0, rotate: 1.5, x: 24 }}
          animate={{ opacity: 1, rotate: -1.2, x: 0 }}
          transition={{ delay: 0.18, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="paper-clip" aria-hidden="true" />
          <div className="sample-banner">Sample / synthetic</div>
          <div className="dossier-heading">
            <span>Evidence index</span>
            <span>{String(preview.evidence.requirements.length).padStart(2, '0')} requirements</span>
          </div>
          {preview.evidence.requirements.slice(0, 3).map((item, index) => (
            <article className={`evidence-row evidence-${item.state}`} key={item.requirement.id}>
              <span className="evidence-number">{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{item.requirement.id}</strong><p>{stateLabel(item.state)}</p></div>
              <span className="stamp">{stateStamp(item.state)}</span>
            </article>
          ))}
          <p className="preview-note">Observed artifacts, not a correctness claim.</p>
        </motion.aside>
      </section>
    </main>
  )
}

import { describe, expect, it } from 'vitest'
import { exportFilenameBase } from './export-filename'

describe('contextual export filenames', () => {
  it('identifies a GitHub pull request by repository and PR number', () => {
    expect(exportFilenameBase({
      id: 'github:Grow24/blocklycursor:pull-request:8f139a0fdec5',
      mode: 'github',
      repository: 'Grow24/blocklycursor',
      changeUrl: 'https://github.com/Grow24/blocklycursor/pull/1',
      evidence: { sourceLabel: 'PR #1 description' },
    })).toBe('proofline-grow24-blocklycursor-pr-1')
  })

  it('identifies commits and comparisons without unsafe filename characters', () => {
    expect(exportFilenameBase({
      id: 'github:acme/tool:commit:abcdef123456',
      mode: 'github',
      repository: 'acme/tool',
      changeUrl: 'https://github.com/acme/tool/commit/ABCDEF1234567890',
      evidence: { sourceLabel: 'Commit ABCDEF1 message' },
    })).toBe('proofline-acme-tool-commit-abcdef123456')
    expect(exportFilenameBase({
      id: 'github:acme/tool:compare:abcdef123456',
      mode: 'github',
      repository: 'acme/tool',
      changeUrl: 'https://github.com/acme/tool/compare/main...feature%2Fevidence',
      evidence: { sourceLabel: 'Comparison main…feature/evidence' },
    })).toBe('proofline-acme-tool-compare-main-feature-evidence')
  })

  it('uses the requirements filename to identify local exports', () => {
    expect(exportFilenameBase({
      id: 'local:checkout-requirements.md',
      mode: 'local',
      repository: 'Files remain in this browser session',
      evidence: { sourceLabel: 'checkout-requirements.md' },
    })).toBe('proofline-local-checkout-requirements')
  })
})

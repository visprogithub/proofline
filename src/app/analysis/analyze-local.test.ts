import { describe, expect, it } from 'vitest'
import { analyzeLocalBundle } from './analyze-local'

describe('local evidence analysis', () => {
  it('PL-104 analyzes uploaded requirements, diff, and JUnit through the real domains', () => {
    const result = analyzeLocalBundle({
      requirements: { name: 'requirements.md', text: '## REQ-101: Export report' },
      diff: {
        name: 'feature.patch',
        text: 'diff --git a/src/export.ts b/src/export.ts\n@@ -1,1 +1,3 @@\n old\n+exportReport() // REQ-101\n+// TODO validate format',
      },
      junit: {
        name: 'junit.xml',
        text: '<testsuite name="exports"><testcase name="REQ-101 exports report" /></testsuite>',
      },
    })

    expect(result.evidence.requirements[0]?.state).toBe('test-evidence-found')
    expect(result.integrity.findings[0]?.rule).toBe('unfinished-marker')
  })

  it('PL-104 requires both requirements and diff inputs', () => {
    expect(() => analyzeLocalBundle({})).toThrow('requires one requirements')
    expect(() => analyzeLocalBundle({
      requirements: { name: 'requirements.md', text: '## REQ-101: Export' },
    })).toThrow('requires one .diff')
  })

  it('PL-104 rejects an empty or hunk-less diff instead of returning a requirements-only result', () => {
    expect(() => analyzeLocalBundle({
      requirements: { name: 'requirements.md', text: '## REQ-101: Export' },
      diff: { name: 'empty.patch', text: '' },
    })).toThrow('empty.patch is empty or contains no unified diff hunks')

    expect(() => analyzeLocalBundle({
      requirements: { name: 'requirements.md', text: '## REQ-101: Export' },
      diff: { name: 'notes.patch', text: 'This is not a unified diff.' },
    })).toThrow('notes.patch is empty or contains no unified diff hunks')
  })
})

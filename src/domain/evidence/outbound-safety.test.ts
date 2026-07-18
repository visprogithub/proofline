import { describe, expect, it } from 'vitest'
import { scanOutboundText } from './outbound-safety'

describe('outbound model safety', () => {
  it('blocks credential-shaped content without returning the credential', () => {
    const result = scanOutboundText('token = ghp_abcdefghijklmnopqrstuvwxyz123456')
    expect(result).toEqual([{ rule: 'github-token', label: 'GitHub token' }])
    expect(JSON.stringify(result)).not.toContain('ghp_')
  })

  it('does not block ordinary source', () => {
    expect(scanOutboundText('export function run() { return true }')).toEqual([])
  })
})

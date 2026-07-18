export interface OutboundSafetyFinding {
  rule: 'private-key' | 'github-token' | 'openai-token' | 'aws-access-key'
  label: string
}

const RULES: Array<{ rule: OutboundSafetyFinding['rule']; label: string; pattern: RegExp }> = [
  { rule: 'private-key', label: 'private key material', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { rule: 'github-token', label: 'GitHub token', pattern: /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/ },
  { rule: 'openai-token', label: 'OpenAI-style token', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { rule: 'aws-access-key', label: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
]

/** Detects high-confidence credential patterns before model-bound content leaves the browser. */
export function scanOutboundText(text: string): OutboundSafetyFinding[] {
  return RULES.filter(({ pattern }) => pattern.test(text))
    .map(({ rule, label }) => ({ rule, label }))
}

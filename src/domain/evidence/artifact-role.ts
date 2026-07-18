import type { ArtifactKind, ArtifactRole } from './types'

const TEST_PATH = /(?:^|\/)(?:__tests__|tests?|specs?)(?:\/|$)|(?:\.|_)(?:test|spec)\.[^/]+$/i

/** Classifies changed source paths without inferring a passing test outcome. */
export function artifactClassification(path: string): { kind: ArtifactKind; role: ArtifactRole } {
  return TEST_PATH.test(path)
    ? { kind: 'test', role: 'test-source' }
    : { kind: 'implementation', role: 'implementation' }
}

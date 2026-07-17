import { z } from 'zod'

const positiveInteger = z.number().int().positive()

const limitsSchema = z.object({
  maxChangedFiles: positiveInteger,
  maxRequirementCandidates: positiveInteger,
  maxCandidateBytes: positiveInteger,
  maxLocalImportBytes: positiveInteger,
  maxDeclaredClaims: positiveInteger,
})

export type OperationalLimits = Readonly<z.infer<typeof limitsSchema>>

export const DEFAULT_LIMITS: OperationalLimits = Object.freeze({
  maxChangedFiles: 100,
  maxRequirementCandidates: 20,
  maxCandidateBytes: 256 * 1024,
  maxLocalImportBytes: 5 * 1024 * 1024,
  maxDeclaredClaims: 12,
})

/**
 * Validates a complete or partial operational-limit override and returns an
 * immutable configuration object shared by adapters and presentation code.
 */
export function createOperationalLimits(
  overrides: Partial<OperationalLimits> = {},
): OperationalLimits {
  return Object.freeze(limitsSchema.parse({ ...DEFAULT_LIMITS, ...overrides }))
}

/** Formats byte counts for stable, human-readable limit messages. */
export function formatByteLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${bytes / (1024 * 1024)} MB`
  if (bytes >= 1024) return `${bytes / 1024} KB`
  return `${bytes} bytes`
}

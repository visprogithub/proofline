export interface BinaryEvaluationMetrics {
  truePositives: number
  falsePositives: number
  falseNegatives: number
  trueNegatives: number
  precision: number
  recall: number
  f1: number
}

export interface SemanticOutperformGate {
  passed: boolean
  reasons: string[]
}

/** Computes deterministic binary retrieval metrics for a locked labeled fixture. */
export function binaryEvaluationMetrics(
  expected: boolean[],
  predicted: boolean[],
): BinaryEvaluationMetrics {
  if (expected.length !== predicted.length || expected.length === 0) {
    throw new Error('Expected and predicted labels must have the same non-zero length.')
  }
  let truePositives = 0
  let falsePositives = 0
  let falseNegatives = 0
  let trueNegatives = 0
  expected.forEach((label, index) => {
    const prediction = predicted[index]
    if (label && prediction) truePositives += 1
    else if (!label && prediction) falsePositives += 1
    else if (label && !prediction) falseNegatives += 1
    else trueNegatives += 1
  })
  const precision = truePositives + falsePositives
    ? truePositives / (truePositives + falsePositives)
    : 0
  const recall = truePositives + falseNegatives
    ? truePositives / (truePositives + falseNegatives)
    : 0
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
  return { truePositives, falsePositives, falseNegatives, trueNegatives, precision, recall, f1 }
}

/** Applies the reviewed PL-722 holdout gate against the deterministic baseline. */
export function semanticOutperformGate(
  baseline: BinaryEvaluationMetrics,
  candidate: BinaryEvaluationMetrics,
): SemanticOutperformGate {
  const reasons: string[] = []
  if (candidate.precision < 0.8) reasons.push('Candidate precision is below 0.80.')
  if (candidate.recall <= baseline.recall) reasons.push('Candidate recall does not exceed the baseline.')
  if (candidate.f1 < baseline.f1 + 0.05) reasons.push('Candidate F1 is less than 0.05 above the baseline.')
  return { passed: reasons.length === 0, reasons }
}

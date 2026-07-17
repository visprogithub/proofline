const DECLARED_REQUIREMENT_ID = /^\s{0,3}(?:(?:#{1,6}|[-*+]|\d+[.)])\s+|\|\s*)?(?:\*\*|__|`|\[)?([A-Z][A-Z0-9_-]{1,15}-\d{1,8})(?!\.\d)\b/

/** Returns a stable identifier only when the line structurally declares a requirement. */
export function declaredRequirementIdentifier(line: string): string | null {
  return DECLARED_REQUIREMENT_ID.exec(line)?.[1] ?? null
}

/** Returns unique, structurally declared requirement identifiers from a document. */
export function declaredRequirementIdentifiers(markdown: string): string[] {
  const identifiers = new Set<string>()
  for (const line of markdown.replaceAll('\r\n', '\n').split('\n')) {
    const identifier = declaredRequirementIdentifier(line)
    if (identifier) identifiers.add(identifier)
  }
  return [...identifiers]
}

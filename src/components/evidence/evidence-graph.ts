import type { Edge, Node } from '@xyflow/react'
import type { RequirementEvidence } from '../../domain/evidence/types'

export interface EvidenceGraphModel {
  nodes: Node[]
  edges: Edge[]
}

/** Builds a stable three-column requirement-to-implementation-to-test graph. */
export function buildEvidenceGraph(requirements: RequirementEvidence[]): EvidenceGraphModel {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const artifactNodes = new Set<string>()

  requirements.forEach((item, requirementIndex) => {
    const requirementNode = `requirement:${item.requirement.id}`
    nodes.push({
      id: requirementNode,
      position: { x: 0, y: requirementIndex * 112 },
      data: { label: `${item.requirement.id} · ${item.requirement.title}` },
      className: `graph-node requirement-node ${item.state}`,
    })

    item.associations.forEach((association) => {
      const artifact = item.artifacts.find(({ id }) => id === association.artifactId)
      if (!artifact) return
      const artifactNode = `artifact:${artifact.id}`
      if (!artifactNodes.has(artifactNode)) {
        artifactNodes.add(artifactNode)
        const sameKindIndex = nodes.filter(({ className }) => className?.includes(`${artifact.kind}-node`)).length
        nodes.push({
          id: artifactNode,
          position: { x: artifact.kind === 'implementation' ? 350 : 700, y: sameKindIndex * 92 },
          data: { label: artifact.label },
          className: `graph-node ${artifact.kind}-node`,
        })
      }
      edges.push({
        id: `${requirementNode}:${artifactNode}`,
        source: requirementNode,
        target: artifactNode,
        animated: association.strength === 'suggested',
        className: `graph-edge ${association.strength}`,
        label: association.strength,
      })
    })
  })

  return { nodes, edges }
}

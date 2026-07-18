import { useEffect, useMemo, useRef } from 'react'
import { Background, Controls, MarkerType, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { RequirementEvidence } from '../../domain/evidence/types'
import { buildEvidenceGraph } from './evidence-graph'

interface EvidenceGraphProps {
  requirements: RequirementEvidence[]
  subject?: 'requirements' | 'claims'
  fitRequest?: number
}

/** Renders the inspectable requirement-to-artifact relationship map. */
export function EvidenceGraph({ requirements, subject = 'requirements', fitRequest = 0 }: EvidenceGraphProps) {
  const refit = useRef<(() => void) | null>(null)
  const model = useMemo(() => buildEvidenceGraph(requirements), [requirements])
  const edges = useMemo(() => model.edges.map((edge) => ({
    ...edge,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#20201c' },
  })), [model.edges])

  useEffect(() => {
    if (!fitRequest) return
    const frame = window.requestAnimationFrame(() => {
      refit.current?.()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [fitRequest])

  return (
    <section className="graph-panel" aria-labelledby="graph-title">
      <div className="graph-heading">
        <div><span>00 / Evidence map</span><h2 id="graph-title">{subject === 'claims' ? 'Claim' : 'Requirement'} → artifact relationships</h2></div>
        <p>{subject === 'claims' ? 'Generated claims only produce suggestion edges.' : 'Solid edges are exact IDs. Moving edges are suggestions.'}</p>
      </div>
      <div className="graph-canvas" role="img" aria-label={`${requirements.length} ${subject} mapped to associated implementation and test artifacts`}>
        <ReactFlow
          nodes={model.nodes}
          edges={edges}
          onInit={(instance) => {
            refit.current = () => { void instance.fitView({ padding: 0.22 }) }
          }}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          minZoom={0.35}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(32,32,28,.18)" gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  )
}

import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

/* ── 节点类型 → 颜色/尺寸/形状映射 ── */
const TYPE_CONFIG = {
  course:           { color: '#d4a853', size: 1.0,  shape: 'dodecahedron', label: '课程' },
  chapter:          { color: '#5a9e6f', size: 0.75, shape: 'box',          label: '章节' },
  knowledge_point:  { color: '#4a90d9', size: 0.55, shape: 'sphere',      label: '知识点' },
  objective:        { color: '#e07c4f', size: 0.65, shape: 'octahedron',  label: '目标' },
  skill:            { color: '#8b6fb0', size: 0.6,  shape: 'tetrahedron', label: '技能' },
  case:             { color: '#e05d6f', size: 0.5,  shape: 'icosahedron', label: '案例' },
  exercise:         { color: '#3db8a0', size: 0.5,  shape: 'cone',        label: '练习' },
  resource:         { color: '#7a8b99', size: 0.45, shape: 'torus',       label: '资源' },
}

/* ── 难度 → 颜色叠加 ── */
const DIFFICULTY_COLORS = {
  beginner: '#4ade80',
  intermediate: '#facc15',
  advanced: '#f87171',
}

/* ── 边类型 → 颜色/标签映射 ── */
const EDGE_COLORS = {
  contains:            '#5a9e6f',
  prerequisite:        '#e07c4f',
  related:             '#4a90d9',
  supports_objective:  '#d4a853',
  applies_to:          '#8b6fb0',
  assesses:            '#3db8a0',
  recommended_after:   '#e05d6f',
}

/* ── 3D 力导向布局（性能自适应迭代次数） ── */
export function useForceLayout(nodes, edges, layoutMode = 'force') {
  return useMemo(() => {
    if (!nodes.length) return { positions: {}, links: [] }

    if (layoutMode === 'lanes') {
      const positions = {}
      const chapters = nodes
        .filter((n) => n.node_type === 'chapter')
        .sort((a, b) => ((a.properties?.order_index ?? 999) - (b.properties?.order_index ?? 999)))
      const courseNodes = nodes.filter((n) => n.node_type === 'course')
      const otherNodes = nodes.filter((n) => !['course', 'chapter', 'knowledge_point'].includes(n.node_type))
      const chapterIndex = new Map(chapters.map((chapter, index) => [chapter.label || chapter.name || chapter.id, index]))
      const laneGap = Math.max(4, Math.min(8, 90 / Math.max(chapters.length, 1)))
      const startY = ((chapters.length - 1) * laneGap) / 2

      courseNodes.forEach((node, index) => {
        positions[node.id] = new THREE.Vector3(-12, index * 3, 0)
      })

      chapters.forEach((chapter, index) => {
        const y = startY - index * laneGap
        positions[chapter.id] = new THREE.Vector3(-5, y, 0)
      })

      const groupedKps = {}
      nodes.filter((n) => n.node_type === 'knowledge_point').forEach((node) => {
        const chapterTitle = node.properties?.chapter || ''
        const key = chapterIndex.has(chapterTitle) ? chapterTitle : '__ungrouped'
        if (!groupedKps[key]) groupedKps[key] = []
        groupedKps[key].push(node)
      })

      Object.entries(groupedKps).forEach(([chapterTitle, group], laneIndex) => {
        const index = chapterTitle === '__ungrouped' ? chapters.length + laneIndex : chapterIndex.get(chapterTitle)
        const y = startY - index * laneGap
        group
          .sort((a, b) => ((a.properties?.order_index ?? 999) - (b.properties?.order_index ?? 999)))
          .forEach((node, kpIndex) => {
            const col = kpIndex % 8
            const row = Math.floor(kpIndex / 8)
            positions[node.id] = new THREE.Vector3(col * 3.2, y - row * 1.5, (row % 2) * 2.2 - 1.1)
          })
      })

      otherNodes.forEach((node, index) => {
        positions[node.id] = new THREE.Vector3(28, startY - index * 2.4, 0)
      })

      const links = edges
        .filter((e) => positions[e.source_node_id ?? e.source] && positions[e.target_node_id ?? e.target])
        .map((e) => ({
          source: e.source_node_id ?? e.source,
          target: e.target_node_id ?? e.target,
          weight: e.weight ?? 1,
          type: e.edge_type,
          edge: e,
        }))
      return { positions, links }
    }

    const iterations = nodes.length > 200 ? 40 : nodes.length > 100 ? 80 : 120
    const positions = {}

    // 初始化位置：按类型分层球面分布
    const typeGroups = {}
    nodes.forEach((n) => {
      const t = n.node_type || 'knowledge_point'
      if (!typeGroups[t]) typeGroups[t] = []
      typeGroups[t].push(n)
    })

    const layerRadius = { course: 0, chapter: 6, objective: 9, skill: 12, knowledge_point: 15, case: 18, exercise: 18, resource: 20 }
    Object.entries(typeGroups).forEach(([type, group]) => {
      const r = layerRadius[type] ?? 14
      group.forEach((n, i) => {
        const phi = Math.acos(-1 + (2 * i + 1) / group.length)
        const theta = Math.sqrt(group.length * Math.PI) * phi
        positions[n.id] = new THREE.Vector3(
          r * Math.cos(theta) * Math.sin(phi),
          r * Math.sin(theta) * Math.sin(phi) * 0.6,
          r * Math.cos(phi)
        )
      })
    })

    const nodeIds = nodes.map((n) => n.id)
    const edgePairs = edges
      .filter((e) => positions[e.source_node_id ?? e.source] && positions[e.target_node_id ?? e.target])
      .map((e) => ({
        source: e.source_node_id ?? e.source,
        target: e.target_node_id ?? e.target,
        weight: e.weight ?? 1,
        type: e.edge_type,
        edge: e,
      }))

    const repulsion = 30
    const attraction = 0.008
    const damping = 0.85

    for (let iter = 0; iter < iterations; iter++) {
      const forces = {}
      nodeIds.forEach((id) => { forces[id] = new THREE.Vector3() })

      const sampleSize = nodeIds.length > 150 ? Math.min(nodeIds.length, 80) : nodeIds.length
      for (let i = 0; i < nodeIds.length; i++) {
        const a = nodeIds[i]
        for (let j = i + 1; j < Math.min(i + sampleSize, nodeIds.length); j++) {
          const b = nodeIds[j]
          const diff = new THREE.Vector3().subVectors(positions[a], positions[b])
          const dist = Math.max(diff.length(), 0.5)
          const f = diff.normalize().multiplyScalar(repulsion / (dist * dist))
          forces[a].add(f)
          forces[b].sub(f)
        }
      }

      edgePairs.forEach(({ source, target, weight }) => {
        const diff = new THREE.Vector3().subVectors(positions[target], positions[source])
        const dist = diff.length()
        const f = diff.normalize().multiplyScalar(attraction * dist * weight)
        forces[source].add(f)
        forces[target].sub(f)
      })

      nodeIds.forEach((id) => {
        positions[id].add(forces[id].multiplyScalar(damping))
      })
    }

    return { positions, links: edgePairs }
  }, [nodes, edges, layoutMode])
}

/* ── 相机聚焦动画组件 ── */
function CameraFocus({ target, distance = 12 }) {
  const { camera } = useThree()
  const animating = useRef(false)
  const startPos = useRef(new THREE.Vector3())
  const endPos = useRef(new THREE.Vector3())
  const progress = useRef(0)

  useEffect(() => {
    if (!target) return
    startPos.current.copy(camera.position)
    endPos.current.set(
      target.x + distance * 0.5,
      target.y + distance * 0.3,
      target.z + distance
    )
    progress.current = 0
    animating.current = true
  }, [target, distance, camera])

  useFrame((_, delta) => {
    if (!animating.current) return
    progress.current = Math.min(1, progress.current + delta * 2)
    const t = 1 - Math.pow(1 - progress.current, 3) // ease-out cubic
    camera.position.lerpVectors(startPos.current, endPos.current, t)
    camera.lookAt(target)
    if (progress.current >= 1) animating.current = false
  })

  return null
}

/* ── 单个节点组件（含防误触逻辑） ── */
function GraphNode({ node, position, isSelected, isHighlighted, isOnPath, isExpanded, onClick, onDoubleClick, lowDetail }) {
  const meshRef = useRef()
  const config = TYPE_CONFIG[node.node_type] || TYPE_CONFIG.knowledge_point
  const [hovered, setHovered] = useState(false)
  // 防误触：记录鼠标按下位置，拖动超过阈值则判定为拖拽而非点击
  const pointerDownPos = useRef(null)
  const DRAG_THRESHOLD = 5 // 像素

  // 难度颜色
  const difficulty = node.properties?.difficulty
  const difficultyColor = DIFFICULTY_COLORS[difficulty]

  const color = isSelected ? '#ffffff' : isOnPath ? '#ffd700' : config.color
  const emissive = isSelected ? '#d4a853' : isOnPath ? '#ffd700' : hovered ? config.color : '#000000'
  const baseScale = config.size * (hovered ? 1.25 : 1) * (isOnPath ? 1.15 : 1) * (isExpanded ? 1.3 : 1)

  useFrame((state) => {
    if (!meshRef.current) return
    if (isOnPath) {
      const t = state.clock.elapsedTime
      meshRef.current.scale.setScalar(baseScale * (1 + 0.08 * Math.sin(t * 3)))
    } else if (meshRef.current.scale.x !== baseScale) {
      meshRef.current.scale.setScalar(baseScale)
    }
  })

  const geoDetail = lowDetail ? 0 : undefined
  const sphereSeg = lowDetail ? 8 : 16

  const geometry = useMemo(() => {
    switch (config.shape) {
      case 'dodecahedron': return <dodecahedronGeometry args={[1, geoDetail ?? 0]} />
      case 'box':          return <boxGeometry args={[1.4, 1.4, 1.4]} />
      case 'octahedron':   return <octahedronGeometry args={[1, geoDetail ?? 0]} />
      case 'tetrahedron':  return <tetrahedronGeometry args={[1, geoDetail ?? 0]} />
      case 'icosahedron':  return <icosahedronGeometry args={[1, geoDetail ?? 0]} />
      case 'cone':         return <coneGeometry args={[0.8, 1.6, lowDetail ? 6 : 8]} />
      case 'torus':        return <torusGeometry args={[0.7, 0.25, lowDetail ? 6 : 8, lowDetail ? 8 : 16]} />
      default:             return <sphereGeometry args={[1, sphereSeg, sphereSeg]} />
    }
  }, [config.shape, lowDetail, geoDetail, sphereSeg])

  // 判断是否为拖拽操作（鼠标移动超过阈值）
  const isDragAction = (e) => {
    if (!pointerDownPos.current) return false
    const dx = e.clientX - pointerDownPos.current.x
    const dy = e.clientY - pointerDownPos.current.y
    return Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD
  }

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        scale={baseScale}
        onPointerDown={(e) => {
          e.stopPropagation()
          pointerDownPos.current = { x: e.clientX, y: e.clientY }
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!isDragAction(e)) onClick(node)
          pointerDownPos.current = null
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (!isDragAction(e)) onDoubleClick?.(node)
          pointerDownPos.current = null
        }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default' }}
      >
        {geometry}
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={isSelected ? 0.6 : isOnPath ? 0.5 : hovered ? 0.3 : 0.05}
          roughness={0.35}
          metalness={0.2}
          transparent
          opacity={isHighlighted || isSelected || isOnPath ? 1 : 0.75}
        />
      </mesh>
      {/* 难度指示环 */}
      {difficultyColor && (
        <mesh position={position} rotation={[Math.PI / 2, 0, 0]} scale={baseScale * 1.5}>
          <torusGeometry args={[1, 0.06, 8, 32]} />
          <meshBasicMaterial color={difficultyColor} transparent opacity={0.8} />
        </mesh>
      )}
      {/* 选中/展开光环 */}
      {(isSelected || isExpanded) && (
        <mesh position={position} rotation={[Math.PI / 2, 0, 0]} scale={baseScale * 1.6}>
          <torusGeometry args={[1, 0.04, 8, 32]} />
          <meshBasicMaterial color={isSelected ? '#d4a853' : '#4a90d9'} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  )
}

/* ── 边（连线）组件 ── */
function GraphEdge({ start, end, type, weight, isOnPath, isHighlighted, isSelected, onClick }) {
  const color = EDGE_COLORS[type] || '#555555'
  const opacity = isSelected ? 1 : isOnPath ? 0.95 : isHighlighted ? 0.8 : 0.15 + (weight ?? 0.5) * 0.3
  const lineWidth = isSelected ? 4 : isOnPath ? 3 : isHighlighted ? 2 : 1 + (weight ?? 0.5) * 0.5

  const points = useMemo(() => {
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5)
    const offset = new THREE.Vector3().subVectors(end, start).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.5)
    mid.add(offset)
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    return curve.getPoints(12)
  }, [start, end])

  if (isOnPath) {
    return (
      <group>
        <Line points={points} color="#ffd700" lineWidth={3} transparent opacity={0.95} dashed dashSize={0.5} gapSize={0.3} />
        <Line points={points} color="#ffffff" lineWidth={10} transparent opacity={0.001} onClick={onClick} />
      </group>
    )
  }

  return (
    <group>
      <Line points={points} color={isSelected ? '#ffffff' : color} lineWidth={lineWidth} transparent opacity={opacity} />
      <Line points={points} color="#ffffff" lineWidth={10} transparent opacity={0.001} onClick={onClick} />
    </group>
  )
}

/* ── 节点标签（含内容简析） ── */
function NodeLabel({ position, text, node, isSelected, isExpanded, lowDetail }) {
  if (lowDetail && !isSelected && !isExpanded) return null

  const isKnowledgePoint = node?.node_type === 'knowledge_point'
  const showSummary = isKnowledgePoint && (node?.description || node?.properties?.summary)
  const summaryText = showSummary
    ? (node.description || node.properties.summary || '')
    : ''

  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    const hasSummary = summaryText.length > 0
    c.width = 512
    c.height = hasSummary ? 128 : 64
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)

    // 节点名称
    const fontSize = isSelected || isExpanded ? 24 : 20
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = isSelected ? '#d4a853' : isExpanded ? '#4a90d9' : '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const maxLen = isSelected || isExpanded ? 18 : 12
    const display = text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text
    ctx.fillText(display, c.width / 2, hasSummary ? 30 : c.height / 2)

    // 内容简析（仅知识点节点显示）
    if (hasSummary) {
      const summarySize = isSelected || isExpanded ? 16 : 13
      ctx.font = `${summarySize}px sans-serif`
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      const maxSummaryLen = isSelected || isExpanded ? 36 : 24
      const summaryDisplay = summaryText.length > maxSummaryLen
        ? summaryText.slice(0, maxSummaryLen - 1) + '…'
        : summaryText
      ctx.fillText(summaryDisplay, c.width / 2, 85)
    }

    return c
  }, [text, summaryText, isSelected, isExpanded])

  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas])
  const labelScale = isSelected || isExpanded
    ? (summaryText ? [5.5, 1.4, 1] : [3.5, 0.9, 1])
    : (summaryText ? [4.5, 1.1, 1] : [2.8, 0.7, 1])

  return (
    <sprite position={[position.x, position.y + 1.4, position.z]} scale={labelScale}>
      <spriteMaterial map={texture} transparent opacity={0.95} depthTest={false} />
    </sprite>
  )
}

/* ── 主场景组件 ── */
export default function KnowledgeGraphScene({
  nodes = [],
  edges = [],
  selectedNodeId,
  highlightedNodes = [],
  pathNodeIds = [],
  pathEdgeKeys = [],
  focusTarget,
  onNodeClick,
  onNodeDoubleClick,
  onEdgeClick,
  selectedEdgeKey,
  layoutMode = 'force',
}) {
  const { positions, links } = useForceLayout(nodes, edges, layoutMode)
  const [lowDetail, setLowDetail] = useState(false)

  useEffect(() => {
    setLowDetail(nodes.length > 150)
  }, [nodes.length])

  const highlightedSet = useMemo(() => new Set(highlightedNodes), [highlightedNodes])
  const pathNodeSet = useMemo(() => new Set(pathNodeIds), [pathNodeIds])
  const pathEdgeSet = useMemo(() => new Set(pathEdgeKeys), [pathEdgeKeys])

  // 选中节点的关联边
  const highlightedEdgeSet = useMemo(() => {
    if (!selectedNodeId) return new Set()
    const set = new Set()
    links.forEach((link) => {
      if (link.source === selectedNodeId || link.target === selectedNodeId) {
        set.add(`${link.source}-${link.target}-${link.type}`)
      }
    })
    return set
  }, [selectedNodeId, links])

  const handleNodeClick = useCallback((node) => {
    onNodeClick?.(node)
  }, [onNodeClick])

  const handleNodeDoubleClick = useCallback((node) => {
    onNodeDoubleClick?.(node)
  }, [onNodeDoubleClick])

  // 聚焦目标位置
  const focusPosition = useMemo(() => {
    if (!focusTarget) return null
    return positions[focusTarget] || null
  }, [focusTarget, positions])

  return (
    <group>
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 30, 20]} intensity={0.8} />
      <pointLight position={[-15, -10, -15]} intensity={0.3} color="#4a90d9" />

      {/* 相机聚焦动画 */}
      {focusPosition && <CameraFocus target={focusPosition} />}

      {/* 边 */}
      {links.map((link) => {
        const s = positions[link.source]
        const t = positions[link.target]
        if (!s || !t) return null
        const key = `${link.source}-${link.target}-${link.type}`
        return (
          <GraphEdge
            key={key}
            start={s}
            end={t}
            type={link.type}
            weight={link.weight}
            isOnPath={pathEdgeSet.has(key)}
            isHighlighted={highlightedEdgeSet.has(key)}
            isSelected={selectedEdgeKey === key}
            onClick={(e) => { e.stopPropagation(); onEdgeClick?.(link.edge) }}
          />
        )
      })}

      {/* 节点 */}
      {nodes.map((node) => {
        const pos = positions[node.id]
        if (!pos) return null
        const isSelected = selectedNodeId === node.id
        const isHighlighted = highlightedSet.has(node.id)
        const isOnPath = pathNodeSet.has(node.id)
        const isExpanded = false
        return (
          <group key={node.id}>
            <GraphNode
              node={node}
              position={pos}
              isSelected={isSelected}
              isHighlighted={isHighlighted}
              isOnPath={isOnPath}
              isExpanded={isExpanded}
              onClick={handleNodeClick}
              onDoubleClick={handleNodeDoubleClick}
              lowDetail={lowDetail}
            />
            <NodeLabel
              position={pos}
              text={node.label || node.name || ''}
              node={node}
              isSelected={isSelected}
              isExpanded={isExpanded}
              lowDetail={lowDetail}
            />
          </group>
        )
      })}
    </group>
  )
}

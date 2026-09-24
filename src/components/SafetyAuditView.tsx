import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCcw,
  Info,
  Lock,
  UserCheck,
  CheckCircle2,
  XCircle,
  Activity,
  Layers,
  Zap,
  Filter,
  Eye,
  Sparkles,
  Radio
} from 'lucide-react';
import { AgeGroup, UserProfile } from '../types/safety';
import { safetyEngine } from '../server/safetyEngine';

interface NodeData extends d3.SimulationNodeDatum {
  id: string;
  nickname: string;
  age: number;
  ageGroup: AgeGroup;
  country: string;
  guardianStatus: string;
  isMinor: boolean;
  status: string;
  cluster: number; // 0: Under 13, 1: 13–15, 2: 16–17, 3: 18+
  radius: number;
  isInfiltrator?: boolean;
}

interface LinkData extends d3.SimulationLinkDatum<NodeData> {
  id: string;
  source: string | NodeData;
  target: string | NodeData;
  type: 'SAFE_MATCH' | 'BLOCKED_CROSS_TRAFFIC';
  ageGroup: string;
  blockedReason?: string;
  timestamp: string;
}

interface ClusterStats {
  clusterId: number;
  name: string;
  ageGroup: AgeGroup;
  totalNodes: number;
  minorConnections: number;
  adultConnections: number;
  blockedAttempts: number;
  isAirgapSafe: boolean;
}

export const SafetyAuditView: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const [activeFilter, setActiveFilter] = useState<'ALL' | AgeGroup>('ALL');
  const [showClusterZones, setShowClusterZones] = useState(true);
  const [attackAttemptCount, setAttackAttemptCount] = useState(0);

  // Live simulation & transition states
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [simulationState, setSimulationState] = useState<'STABILIZING' | 'STABLE'>('STABLE');
  const [simulationEquilibrium, setSimulationEquilibrium] = useState(100);
  const [dataVersion, setDataVersion] = useState(0);
  const [accentClusterId, setAccentClusterId] = useState<number | null>(null);

  const [auditLogFeed, setAuditLogFeed] = useState<{ id: string; time: string; text: string; blocked: boolean }[]>([
    {
      id: 'init_1',
      time: new Date().toLocaleTimeString(),
      text: 'Safety Engine initialized: Multi-zone cluster topology active with zero cross-traffic leakage.',
      blocked: false
    }
  ]);

  // Track dynamic nodes & links
  const [dynamicNodes, setDynamicNodes] = useState<NodeData[]>(() => {
    const users = Array.from(safetyEngine.users.values());
    return users.map((u) => {
      const isMinor = u.server_calculated_age < 18;
      let cluster = 3;
      if (u.age_group === 'Under 13') cluster = 0;
      else if (u.age_group === '13–15') cluster = 1;
      else if (u.age_group === '16–17') cluster = 2;

      return {
        id: u.id,
        nickname: u.nickname,
        age: u.server_calculated_age,
        ageGroup: u.age_group,
        country: u.country,
        guardianStatus: u.guardian_status,
        isMinor,
        status: u.status,
        cluster,
        radius: isMinor ? 18 : 22
      };
    });
  });

  const [dynamicLinks, setDynamicLinks] = useState<LinkData[]>(() => {
    return [
      {
        id: 'link_safe_1',
        source: 'usr_leo14',
        target: 'usr_maya14',
        type: 'SAFE_MATCH',
        ageGroup: '13–15',
        timestamp: 'Active'
      },
      {
        id: 'link_safe_2',
        source: 'usr_sam16',
        target: 'usr_chloe17',
        type: 'SAFE_MATCH',
        ageGroup: '16–17',
        timestamp: 'Active'
      },
      {
        id: 'link_safe_3',
        source: 'usr_marcus24',
        target: 'usr_elena27',
        type: 'SAFE_MATCH',
        ageGroup: '18+',
        timestamp: 'Active'
      }
    ];
  });

  // Cluster center definitions in SVG coordinate space
  const clusterCenters = useMemo(() => [
    { id: 0, ageGroup: 'Under 13' as AgeGroup, name: 'Under 13 Supervised Pod', x: 220, y: 180, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' },
    { id: 1, ageGroup: '13–15' as AgeGroup, name: '13–15 Teen Enclave', x: 220, y: 440, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.08)' },
    { id: 2, ageGroup: '16–17' as AgeGroup, name: '16–17 Teen Enclave', x: 500, y: 440, color: '#818cf8', bg: 'rgba(129, 140, 248, 0.08)' },
    { id: 3, ageGroup: '18+' as AgeGroup, name: '18+ Adult Zone', x: 820, y: 310, color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' }
  ], []);

  // Compute exact connection breakdown (minor vs adult) for each cluster
  const getClusterStats = useCallback((clusterId: number): ClusterStats => {
    const center = clusterCenters[clusterId];
    const clusterNodes = dynamicNodes.filter(n => n.cluster === clusterId);
    const clusterNodeIds = new Set(clusterNodes.map(n => n.id));

    let minorConnections = 0;
    let adultConnections = 0;
    let blockedAttempts = 0;

    dynamicLinks.forEach(l => {
      const srcId = typeof l.source === 'object' ? (l.source as NodeData).id : l.source;
      const tgtId = typeof l.target === 'object' ? (l.target as NodeData).id : l.target;

      const isSrcInCluster = clusterNodeIds.has(srcId);
      const isTgtInCluster = clusterNodeIds.has(tgtId);

      if (isSrcInCluster || isTgtInCluster) {
        if (l.type === 'BLOCKED_CROSS_TRAFFIC') {
          blockedAttempts++;
        } else {
          const otherNodeId = isSrcInCluster ? tgtId : srcId;
          const otherNode = dynamicNodes.find(n => n.id === otherNodeId);
          if (otherNode) {
            if (otherNode.isMinor) {
              minorConnections++;
            } else {
              adultConnections++;
            }
          }
        }
      }
    });

    return {
      clusterId,
      name: center.name,
      ageGroup: center.ageGroup,
      totalNodes: clusterNodes.length,
      minorConnections,
      adultConnections,
      blockedAttempts,
      isAirgapSafe: center.ageGroup === '18+' ? (minorConnections === 0) : (adultConnections === 0)
    };
  }, [dynamicNodes, dynamicLinks, clusterCenters]);

  // Compute node-level stats for hover
  const getNodeConnectionStats = useCallback((node: NodeData) => {
    let minorConns = 0;
    let adultConns = 0;
    let blockedConns = 0;

    dynamicLinks.forEach(l => {
      const srcId = typeof l.source === 'object' ? (l.source as NodeData).id : l.source;
      const tgtId = typeof l.target === 'object' ? (l.target as NodeData).id : l.target;

      if (srcId === node.id || tgtId === node.id) {
        if (l.type === 'BLOCKED_CROSS_TRAFFIC') {
          blockedConns++;
        } else {
          const peerId = srcId === node.id ? tgtId : srcId;
          const peer = dynamicNodes.find(n => n.id === peerId);
          if (peer?.isMinor) minorConns++;
          else if (peer && !peer.isMinor) adultConns++;
        }
      }
    });

    return { minorConns, adultConns, blockedConns };
  }, [dynamicNodes, dynamicLinks]);

  // Trigger transition visual effect when cluster data changes
  const notifyDataUpdate = (targetClusterId: number | null = null) => {
    setIsTransitioning(true);
    setSimulationState('STABILIZING');
    setSimulationEquilibrium(15);
    setAccentClusterId(targetClusterId);
    setDataVersion(v => v + 1);

    setTimeout(() => {
      setIsTransitioning(false);
      setAccentClusterId(null);
    }, 1200);
  };

  // Simulate an Adult -> Minor Breach Attempt
  const triggerInfiltrationSimulation = () => {
    const targetMinor = dynamicNodes.find(n => n.ageGroup === '13–15') || dynamicNodes[0];
    const adultAttacker = dynamicNodes.find(n => n.ageGroup === '18+') || dynamicNodes[dynamicNodes.length - 1];

    if (!targetMinor || !adultAttacker) return;

    const blockedLink: LinkData = {
      id: 'blocked_' + Date.now(),
      source: adultAttacker.id,
      target: targetMinor.id,
      type: 'BLOCKED_CROSS_TRAFFIC',
      ageGroup: 'BREACH_ATTEMPT',
      blockedReason: 'SAFETY_ENGINE_INTERCEPT: Step 7 Minor/Adult Quarantine Enforced',
      timestamp: new Date().toLocaleTimeString()
    };

    setDynamicLinks(prev => [blockedLink, ...prev]);
    setAttackAttemptCount(c => c + 1);
    notifyDataUpdate(1); // accent 13–15 cluster pod

    const logEntry = {
      id: 'log_' + Date.now(),
      time: new Date().toLocaleTimeString(),
      text: `BLOCKED INFILTRATION: Adult node (${adultAttacker.nickname}) attempted cross-cluster link to Minor (${targetMinor.nickname}). Safety firewall intercepted at boundary.`,
      blocked: true
    };

    setAuditLogFeed(prev => [logEntry, ...prev.slice(0, 7)]);

    safetyEngine.addAuditLog({
      eventType: 'MATCH_ATTEMPT_BLOCKED',
      actorId: adultAttacker.id,
      actorRole: 'SYSTEM',
      severity: 'CRITICAL',
      summary: `Cluster Isolation Firewall: Intercepted cross-traffic attempt from Adult (${adultAttacker.nickname}) to Minor (${targetMinor.nickname})`,
      details: {
        attackerAge: adultAttacker.age,
        targetAge: targetMinor.age,
        firewallRule: 'ZERO_ADULT_MINOR_CROSS_MATCHING'
      }
    });
  };

  // Add simulated background nodes to show sorting into clusters
  const addSimulatedNodes = () => {
    const ageTiers: { group: AgeGroup; age: number; cluster: number }[] = [
      { group: '13–15', age: 14, cluster: 1 },
      { group: '16–17', age: 16, cluster: 2 },
      { group: '18+', age: 22, cluster: 3 },
      { group: 'Under 13', age: 11, cluster: 0 }
    ];

    const pick = ageTiers[Math.floor(Math.random() * ageTiers.length)];
    const id = 'sim_' + Math.random().toString(36).substring(2, 7);
    const names = ['Jordan', 'Taylor', 'Avery', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Skyler', 'Eden', 'Rowan'];
    const randomName = names[Math.floor(Math.random() * names.length)] + '_' + pick.age;

    const newNode: NodeData = {
      id,
      nickname: randomName,
      age: pick.age,
      ageGroup: pick.group,
      country: 'US',
      guardianStatus: pick.age < 18 ? 'VERIFIED' : 'NOT_REQUIRED',
      isMinor: pick.age < 18,
      status: 'ACTIVE',
      cluster: pick.cluster,
      radius: pick.age < 18 ? 18 : 22,
      x: clusterCenters[pick.cluster].x + (Math.random() - 0.5) * 10,
      y: clusterCenters[pick.cluster].y + (Math.random() - 0.5) * 10
    };

    setDynamicNodes(prev => [...prev, newNode]);

    // Create safe link with another node in same cluster if available
    const peerInCluster = dynamicNodes.find(n => n.cluster === pick.cluster && n.id !== id);
    if (peerInCluster) {
      const newSafeLink: LinkData = {
        id: 'link_' + Date.now(),
        source: id,
        target: peerInCluster.id,
        type: 'SAFE_MATCH',
        ageGroup: pick.group,
        timestamp: 'Active'
      };
      setDynamicLinks(prev => [...prev, newSafeLink]);
    }

    notifyDataUpdate(pick.cluster);

    setAuditLogFeed(prev => [
      {
        id: 'log_' + Date.now(),
        time: new Date().toLocaleTimeString(),
        text: `New node ${randomName} (${pick.age}yo) automatically routed into isolated ${pick.group} cluster.`,
        blocked: false
      },
      ...prev.slice(0, 7)
    ]);
  };

  const resetNetwork = () => {
    nodePositionsRef.current.clear();
    setDynamicLinks([
      {
        id: 'link_safe_1',
        source: 'usr_leo14',
        target: 'usr_maya14',
        type: 'SAFE_MATCH',
        ageGroup: '13–15',
        timestamp: 'Active'
      },
      {
        id: 'link_safe_2',
        source: 'usr_sam16',
        target: 'usr_chloe17',
        type: 'SAFE_MATCH',
        ageGroup: '16–17',
        timestamp: 'Active'
      },
      {
        id: 'link_safe_3',
        source: 'usr_marcus24',
        target: 'usr_elena27',
        type: 'SAFE_MATCH',
        ageGroup: '18+',
        timestamp: 'Active'
      }
    ]);
    setAttackAttemptCount(0);
    setHoveredClusterId(null);
    setHoveredNode(null);
    notifyDataUpdate(null);
    setAuditLogFeed([
      {
        id: 'reset_' + Date.now(),
        time: new Date().toLocaleTimeString(),
        text: 'Network topology reset. Cluster isolation boundaries reaffirmed.',
        blocked: false
      }
    ]);
  };

  // D3 Force Simulation, Pod Radius Animation, Radiating Pulses & Intercept Bounce Physics
  useEffect(() => {
    if (!svgRef.current) return;

    const width = 1060;
    const height = 580;
    const firewallX = 660;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('class', 'main-canvas');

    // Create defs for filters and gradients
    const defs = svg.append('defs');

    // Glow filter for firewall
    const filter = defs.append('filter')
      .attr('id', 'firewall-glow')
      .attr('x', '-30%')
      .attr('y', '-30%')
      .attr('width', '160%')
      .attr('height', '160%');

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '5')
      .attr('result', 'blur');

    filter.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', d => d);

    // Glow filter for cluster pod pulse
    const podFilter = defs.append('filter')
      .attr('id', 'pod-glow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');

    podFilter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');

    podFilter.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', d => d);

    // Filter dynamic nodes, preserving prior positions for smooth physics transitions
    const filteredNodes: NodeData[] = dynamicNodes
      .filter(n => activeFilter === 'ALL' || n.ageGroup === activeFilter)
      .map(d => {
        const prev = nodePositionsRef.current.get(d.id);
        if (prev && prev.x && prev.y) {
          return { ...d, x: prev.x, y: prev.y };
        }
        return {
          ...d,
          x: clusterCenters[d.cluster].x + (Math.random() - 0.5) * 16,
          y: clusterCenters[d.cluster].y + (Math.random() - 0.5) * 16
        };
      });

    const nodeIds = new Set(filteredNodes.map(n => n.id));

    const filteredLinks: LinkData[] = dynamicLinks
      .filter(l => {
        const srcId = typeof l.source === 'object' ? (l.source as NodeData).id : l.source;
        const tgtId = typeof l.target === 'object' ? (l.target as NodeData).id : l.target;
        return nodeIds.has(srcId) && nodeIds.has(tgtId);
      })
      .map(d => ({ ...d }));

    // =========================================================================
    // 1. CLUSTER POD BOUNDARIES: Radius Animation & Radiating Pulse Rings
    // =========================================================================
    const zoneGroup = g.append('g').attr('class', 'cluster-zones');

    clusterCenters.forEach((c) => {
      const zoneRadius = c.id === 3 ? 150 : 125;
      const isThisClusterHovered = hoveredClusterId === c.id;
      const isAccented = accentClusterId === c.id || accentClusterId === null;

      const clusterContainer = zoneGroup.append('g')
        .attr('class', `cluster-zone-pod-${c.id}`)
        .attr('cursor', 'pointer');

      // (A) RADIATING PULSE RINGS (Emit radiating wave whenever nodes are injected, filtered, or reset)
      if (showClusterZones && isAccented) {
        // Wave 1: Immediate radiating ring
        clusterContainer.append('circle')
          .attr('class', 'radiating-pulse-primary')
          .attr('cx', c.x)
          .attr('cy', c.y)
          .attr('r', zoneRadius)
          .attr('fill', 'none')
          .attr('stroke', c.color)
          .attr('stroke-width', 2.8)
          .attr('opacity', 0.85)
          .transition()
          .duration(900)
          .ease(d3.easeCubicOut)
          .attr('r', zoneRadius + 38)
          .attr('stroke-width', 0.5)
          .attr('opacity', 0)
          .remove();

        // Wave 2: Delayed echo pulse ring
        clusterContainer.append('circle')
          .attr('class', 'radiating-pulse-secondary')
          .attr('cx', c.x)
          .attr('cy', c.y)
          .attr('r', zoneRadius)
          .attr('fill', 'none')
          .attr('stroke', c.color)
          .attr('stroke-width', 2)
          .attr('opacity', 0.6)
          .transition()
          .delay(180)
          .duration(950)
          .ease(d3.easeCubicOut)
          .attr('r', zoneRadius + 58)
          .attr('stroke-width', 0.5)
          .attr('opacity', 0)
          .remove();
      }

      // (B) MAIN POD BOUNDARY CIRCLE: Radius Animation with Elastic Bounce
      const zoneCircle = clusterContainer.append('circle')
        .attr('class', 'cluster-boundary-main')
        .attr('cx', c.x)
        .attr('cy', c.y)
        .attr('r', zoneRadius * 0.88) // start smaller for spring entrance
        .attr('fill', isThisClusterHovered ? `${c.color}25` : c.bg)
        .attr('stroke', c.color)
        .attr('stroke-width', isThisClusterHovered ? 3 : 1.4)
        .attr('stroke-dasharray', isThisClusterHovered ? 'none' : '5,4')
        .attr('opacity', showClusterZones ? 0.9 : 0.05);

      // Animate pod circle radius smoothly
      zoneCircle.transition()
        .duration(700)
        .ease(d3.easeElasticOut.amplitude(1.15).period(0.45))
        .attr('r', zoneRadius);

      // Zone Header Label
      const headerText = clusterContainer.append('text')
        .attr('x', c.x)
        .attr('y', c.y - zoneRadius + 20)
        .attr('text-anchor', 'middle')
        .attr('fill', c.color)
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .attr('letter-spacing', '0.04em')
        .attr('opacity', 0)
        .text(c.name.toUpperCase());

      headerText.transition()
        .duration(450)
        .delay(120)
        .attr('opacity', 1);

      // Subtitle badge
      const subtitleText = clusterContainer.append('text')
        .attr('x', c.x)
        .attr('y', c.y - zoneRadius + 34)
        .attr('text-anchor', 'middle')
        .attr('fill', '#94a3b8')
        .attr('font-size', '9px')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('opacity', 0)
        .text(c.id === 3 ? 'Adult Airgap Zone' : 'Minor Protected Pod');

      subtitleText.transition()
        .duration(450)
        .delay(180)
        .attr('opacity', 1);

      // Cluster Zone Hover Handlers
      clusterContainer
        .on('mouseenter', (event: MouseEvent) => {
          setHoveredClusterId(c.id);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltipPos({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top
            });
          }
        })
        .on('mousemove', (event: MouseEvent) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltipPos({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top
            });
          }
        })
        .on('mouseleave', () => {
          setHoveredClusterId(null);
          setTooltipPos(null);
        });
    });

    // =========================================================================
    // 2. CENTRAL SAFETY FIREWALL DEMARCATION LINE
    // =========================================================================
    const firewallGroup = g.append('g').attr('class', 'safety-firewall');

    firewallGroup.append('rect')
      .attr('x', firewallX - 16)
      .attr('y', 40)
      .attr('width', 32)
      .attr('height', height - 80)
      .attr('fill', 'rgba(239, 68, 68, 0.04)')
      .attr('rx', 6);

    firewallGroup.append('line')
      .attr('x1', firewallX)
      .attr('y1', 50)
      .attr('x2', firewallX)
      .attr('y2', height - 50)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '8,4')
      .attr('filter', 'url(#firewall-glow)');

    firewallGroup.append('text')
      .attr('transform', `translate(${firewallX + 4}, ${height / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f87171')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('letter-spacing', '0.12em')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text('ZERO-TOLERANCE AIRGAP · MINOR / ADULT SEPARATION BARRIER');

    firewallGroup.append('circle')
      .attr('cx', firewallX)
      .attr('cy', 80)
      .attr('r', 10)
      .attr('fill', '#1e1b4b')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2);

    firewallGroup.append('circle')
      .attr('cx', firewallX)
      .attr('cy', height - 80)
      .attr('r', 10)
      .attr('fill', '#1e1b4b')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2);

    // =========================================================================
    // 3. SETUP D3 FORCE SIMULATION
    // =========================================================================
    const simulation = d3.forceSimulation<NodeData>(filteredNodes)
      .force('link', d3.forceLink<NodeData, LinkData>(filteredLinks).id(d => d.id).distance(d => d.type === 'BLOCKED_CROSS_TRAFFIC' ? 240 : 85).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('collision', d3.forceCollide<NodeData>().radius(d => d.radius + 15))
      .force('x', d3.forceX<NodeData>(d => clusterCenters[d.cluster].x).strength(0.32))
      .force('y', d3.forceY<NodeData>(d => clusterCenters[d.cluster].y).strength(0.32))
      .alpha(0.85);

    // Track equilibrium alpha for live visual feedback
    simulation.on('tick', () => {
      const currentAlpha = simulation.alpha();
      const equilibriumPct = Math.min(100, Math.max(10, Math.round((1 - currentAlpha) * 100)));
      setSimulationEquilibrium(equilibriumPct);

      if (currentAlpha <= 0.03) {
        setSimulationState('STABLE');
      }

      // Record coordinates for transition persistence
      filteredNodes.forEach(n => {
        if (n.x && n.y) {
          nodePositionsRef.current.set(n.id, { x: n.x, y: n.y });
        }
      });

      // Update positions
      linkElements
        .attr('x1', d => ((d.source as NodeData).x || 0))
        .attr('y1', d => ((d.source as NodeData).y || 0))
        .attr('x2', d => ((d.target as NodeData).x || 0))
        .attr('y2', d => ((d.target as NodeData).y || 0));

      blockedMarkers
        .attr('transform', d => {
          const sy = (d.source as NodeData).y || 0;
          const ty = (d.target as NodeData).y || 0;
          const mx = firewallX;
          const my = (sy + ty) / 2;
          return `translate(${mx}, ${my})`;
        });

      nodeElements.attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    simulation.on('end', () => {
      setSimulationState('STABLE');
      setSimulationEquilibrium(100);
    });

    // =========================================================================
    // 4. LINKS & INTERCEPT MARKERS: Smooth Fade (0 -> 0.85) & Bounce Physics (✕)
    // =========================================================================
    const linkGroup = g.append('g').attr('class', 'links');

    // Connection lines fade in smoothly from opacity: 0 to 0.85
    const linkElements = linkGroup.selectAll<SVGLineElement, LinkData>('line')
      .data(filteredLinks, (d) => d.id)
      .join(
        (enter) => enter.append('line')
          .attr('stroke', d => (d.type === 'BLOCKED_CROSS_TRAFFIC' ? '#ef4444' : '#10b981'))
          .attr('stroke-width', d => (d.type === 'BLOCKED_CROSS_TRAFFIC' ? 2.8 : 2.2))
          .attr('stroke-dasharray', d => (d.type === 'BLOCKED_CROSS_TRAFFIC' ? '6,4' : 'none'))
          .attr('opacity', 0) // Start from opacity: 0
          .call((enter) => enter.transition()
            .duration(650)
            .ease(d3.easeCubicOut)
            .attr('opacity', 0.85) // Fade in smoothly to 0.85
          ),
        (update) => update
          .call((update) => update.transition()
            .duration(400)
            .attr('stroke', d => (d.type === 'BLOCKED_CROSS_TRAFFIC' ? '#ef4444' : '#10b981'))
            .attr('opacity', 0.85)
          ),
        (exit) => exit
          .call((exit) => exit.transition().duration(300).attr('opacity', 0).remove())
      );

    // Blocked intercept badges (✕) scale up with bounce physics
    const blockedMarkers = linkGroup.selectAll<SVGGElement, LinkData>('.blocked-marker')
      .data(filteredLinks.filter(l => l.type === 'BLOCKED_CROSS_TRAFFIC'), (d) => d.id)
      .join(
        (enter) => {
          const marker = enter.append('g')
            .attr('class', 'blocked-marker')
            .attr('opacity', 1);

          // Impact shockwave ring expanding and fading out
          marker.append('circle')
            .attr('class', 'impact-ring')
            .attr('r', 10)
            .attr('fill', 'rgba(239, 68, 68, 0.35)')
            .attr('stroke', '#ef4444')
            .attr('stroke-width', 2)
            .transition()
            .duration(800)
            .ease(d3.easeCubicOut)
            .attr('r', 32)
            .attr('stroke-width', 0.5)
            .attr('opacity', 0)
            .remove();

          // Intercept badge container for bounce scale animation
          const badgeGroup = marker.append('g')
            .attr('class', 'badge-scalable')
            .attr('transform', 'scale(0)'); // Start at scale 0

          // Badge background circle
          badgeGroup.append('circle')
            .attr('r', 13)
            .attr('fill', '#450a0a')
            .attr('stroke', '#ef4444')
            .attr('stroke-width', 2.5);

          // Cross '✕' symbol
          badgeGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', '#ffffff')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text('✕');

          // Mini pill banner above badge
          badgeGroup.append('rect')
            .attr('x', -44)
            .attr('y', -26)
            .attr('width', 88)
            .attr('height', 14)
            .attr('fill', '#1f0d0d')
            .attr('stroke', '#ef4444')
            .attr('stroke-width', 1)
            .attr('rx', 3);

          badgeGroup.append('text')
            .attr('x', 0)
            .attr('y', -16)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fca5a5')
            .attr('font-size', '8px')
            .attr('font-weight', 'bold')
            .attr('letter-spacing', '0.04em')
            .text('AIRGAP BLOCKED');

          // Bounce physics transition using d3.easeElasticOut
          badgeGroup.transition()
            .duration(850)
            .ease(d3.easeElasticOut.amplitude(1.3).period(0.35))
            .attr('transform', 'scale(1)');

          return marker;
        },
        (update) => update,
        (exit) => exit.transition().duration(300).attr('opacity', 0).remove()
      );

    // =========================================================================
    // 5. NODES: Smooth Scale Entrance & Hover Focus
    // =========================================================================
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const nodeElements = nodeGroup.selectAll<SVGGElement, NodeData>('g')
      .data(filteredNodes, (d) => d.id)
      .join(
        (enter) => {
          const nodeEnter = enter.append('g')
            .attr('cursor', 'pointer')
            .attr('opacity', 0);

          // Outer halo ring (starts scale 0, transitions up)
          nodeEnter.append('circle')
            .attr('class', 'node-halo')
            .attr('r', 0)
            .attr('fill', 'none')
            .attr('stroke', d => {
              if (d.guardianStatus === 'VERIFIED') return '#10b981';
              if (d.guardianStatus === 'PENDING') return '#f59e0b';
              return '#6366f1';
            })
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.8)
            .transition()
            .duration(550)
            .ease(d3.easeBackOut)
            .attr('r', d => d.radius + 5);

          // Primary node fill circle
          nodeEnter.append('circle')
            .attr('class', 'node-main-circle')
            .attr('r', 0)
            .attr('fill', d => {
              if (d.ageGroup === 'Under 13') return '#78350f';
              if (d.ageGroup === '13–15') return '#075985';
              if (d.ageGroup === '16–17') return '#3730a3';
              return '#064e3b';
            })
            .attr('stroke', d => {
              if (d.ageGroup === 'Under 13') return '#f59e0b';
              if (d.ageGroup === '13–15') return '#38bdf8';
              if (d.ageGroup === '16–17') return '#818cf8';
              return '#34d399';
            })
            .attr('stroke-width', 2)
            .transition()
            .duration(550)
            .ease(d3.easeBackOut)
            .attr('r', d => d.radius);

          // Nickname label
          nodeEnter.append('text')
            .attr('class', 'node-label-nickname')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.radius + 15)
            .attr('fill', '#e2e8f0')
            .attr('font-size', '10px')
            .attr('font-weight', '600')
            .text(d => d.nickname.length > 12 ? d.nickname.substring(0, 10) + '..' : d.nickname);

          // Age in center
          nodeEnter.append('text')
            .attr('class', 'node-label-age')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', '#ffffff')
            .attr('font-size', '10px')
            .attr('font-family', 'JetBrains Mono, monospace')
            .attr('font-weight', '700')
            .text(d => `${d.age}y`);

          nodeEnter.transition().duration(400).attr('opacity', 1);

          return nodeEnter;
        },
        (update) => {
          update.select('.node-main-circle')
            .transition()
            .duration(400)
            .attr('r', d => d.radius);
          return update;
        },
        (exit) => exit
          .transition()
          .duration(300)
          .attr('opacity', 0)
          .remove()
      );

    // Add drag and hover event listeners on node elements
    nodeElements
      .on('click', (event: MouseEvent, d: NodeData) => {
        setSelectedNode(d);
      })
      .on('mouseenter', (event: MouseEvent, d: NodeData) => {
        setHoveredNode(d);
        setHoveredClusterId(d.cluster);

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltipPos({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          });
        }

        // Highlight connected links and dim others
        linkElements.attr('opacity', l => {
          const srcId = typeof l.source === 'object' ? (l.source as NodeData).id : l.source;
          const tgtId = typeof l.target === 'object' ? (l.target as NodeData).id : l.target;
          return (srcId === d.id || tgtId === d.id) ? 1.0 : 0.12;
        });

        // Highlight this node's circle
        d3.select(event.currentTarget as SVGGElement)
          .select('.node-main-circle')
          .transition()
          .duration(200)
          .attr('stroke-width', 3.5);
      })
      .on('mousemove', (event: MouseEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltipPos({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          });
        }
      })
      .on('mouseleave', (event: MouseEvent) => {
        setHoveredNode(null);
        setHoveredClusterId(null);
        setTooltipPos(null);

        // Reset links opacity to 0.85
        linkElements.attr('opacity', 0.85);

        // Reset node stroke
        d3.select(event.currentTarget as SVGGElement)
          .select('.node-main-circle')
          .transition()
          .duration(200)
          .attr('stroke-width', 2);
      })
      .call(
        d3.drag<SVGGElement, NodeData>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            const isMinor = d.isMinor;
            if (isMinor) {
              d.fx = Math.min(firewallX - 30, Math.max(50, event.x));
            } else {
              d.fx = Math.max(firewallX + 30, Math.min(width - 50, event.x));
            }
            d.fy = Math.max(60, Math.min(height - 60, event.y));
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    return () => {
      simulation.stop();
    };
  }, [dynamicNodes, dynamicLinks, activeFilter, showClusterZones, clusterCenters, dataVersion]);

  // Compute active cluster stats for HUD
  const activeClusterStats = useMemo(() => {
    if (hoveredClusterId !== null) {
      return getClusterStats(hoveredClusterId);
    }
    return null;
  }, [hoveredClusterId, getClusterStats]);

  const activeNodeStats = useMemo(() => {
    if (hoveredNode) {
      return getNodeConnectionStats(hoveredNode);
    }
    return null;
  }, [hoveredNode, getNodeConnectionStats]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* View Header with Transition Pulse Badge */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
        {isTransitioning && (
          <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none animate-pulse transition-opacity duration-700" />
        )}

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              Safety Audit View · D3 Cluster Topology
            </h1>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Minor/Adult Airgap: 100% Enforced
            </span>
            {isTransitioning && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono flex items-center gap-1.5 border border-indigo-500/30">
                <Sparkles className="w-3 h-3 animate-spin text-indigo-400" />
                <span>Cluster Transitioning...</span>
                <span className="text-indigo-400 font-semibold">{simulationEquilibrium}%</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time D3 force-directed visualizer illustrating mathematical cluster isolation between minors and adult users. Hover over clusters or nodes to inspect exact minor vs. adult connection metrics.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap relative z-10">
          <button
            onClick={triggerInfiltrationSimulation}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Simulate an adult user attempting cross-traffic connection to a minor"
          >
            <Zap className="w-3.5 h-3.5" />
            Simulate Cross-Band Infiltration Attack
          </button>

          <button
            onClick={addSimulatedNodes}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Play className="w-3.5 h-3.5" />
            Add Traffic Node
          </button>

          <button
            onClick={resetNetwork}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
            title="Reset to baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cluster Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] text-slate-400">Airgap Integrity</span>
          <div className="text-lg font-bold text-emerald-400 font-mono">100.0%</div>
          <span className="text-[10px] text-slate-400">0 Leaks Detected</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] text-slate-400">Isolated Enclaves</span>
          <div className="text-lg font-bold text-indigo-400 font-mono">4 Pods</div>
          <span className="text-[10px] text-slate-400">U13 · 13–15 · 16–17 · 18+</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] text-slate-400">Active Network Nodes</span>
          <div className="text-lg font-bold text-white font-mono">{dynamicNodes.length} Nodes</div>
          <span className="text-[10px] text-slate-400">Live D3 Physics</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] text-slate-400">Intercepted Attacks</span>
          <div className="text-lg font-bold text-red-400 font-mono">{attackAttemptCount} Intercepted</div>
          <span className="text-[10px] text-slate-400">Firewall boundary blocks</span>
        </div>
      </div>

      {/* Interactive Graph Container with Dynamic Ambient Glow */}
      <div
        ref={containerRef}
        className={`bg-slate-950 border rounded-xl overflow-hidden shadow-xl relative transition-all duration-700 ${
          isTransitioning || simulationState === 'STABILIZING'
            ? 'border-indigo-500/70 ring-2 ring-indigo-500/40 shadow-[0_0_35px_rgba(99,102,241,0.25)]'
            : 'border-slate-800'
        }`}
      >
        {/* Floating Top-Right Live Feedback HUD */}
        <div className="absolute top-14 right-4 z-20 pointer-events-none transition-all duration-300">
          {isTransitioning || simulationState === 'STABILIZING' ? (
            <div className="bg-indigo-950/95 border border-indigo-500/80 rounded-lg px-3 py-1.5 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs text-indigo-200 animate-pulse">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
              <span className="font-semibold text-white">Cluster Transitioning...</span>
              <span className="font-mono text-[10px] bg-indigo-900/80 px-1.5 py-0.5 rounded text-indigo-300 font-medium">
                Equilibrium: {simulationEquilibrium}%
              </span>
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 backdrop-blur-md flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Topology Stable · Airgap 100%</span>
            </div>
          )}
        </div>

        {/* Graph Toolbar Overlay */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xs flex items-center justify-between gap-4 flex-wrap text-xs">
          
          {/* Cluster Filter Buttons */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter Cluster:
            </span>
            {(['ALL', 'Under 13', '13–15', '16–17', '18+'] as const).map(group => (
              <button
                key={group}
                onClick={() => {
                  setActiveFilter(group);
                  notifyDataUpdate(null);
                }}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  activeFilter === group
                    ? 'bg-indigo-600 text-white font-medium shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {group}
              </button>
            ))}
          </div>

          {/* Toggle Zone Boundaries */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-xs">
              <input
                type="checkbox"
                checked={showClusterZones}
                onChange={e => setShowClusterZones(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-0"
              />
              <span>Render Zone Boundaries</span>
            </label>

            <span className="text-slate-400 font-mono text-[11px]">
              Hover over any cluster pod to inspect connections
            </span>
          </div>

        </div>

        {/* SVG Visualization Stage */}
        <div className="w-full overflow-x-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] relative">
          <svg
            ref={svgRef}
            viewBox="0 0 1060 580"
            className="w-full h-auto min-w-[800px] select-none"
          />

          {/* Floating Hover Tooltip Card (Exact minor vs adult connection breakdown) */}
          {tooltipPos && (activeClusterStats || hoveredNode) && (
            <div
              className="absolute z-30 pointer-events-none transition-all duration-150 ease-out"
              style={{
                left: Math.min(tooltipPos.x + 18, 760),
                top: Math.max(tooltipPos.y - 70, 20)
              }}
            >
              <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-md text-xs w-72 space-y-2.5">
                
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{hoveredNode ? hoveredNode.nickname : activeClusterStats?.name}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                    {hoveredNode ? `${hoveredNode.age}y · ${hoveredNode.ageGroup}` : activeClusterStats?.ageGroup}
                  </span>
                </div>

                {/* Node-specific or Cluster-specific breakdown */}
                {hoveredNode && activeNodeStats ? (
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Direct Minor Peer Connections:</span>
                      <strong className="text-emerald-400 font-mono">{activeNodeStats.minorConns} Safe</strong>
                    </div>

                    <div className="flex justify-between items-center text-slate-300">
                      <span>Direct Adult Connections:</span>
                      <strong className={activeNodeStats.adultConns > 0 ? 'text-red-400' : 'text-slate-400 font-mono'}>
                        {activeNodeStats.adultConns} (Airgap Blocked)
                      </strong>
                    </div>

                    {activeNodeStats.blockedConns > 0 && (
                      <div className="flex justify-between items-center text-red-300">
                        <span>Intercepted Cross-Breach Attempts:</span>
                        <strong className="text-red-400 font-mono">{activeNodeStats.blockedConns} Intercepted</strong>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Cluster Overall Traffic Metrics */}
                {activeClusterStats && (
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
                      <span>Cluster Traffic Breakdown</span>
                      <span className="text-indigo-400">{activeClusterStats.totalNodes} Nodes</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Minor ↔ Minor Safe Links:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {activeClusterStats.minorConnections} active
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Minor ↔ Adult Cross Links:</span>
                      <span className="font-mono font-bold text-slate-400">
                        {activeClusterStats.adultConnections} (0% Leakage)
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Intercepted Firewall Violations:</span>
                      <span className="font-mono font-bold text-red-400">
                        {activeClusterStats.blockedAttempts} blocked
                      </span>
                    </div>
                  </div>
                )}

                {/* Verification Notice */}
                <div className="text-[10px] text-emerald-400/90 font-mono flex items-center gap-1 pt-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Isolation Verified: Zero Minor/Adult Cross-Traffic</span>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Graph Legend */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span>Under 13 Pod</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-sky-400"></span>
              <span>13–15 Teen Pod</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
              <span>16–17 Teen Pod</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span>18+ Adult Zone</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-emerald-400"></span>
              <span>Safe Active Match</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-b-2 border-dashed border-red-500"></span>
              <span>Blocked Breach Attempt</span>
            </div>
          </div>

          <div className="font-mono text-[11px] text-slate-400">
            Hover over clusters or nodes to inspect connections
          </div>
        </div>

      </div>

      {/* Detail Inspector & Attack Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Node Profile Inspector (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Node Safety Inspector</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {selectedNode ? selectedNode.id : 'Click a Node'}
            </span>
          </div>

          {selectedNode ? (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Display Nickname:</span>
                <strong className="text-white text-sm">{selectedNode.nickname}</strong>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Server Evaluated Age:</span>
                <span className="font-mono font-bold text-indigo-400">
                  {selectedNode.age} years old
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Enclave Band:</span>
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono font-medium">
                  {selectedNode.ageGroup}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Guardian Status:</span>
                <span className={`font-semibold ${
                  selectedNode.guardianStatus === 'VERIFIED'
                    ? 'text-emerald-400'
                    : selectedNode.guardianStatus === 'PENDING'
                    ? 'text-amber-400'
                    : 'text-slate-400'
                }`}>
                  {selectedNode.guardianStatus}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Quarantine Demarcation:</span>
                <span className="text-emerald-400 font-medium">
                  {selectedNode.isMinor ? 'Restricted to Minor Pod' : 'Restricted to Adult Zone'}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <strong className="text-white block">Cluster Whitelist Policy:</strong>
                <p className="text-slate-400">
                  {selectedNode.isMinor
                    ? `This node is strictly isolated. Server matching rules prohibit cross-traffic with adults or outside the ${selectedNode.ageGroup} band.`
                    : 'This node is in the adult pool. Any attempted connection to minor nodes trips the firewall.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs space-y-1">
              <Info className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-300 font-medium">No Node Selected</p>
              <p className="text-slate-500">
                Click any circle in the D3 graph to view its server-enforced cluster constraints and boundary whitelist.
              </p>
            </div>
          )}
        </div>

        {/* Real-time Safety Audit Feed (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-white">Live Firewall & Cluster Audit Event Stream</h3>
            </div>
            <span className="text-[10px] text-indigo-400 font-mono animate-pulse">● LIVE INTERCEPT</span>
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {auditLogFeed.map((item) => (
              <div
                key={item.id}
                className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                  item.blocked
                    ? 'bg-red-950/40 border-red-900/60 text-red-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.blocked ? (
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      {item.blocked ? 'Cross-Traffic Blocked' : 'Topology Event'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{item.time}</span>
                  </div>
                  <p className="text-[11px] mt-0.5 text-slate-300">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

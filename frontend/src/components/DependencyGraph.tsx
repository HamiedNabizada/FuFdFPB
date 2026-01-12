import { useEffect, useRef, useState } from 'react';
import { Network, type Options, type Data } from 'vis-network';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import type { SchemaGroupDetail } from '../types/schemaGroup';

interface DependencyGraphProps {
  group: SchemaGroupDetail;
  selectedSchemaId: number | null;
  onSelectSchema: (schemaId: number) => void;
}

// Farben für verschiedene Rollen
const ROLE_COLORS: Record<string, { background: string; border: string }> = {
  master: { background: '#102a43', border: '#243b53' },
  imported: { background: '#14876d', border: '#17a589' },
  included: { background: '#6b46c1', border: '#805ad5' },
  standalone: { background: '#627d98', border: '#829ab1' },
};

const ROLE_LABELS: Record<string, string> = {
  master: 'Master',
  imported: 'Importiert',
  included: 'Inkludiert',
  standalone: 'Standalone',
};

export default function DependencyGraph({ group, selectedSchemaId, onSelectSchema }: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Nodes erstellen
    const nodes = group.schemas.map(schema => ({
      id: schema.id,
      label: schema.filename.replace('.xsd', ''),
      title: `${schema.filename}\nRolle: ${ROLE_LABELS[schema.role] || schema.role}\nKommentare: ${schema.commentCount}`,
      color: ROLE_COLORS[schema.role] || ROLE_COLORS.standalone,
      font: { color: '#ffffff', size: 14 },
      shape: schema.role === 'master' ? 'box' : 'ellipse',
      size: schema.role === 'master' ? 30 : 25,
      borderWidth: selectedSchemaId === schema.id ? 4 : 2,
    }));

    // Edges erstellen (aus dependencies)
    const edges = group.schemas.flatMap((schema) =>
      schema.dependencies.map((dep, depIdx) => ({
        id: `${schema.id}-${dep.targetId}-${depIdx}`,
        from: schema.id,
        to: dep.targetId,
        arrows: 'to',
        label: dep.type,
        font: { size: 10, color: '#627d98' },
        color: dep.type === 'import' ? '#14876d' : '#6b46c1',
        width: 2,
      }))
    );

    const data: Data = { nodes, edges };

    // Network Optionen
    const options: Options = {
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -100,
          centralGravity: 0.01,
          springLength: 150,
          springConstant: 0.08,
          damping: 0.4,
        },
        stabilization: {
          iterations: 100,
          fit: true,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true,
      },
      nodes: {
        borderWidth: 2,
        shadow: {
          enabled: true,
          size: 10,
          x: 2,
          y: 2,
        },
      },
      edges: {
        smooth: {
          enabled: true,
          type: 'curvedCW',
          roundness: 0.2,
        },
      },
    };

    // Network erstellen
    const network = new Network(containerRef.current, data, options);
    networkRef.current = network;

    // Click Handler
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        onSelectSchema(params.nodes[0] as number);
      }
    });

    // Hover Cursor
    network.on('hoverNode', () => {
      if (containerRef.current) {
        containerRef.current.style.cursor = 'pointer';
      }
    });
    network.on('blurNode', () => {
      if (containerRef.current) {
        containerRef.current.style.cursor = 'default';
      }
    });

    return () => {
      network.destroy();
    };
  }, [group, selectedSchemaId, onSelectSchema]);

  const handleZoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 1.3 });
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale / 1.3 });
    }
  };

  const handleFit = () => {
    if (networkRef.current) {
      networkRef.current.fit({ animation: true });
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (networkRef.current) {
        networkRef.current.fit({ animation: true });
      }
    }, 100);
  };

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-white p-4' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ background: ROLE_COLORS.master.background }}></span>
            Master
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: ROLE_COLORS.imported.background }}></span>
            Import
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: ROLE_COLORS.included.background }}></span>
            Include
          </span>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomIn}
            className="p-1.5 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded"
            title="Vergrößern"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded"
            title="Verkleinern"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleFit}
            className="p-1.5 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded"
            title="Einpassen"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded"
            title={isFullscreen ? 'Vollbild beenden' : 'Vollbild'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Graph Container */}
      <div
        ref={containerRef}
        className={`border border-primary-200 rounded-lg bg-primary-50 ${
          isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-64'
        }`}
      />

      {/* Fullscreen close hint */}
      {isFullscreen && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-primary-500 bg-white px-3 py-1 rounded-full shadow">
          Klicken Sie auf das X zum Beenden
        </div>
      )}
    </div>
  );
}

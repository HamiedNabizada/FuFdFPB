import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, FolderOpen, Filter, ChevronRight, MessageSquare, Reply, Trash2, Calendar, User as UserIcon, Download, TreePine, Code, Network, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { User } from '../App';
import { parseXsd, findNodeByXpath, type XsdNode } from '../lib/xsd-parser';
import { exportGroupCommentsToMarkdown, downloadMarkdown } from '../lib/export-comments';
import { convertReferencesToMarkdown } from '../lib/references';
import SchemaTree from '../components/SchemaTree';
import SchemaSearch from '../components/SchemaSearch';
import SchemaBreadcrumb from '../components/SchemaBreadcrumb';
import CodeViewer from '../components/CodeViewer';
import ElementDetails from '../components/ElementDetails';
import CommentList, { type Comment } from '../components/CommentList';
import CommentForm from '../components/CommentForm';
import TagEditor from '../components/TagEditor';
import { CATEGORIES, type CommentCategory } from '../lib/categories';
import DependencyGraph from '../components/DependencyGraph';
import type { SchemaGroupDetail } from '../types/schemaGroup';

interface SchemaGroupPageProps {
  user: User | null;
}

type FilterStatus = 'all' | 'open' | 'resolved';

export default function SchemaGroupPage({ user }: SchemaGroupPageProps) {
  const { groupId, schemaId } = useParams<{ groupId: string; schemaId?: string }>();
  const [searchParams] = useSearchParams();
  const [group, setGroup] = useState<SchemaGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSchemaId, setSelectedSchemaId] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<XsdNode | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [submitting, setSubmitting] = useState(false);
  const [showGroupComments, setShowGroupComments] = useState(false);
  const [schemaComments, setSchemaComments] = useState<Comment[]>([]);
  const [replyingToGroupComment, setReplyingToGroupComment] = useState<number | null>(null);
  const [groupReplyText, setGroupReplyText] = useState('');
  const [highlightedXpaths, setHighlightedXpaths] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'code'>('tree');
  const [showGraph, setShowGraph] = useState(false);

  // Helper: Check if link is internal reference
  const isReferenceLink = (href: string) => href?.startsWith('/') || href?.startsWith('#');

  // Reference click handler - resolves via API
  const handleReferenceClick = async (e: React.MouseEvent, href: string, childText: string) => {
    e.preventDefault();
    e.stopPropagation();

    const refMatch = childText.match(/@?([GSCR]-\d+)/i);
    if (refMatch) {
      try {
        const res = await fetch(`/api/resolve/${refMatch[1]}`);
        if (res.ok) {
          const data = await res.json();
          window.location.href = data.url;
          return;
        }
      } catch (err) {
        console.error('Failed to resolve reference:', err);
      }
    }
    window.location.href = href;
  };

  // Markdown components for group comments
  const markdownComponents = {
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href && isReferenceLink(href)) {
        return (
          <a
            href={href}
            onClick={(e) => handleReferenceClick(e, href, String(children || ''))}
            className="inline-flex items-center px-1 py-0.5 rounded
                       bg-primary-100 text-primary-700 hover:bg-primary-200
                       font-mono text-xs transition-colors cursor-pointer no-underline"
          >
            {children}
          </a>
        );
      }
      return <a href={href} className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>;
    },
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
    ),
  };

  const handleHighlightChange = useCallback((xpaths: Set<string>) => {
    setHighlightedXpaths(xpaths);
  }, []);

  // Tags aktualisieren
  const handleUpdateTags = async (newTags: string[]) => {
    if (!group) return;

    const token = localStorage.getItem('token');
    const res = await fetch(`/api/schema-groups/${group.id}/tags`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ tags: newTags }),
    });

    if (res.ok) {
      const data = await res.json();
      setGroup(prev => prev ? { ...prev, tags: data.tags } : prev);
    }
  };

  // Ausgewähltes Schema
  const selectedSchema = useMemo(() => {
    if (!group) return null;
    return group.schemas.find(s => s.id === selectedSchemaId) || null;
  }, [group, selectedSchemaId]);

  // Parse XSD content
  const parsedSchema = useMemo(() => {
    if (!selectedSchema?.content) return null;
    try {
      return parseXsd(selectedSchema.content);
    } catch (e) {
      console.error('Failed to parse XSD:', e);
      return null;
    }
  }, [selectedSchema?.content]);

  // Comment counts per xpath
  const commentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    schemaComments.forEach((comment) => {
      counts[comment.xpath] = (counts[comment.xpath] || 0) + 1;
    });
    return counts;
  }, [schemaComments]);

  // Filtered comments for selected node
  const nodeComments = useMemo(() => {
    if (!selectedNode) return [];
    console.log('[DEBUG] Filtering comments. Total:', schemaComments.length, 'Node xpath:', selectedNode.xpath);
    console.log('[DEBUG] All comment xpaths:', schemaComments.map(c => c.xpath));
    let filtered = schemaComments.filter((c) => c.xpath === selectedNode.xpath);
    console.log('[DEBUG] After xpath filter:', filtered.length);
    if (filterStatus !== 'all') {
      filtered = filtered.filter((c) => c.status === filterStatus);
    }
    return filtered;
  }, [schemaComments, selectedNode, filterStatus]);

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  useEffect(() => {
    if (schemaId) {
      setSelectedSchemaId(parseInt(schemaId));
    } else if (group && group.schemas.length > 0) {
      // Wähle Master-Schema oder erstes Schema
      const master = group.schemas.find(s => s.role === 'master');
      setSelectedSchemaId(master?.id || group.schemas[0].id);
    }
  }, [group, schemaId]);

  // Kommentare laden wenn Schema ausgewählt wird
  useEffect(() => {
    if (selectedSchemaId) {
      fetchSchemaComments(selectedSchemaId);
    } else {
      setSchemaComments([]);
    }
  }, [selectedSchemaId]);

  // URL-Parameter verarbeiten (schemaId) - für direkte Kommentar-Links
  useEffect(() => {
    const schemaIdParam = searchParams.get('schemaId');

    if (schemaIdParam && group) {
      const targetSchemaId = parseInt(schemaIdParam);
      if (targetSchemaId !== selectedSchemaId) {
        setSelectedSchemaId(targetSchemaId);
      }
    }
  }, [searchParams, group]);

  // Nach dem Parsen des Schemas: Node per xpath auswählen
  useEffect(() => {
    const xpathParam = searchParams.get('xpath');
    if (xpathParam && parsedSchema) {
      const node = findNodeByXpath(parsedSchema, xpathParam);
      if (node) {
        setSelectedNode(node);
      }
    }
  }, [searchParams, parsedSchema]);

  const fetchSchemaComments = async (schemaId: number) => {
    console.log('[DEBUG] Fetching comments for schemaId:', schemaId);
    try {
      const res = await fetch(`/api/comments/schema/${schemaId}`);
      if (res.ok) {
        const data = await res.json();
        console.log('[DEBUG] Received comments:', data.comments);
        setSchemaComments(data.comments || []);
      } else {
        console.error('[DEBUG] Failed to fetch comments, status:', res.status);
      }
    } catch (err) {
      console.error('Error fetching schema comments:', err);
    }
  };

  const fetchGroup = async () => {
    try {
      const res = await fetch(`/api/schema-groups/${groupId}`);
      if (!res.ok) {
        throw new Error('Gruppe nicht gefunden');
      }
      const data = await res.json();
      setGroup(data.group);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroupComment = async (text: string, authorName?: string, category?: string) => {
    if (!group) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/schema-groups/${group.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          commentText: text,
          authorName,
          category: category || 'technical',
        }),
      });

      if (res.ok) {
        fetchGroup(); // Reload to get new comment
      } else {
        const data = await res.json();
        alert(data.error || 'Kommentar konnte nicht gespeichert werden');
      }
    } catch (err) {
      console.error('Error adding group comment:', err);
      alert('Kommentar konnte nicht gespeichert werden');
    } finally {
      setSubmitting(false);
    }
  };

  // Auf Gruppen-Kommentar antworten
  const handleGroupCommentReply = async (commentId: number) => {
    if (!groupReplyText.trim()) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          replyText: groupReplyText,
          authorName: user ? undefined : 'Anonym',
        }),
      });

      if (res.ok) {
        setGroupReplyText('');
        setReplyingToGroupComment(null);
        fetchGroup();
      }
    } catch (err) {
      console.error('Error adding reply:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Gruppen-Kommentar löschen
  const handleDeleteGroupComment = async (commentId: number) => {
    if (!confirm('Kommentar wirklich löschen?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        fetchGroup();
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  // Element-Kommentar hinzufügen
  const handleAddElementComment = async (text: string, authorName?: string, category?: string) => {
    if (!selectedSchemaId || !selectedNode) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          schemaId: selectedSchemaId,
          xpath: selectedNode.xpath,
          elementName: selectedNode.name,
          commentText: text,
          authorName,
          category: category || 'technical',
        }),
      });

      if (res.ok) {
        if (selectedSchemaId) fetchSchemaComments(selectedSchemaId);
      } else {
        const data = await res.json();
        alert(data.error || 'Kommentar konnte nicht gespeichert werden');
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Kommentar konnte nicht gespeichert werden');
    } finally {
      setSubmitting(false);
    }
  };

  // Kommentar als erledigt markieren
  const handleResolve = async (commentId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/comments/${commentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'resolved' }),
      });

      if (res.ok) {
        if (selectedSchemaId) fetchSchemaComments(selectedSchemaId);
      }
    } catch (err) {
      console.error('Error resolving comment:', err);
    }
  };

  // Auf Kommentar antworten
  const handleReply = async (commentId: number, text: string, authorName?: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          replyText: text,
          authorName,
        }),
      });

      if (res.ok) {
        if (selectedSchemaId) fetchSchemaComments(selectedSchemaId);
      }
    } catch (err) {
      console.error('Error adding reply:', err);
    }
  };

  // Kommentar löschen
  const handleDelete = async (commentId: number) => {
    if (!confirm('Kommentar wirklich löschen?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        if (selectedSchemaId) fetchSchemaComments(selectedSchemaId);
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'master':
        return <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 font-medium rounded">Master</span>;
      case 'imported':
        return <span className="text-xs px-2 py-0.5 bg-accent-50 text-accent-700 rounded">Import</span>;
      case 'included':
        return <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded">Include</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-primary-50">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-semibold text-primary-900 mb-2">Fehler</h1>
          <p className="text-primary-500 mb-6">{error || 'Gruppe nicht gefunden'}</p>
          <Link to="/" className="btn-primary">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-primary-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-primary-100 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-1.5 text-primary-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary-400 font-mono">G-{group.id}</span>
                <h1 className="font-semibold text-primary-900">{group.name}</h1>
                <span className="badge-primary">v{group.version}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-primary-500">
                <span className="flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  {group.uploadedBy}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(group.createdAt).toLocaleDateString('de-DE')}
                </span>
              </div>
              {/* Tags */}
              <div className="mt-1">
                <TagEditor
                  tags={group.tags || []}
                  onTagsChange={handleUpdateTags}
                  canEdit={!!user}
                />
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Export Button - exports group comments and current schema comments */}
            {(group.comments.length > 0 || schemaComments.length > 0) && (
              <button
                onClick={() => {
                  const currentSchemaComments = selectedSchema ? [{
                    schemaName: selectedSchema.filename,
                    comments: schemaComments,
                  }] : [];
                  const markdown = exportGroupCommentsToMarkdown(
                    group.name,
                    group.version,
                    currentSchemaComments,
                    group.comments as Comment[]
                  );
                  downloadMarkdown(markdown, `${group.name}_v${group.version}_kommentare.md`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                           bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"
                title="Gruppen-Kommentare exportieren"
              >
                <FileText size={16} />
                Export
              </button>
            )}
            {selectedSchema && (
              <button
                onClick={() => {
                  const blob = new Blob([selectedSchema.content], { type: 'application/xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = selectedSchema.filename;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                           bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"
              >
                <Download size={16} />
                {selectedSchema.filename}
              </button>
            )}
            <button
              onClick={() => setShowGroupComments(!showGroupComments)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showGroupComments
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
              }`}
            >
              <MessageSquare size={16} />
              Diskussion ({group.comments.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - File List & Tree */}
        <div className="w-1/3 border-r border-primary-100 bg-white flex flex-col overflow-hidden">
          {/* Dependency Graph */}
          {group.schemas.length > 1 && (
            <div className="flex-shrink-0 border-b border-primary-100">
              <button
                onClick={() => setShowGraph(!showGraph)}
                className="w-full px-3 py-2 border-b border-primary-50 bg-primary-50 flex items-center justify-between hover:bg-primary-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-primary-500" />
                  <h2 className="text-sm font-medium text-primary-700">Abhängigkeitsgraph</h2>
                </div>
                <ChevronRight className={`w-4 h-4 text-primary-400 transition-transform ${showGraph ? 'rotate-90' : ''}`} />
              </button>
              {showGraph && (
                <div className="p-2">
                  <DependencyGraph
                    group={group}
                    selectedSchemaId={selectedSchemaId}
                    onSelectSchema={(id) => {
                      setSelectedSchemaId(id);
                      setSelectedNode(null);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* File List */}
          <div className="flex-shrink-0 border-b border-primary-100">
            <div className="px-3 py-2 border-b border-primary-50 bg-primary-50">
              <h2 className="text-sm font-medium text-primary-700">Dateien ({group.schemas.length})</h2>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {group.schemas.map((schema) => (
                <button
                  key={schema.id}
                  onClick={() => {
                    setSelectedSchemaId(schema.id);
                    setSelectedNode(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedSchemaId === schema.id
                      ? 'bg-primary-50 border-l-2 border-primary-600'
                      : 'hover:bg-primary-50 border-l-2 border-transparent'
                  }`}
                >
                  <FileText size={16} className={selectedSchemaId === schema.id ? 'text-primary-600' : 'text-primary-300'} />
                  <span className="text-xs text-primary-400 font-mono">S-{schema.id}</span>
                  <span className={`flex-1 truncate ${selectedSchemaId === schema.id ? 'text-primary-900 font-medium' : 'text-primary-700'}`}>
                    {schema.filename}
                  </span>
                  {getRoleBadge(schema.role)}
                  {schema.commentCount > 0 && (
                    <span className="text-xs bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full">
                      {schema.commentCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Dependencies */}
          {selectedSchema && selectedSchema.dependencies && selectedSchema.dependencies.length > 0 && (
            <div className="flex-shrink-0 border-b border-primary-100">
              <div className="px-3 py-2 border-b border-primary-50 bg-primary-50">
                <h3 className="text-xs font-medium text-primary-500 uppercase tracking-wide">Abhängigkeiten</h3>
              </div>
              <div className="p-2 space-y-1">
                {selectedSchema.dependencies.map((dep, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedSchemaId(dep.targetId)}
                    className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-2 py-1 rounded transition-colors"
                  >
                    <ChevronRight size={12} />
                    <span className="text-primary-400">{dep.type}:</span>
                    <span className="font-medium">{dep.targetFilename}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Schema Tree/Code */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <div className="px-3 py-2 border-b border-primary-50 bg-primary-50 space-y-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-primary-700">
                  {selectedSchema ? selectedSchema.filename : 'Schema-Struktur'}
                </h2>
                {selectedSchema && (
                  <div className="flex items-center bg-primary-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode('tree')}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                        viewMode === 'tree'
                          ? 'bg-white text-primary-700 shadow-sm'
                          : 'text-primary-500 hover:text-primary-700'
                      }`}
                    >
                      <TreePine className="w-3.5 h-3.5" />
                      Baum
                    </button>
                    <button
                      onClick={() => setViewMode('code')}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                        viewMode === 'code'
                          ? 'bg-white text-primary-700 shadow-sm'
                          : 'text-primary-500 hover:text-primary-700'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      Code
                    </button>
                  </div>
                )}
              </div>
              {viewMode === 'tree' && parsedSchema && (
                <SchemaSearch
                  rootNode={parsedSchema}
                  onSelectNode={setSelectedNode}
                  onHighlightChange={handleHighlightChange}
                />
              )}
            </div>

            {viewMode === 'tree' ? (
              parsedSchema ? (
                <div className="flex-1 overflow-y-auto py-2">
                  <SchemaTree
                    node={parsedSchema}
                    rootNode={parsedSchema}
                    selectedNode={selectedNode}
                    onSelectNode={setSelectedNode}
                    commentCounts={commentCounts}
                    highlightedXpaths={highlightedXpaths}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-primary-400 text-sm">
                  {selectedSchema ? 'Schema konnte nicht geparst werden' : 'Keine Datei ausgewählt'}
                </div>
              )
            ) : selectedSchema ? (
              <div className="flex-1 overflow-hidden p-3">
                <CodeViewer
                  content={selectedSchema.content}
                  filename={selectedSchema.filename}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Panel - Details & Comments */}
        <div className="flex-1 overflow-y-auto bg-primary-50 p-4">
          {showGroupComments ? (
            /* Group Comments View */
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="font-semibold text-primary-900 mb-4">
                  Diskussion zur Schema-Gruppe
                  {group.comments.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-primary-500">
                      ({group.comments.length})
                    </span>
                  )}
                </h3>

                {group.description && (
                  <div className="mb-4 p-3 bg-primary-50 rounded-lg text-sm text-primary-600 border border-primary-100">
                    {group.description}
                  </div>
                )}

                {/* Group Comments List */}
                <div className="space-y-3 mb-6">
                  {group.comments.length === 0 ? (
                    <p className="text-primary-400 text-sm py-4 text-center">Noch keine Kommentare vorhanden.</p>
                  ) : (
                    group.comments.map((comment) => (
                      <div key={comment.id} id={`comment-${comment.id}`} className={`border rounded-lg p-4 ${
                        comment.status === 'resolved'
                          ? 'bg-accent-50 border-accent-200'
                          : 'border-primary-100 bg-primary-50/50'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-primary-400 font-mono">C-{comment.id}</span>
                            <span className="font-medium text-sm text-primary-900">{comment.authorName}</span>
                            {comment.category && CATEGORIES[comment.category as CommentCategory] && (
                              <span
                                title={CATEGORIES[comment.category as CommentCategory].description}
                                className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 ${CATEGORIES[comment.category as CommentCategory].bgColor} ${CATEGORIES[comment.category as CommentCategory].color}`}
                              >
                                <span className={`w-2 h-2 rounded-full ${CATEGORIES[comment.category as CommentCategory].dotColor}`}></span>
                                {CATEGORIES[comment.category as CommentCategory].label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {comment.status === 'resolved' && (
                              <span className="text-xs bg-accent-100 text-accent-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Erledigt
                              </span>
                            )}
                            <span className="text-xs text-primary-400">
                              {new Date(comment.createdAt).toLocaleString('de-DE')}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-primary-700 mb-3 prose prose-sm max-w-none">
                          <ReactMarkdown components={markdownComponents}>
                            {convertReferencesToMarkdown(comment.commentText, group.id)}
                          </ReactMarkdown>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 text-xs">
                          <button
                            onClick={() => setReplyingToGroupComment(
                              replyingToGroupComment === comment.id ? null : comment.id
                            )}
                            className="flex items-center gap-1 text-primary-500 hover:text-primary-700 transition-colors"
                          >
                            <Reply size={14} />
                            Antworten
                          </button>
                          {user && (
                            <button
                              onClick={() => handleDeleteGroupComment(comment.id)}
                              className="flex items-center gap-1 text-primary-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={14} />
                              Löschen
                            </button>
                          )}
                        </div>

                        {/* Reply Form */}
                        {replyingToGroupComment === comment.id && (
                          <div className="mt-3 pt-3 border-t border-primary-100">
                            <textarea
                              value={groupReplyText}
                              onChange={(e) => setGroupReplyText(e.target.value)}
                              placeholder="Antwort schreiben..."
                              className="input text-sm resize-none"
                              rows={2}
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleGroupCommentReply(comment.id)}
                                disabled={submitting || !groupReplyText.trim()}
                                className="btn-primary text-sm py-1.5"
                              >
                                Antworten
                              </button>
                              <button
                                onClick={() => {
                                  setReplyingToGroupComment(null);
                                  setGroupReplyText('');
                                }}
                                className="btn-ghost text-sm"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Replies */}
                        {comment.replies.length > 0 && (
                          <div className="mt-3 pl-3 border-l-2 border-primary-200 space-y-2">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} id={`reply-${reply.id}`} className="text-sm">
                                <span className="text-xs text-primary-400 font-mono mr-1">R-{reply.id}</span>
                                <span className="font-medium text-primary-800">{reply.authorName}</span>
                                <span className="text-primary-300 mx-1">·</span>
                                <span className="text-xs text-primary-400">
                                  {new Date(reply.createdAt).toLocaleString('de-DE')}
                                </span>
                                <div className="text-primary-600 mt-1 prose prose-sm max-w-none">
                                  <ReactMarkdown components={markdownComponents}>
                                    {convertReferencesToMarkdown(reply.replyText, group.id)}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add Group Comment Form */}
                <div className="pt-4 border-t border-primary-100">
                  <h4 className="text-sm font-medium text-primary-700 mb-3">
                    Neuer Kommentar
                  </h4>
                  <CommentForm
                    user={user}
                    onSubmit={handleAddGroupComment}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          ) : selectedNode ? (
            /* Element Details View */
            <div className="space-y-4">
              {/* Breadcrumb */}
              <SchemaBreadcrumb
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
              />

              {/* Element Details */}
              <div className="card p-5">
                <ElementDetails node={selectedNode} schemaContent={selectedSchema?.content} />
              </div>

              {/* Comments Section */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-primary-900">
                    Kommentare
                    {nodeComments.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-primary-500">
                        ({nodeComments.length})
                      </span>
                    )}
                  </h3>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-primary-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                      className="input-sm"
                    >
                      <option value="all">Alle</option>
                      <option value="open">Offen</option>
                      <option value="resolved">Erledigt</option>
                    </select>
                  </div>
                </div>

                <CommentList
                  comments={nodeComments}
                  user={user}
                  onResolve={handleResolve}
                  onReply={handleReply}
                  onDelete={handleDelete}
                />

                <div className="mt-4 pt-4 border-t border-primary-100">
                  <h4 className="text-sm font-medium text-primary-700 mb-3">
                    Neuer Kommentar
                  </h4>
                  <CommentForm
                    user={user}
                    onSubmit={handleAddElementComment}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-primary-400" />
                </div>
                <p className="text-primary-700 font-medium">Wählen Sie ein Element</p>
                <p className="text-sm text-primary-400 mt-1">um Details und Kommentare zu sehen</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

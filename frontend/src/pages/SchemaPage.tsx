import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileCode, Filter, Download, TreePine, Code, FileText } from 'lucide-react';
import type { User } from '../App';
import { parseXsd, findNodeByXpath, type XsdNode } from '../lib/xsd-parser';
import { exportCommentsToMarkdown, downloadMarkdown } from '../lib/export-comments';
import SchemaTree from '../components/SchemaTree';
import SchemaSearch from '../components/SchemaSearch';
import SchemaBreadcrumb from '../components/SchemaBreadcrumb';
import CodeViewer from '../components/CodeViewer';
import ElementDetails from '../components/ElementDetails';
import CommentList, { type Comment } from '../components/CommentList';
import CommentForm from '../components/CommentForm';

interface SchemaData {
  id: number;
  name: string;
  version: string;
  content: string;
  uploadedBy: string;
  createdAt: string;
}

interface SchemaPageProps {
  user: User | null;
}

type FilterStatus = 'all' | 'open' | 'resolved';

export default function SchemaPage({ user }: SchemaPageProps) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<XsdNode | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [submitting, setSubmitting] = useState(false);
  const [highlightedXpaths, setHighlightedXpaths] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'code'>('tree');

  const handleHighlightChange = useCallback((xpaths: Set<string>) => {
    setHighlightedXpaths(xpaths);
  }, []);

  // Parse XSD content to tree structure
  const parsedSchema = useMemo(() => {
    if (!schema?.content) return null;
    try {
      return parseXsd(schema.content);
    } catch (e) {
      console.error('Failed to parse XSD:', e);
      return null;
    }
  }, [schema?.content]);

  // Calculate comment counts per xpath
  const commentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    comments.forEach((comment) => {
      counts[comment.xpath] = (counts[comment.xpath] || 0) + 1;
    });
    return counts;
  }, [comments]);

  // Filter comments for selected node
  const nodeComments = useMemo(() => {
    if (!selectedNode) return [];
    let filtered = comments.filter((c) => c.xpath === selectedNode.xpath);
    if (filterStatus !== 'all') {
      filtered = filtered.filter((c) => c.status === filterStatus);
    }
    return filtered;
  }, [comments, selectedNode, filterStatus]);

  useEffect(() => {
    fetchSchema();
  }, [id]);

  // URL-Parameter verarbeiten (xpath) - für direkte Kommentar-Links
  useEffect(() => {
    const xpathParam = searchParams.get('xpath');
    if (xpathParam && parsedSchema) {
      const node = findNodeByXpath(parsedSchema, xpathParam);
      if (node) {
        setSelectedNode(node);
      }
    }
  }, [searchParams, parsedSchema]);

  const fetchSchema = async () => {
    try {
      const res = await fetch(`/api/schemas/${id}`);
      if (!res.ok) {
        throw new Error('Schema nicht gefunden');
      }
      const data = await res.json();
      setSchema(data.schema);
      setComments(data.schema.comments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (text: string, authorName?: string, category?: string) => {
    if (!selectedNode || !schema) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/schemas/${schema.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          xpath: selectedNode.xpath,
          elementName: selectedNode.name,
          commentText: text,
          authorName,
          category: category || 'technical',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
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

  const handleResolveComment = async (commentId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/comments/${commentId}/resolve`, {
        method: 'PATCH',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, status: 'resolved' } : c))
        );
      }
    } catch (err) {
      console.error('Error resolving comment:', err);
    }
  };

  const handleReplyComment = async (commentId: number, text: string, authorName?: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ replyText: text, authorName }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, replies: [...c.replies, data.reply] } : c
          )
        );
      }
    } catch (err) {
      console.error('Error replying to comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
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
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  if (error || !schema) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Fehler</h1>
          <p className="text-gray-600 mb-4">{error || 'Schema nicht gefunden'}</p>
          <Link to="/" className="text-blue-600 hover:underline">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-primary-100 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-primary-400 hover:text-primary-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary-600" />
            <h1 className="font-semibold text-primary-900">{schema.name}</h1>
            <span className="badge-primary font-mono">
              v{schema.version}
            </span>
          </div>
          <span className="text-sm text-primary-500">
            von {schema.uploadedBy} am{' '}
            {new Date(schema.createdAt).toLocaleDateString('de-DE')}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {comments.length > 0 && (
              <button
                onClick={() => {
                  const markdown = exportCommentsToMarkdown(comments, {
                    schemaName: schema.name,
                    schemaVersion: schema.version,
                  });
                  downloadMarkdown(markdown, `${schema.name}_v${schema.version}_kommentare.md`);
                }}
                className="btn-secondary text-sm"
                title="Kommentare als Markdown exportieren"
              >
                <FileText className="w-4 h-4" />
                Export
              </button>
            )}
            <button
              onClick={() => {
                const blob = new Blob([schema.content], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${schema.name}_v${schema.version}.xsd`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-secondary text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Tree/Code */}
        <div className="w-1/3 border-r bg-primary-50 flex flex-col overflow-hidden">
          <div className="p-3 border-b bg-white space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-primary-700">
                {viewMode === 'tree' ? 'Schema-Struktur' : 'XSD-Code'}
              </h2>
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
            </div>
            {viewMode === 'tree' && (
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
              <div className="p-4 text-center text-primary-500 text-sm">
                Schema konnte nicht geparst werden
              </div>
            )
          ) : (
            <div className="flex-1 overflow-hidden p-3">
              <CodeViewer
                content={schema?.content || ''}
                filename={`${schema?.name}.xsd`}
              />
            </div>
          )}
        </div>

        {/* Right Panel - Details & Comments */}
        <div className="flex-1 overflow-y-auto bg-primary-50">
          {selectedNode ? (
            <div className="p-4 space-y-4">
              {/* Breadcrumb */}
              <SchemaBreadcrumb
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
              />

              {/* Element Details */}
              <div className="card p-4">
                <ElementDetails node={selectedNode} schemaContent={schema?.content} />
              </div>

              {/* Comments Section */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-primary-900">
                    Kommentare
                    {nodeComments.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-primary-500">
                        ({nodeComments.length})
                      </span>
                    )}
                  </h3>

                  {/* Filter */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
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
                  onResolve={handleResolveComment}
                  onReply={handleReplyComment}
                  onDelete={handleDeleteComment}
                />

                {/* Add Comment Form */}
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Neuer Kommentar
                  </h4>
                  <CommentForm
                    user={user}
                    onSubmit={handleAddComment}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FileCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Wählen Sie ein Element aus dem Schema</p>
                <p className="text-sm mt-1">um Details und Kommentare zu sehen</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

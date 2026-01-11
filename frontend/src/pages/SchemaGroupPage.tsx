import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileCode, FolderOpen, Filter, ChevronRight, MessageSquare, Reply, Trash2 } from 'lucide-react';
import type { User } from '../App';
import { parseXsd, type XsdNode } from '../lib/xsd-parser';
import SchemaTree from '../components/SchemaTree';
import ElementDetails from '../components/ElementDetails';
import CommentList, { type Comment } from '../components/CommentList';
import CommentForm from '../components/CommentForm';
import type { SchemaGroupDetail } from '../types/schemaGroup';

interface SchemaGroupPageProps {
  user: User | null;
}

type FilterStatus = 'all' | 'open' | 'resolved';

export default function SchemaGroupPage({ user }: SchemaGroupPageProps) {
  const { groupId, schemaId } = useParams<{ groupId: string; schemaId?: string }>();
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
    let filtered = schemaComments.filter((c) => c.xpath === selectedNode.xpath);
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
      fetchSchemaComments();
    } else {
      setSchemaComments([]);
    }
  }, [selectedSchemaId]);

  const fetchSchemaComments = async () => {
    if (!selectedSchemaId) return;
    try {
      const res = await fetch(`/api/comments/schema/${selectedSchemaId}`);
      if (res.ok) {
        const data = await res.json();
        setSchemaComments(data.comments || []);
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

  const handleAddGroupComment = async (text: string, authorName?: string) => {
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
  const handleAddElementComment = async (text: string, authorName?: string) => {
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
        }),
      });

      if (res.ok) {
        fetchSchemaComments();
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
        fetchSchemaComments();
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
        fetchSchemaComments();
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
        fetchSchemaComments();
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'master':
        return <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Master</span>;
      case 'imported':
        return <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Import</span>;
      case 'included':
        return <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Include</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Fehler</h1>
          <p className="text-gray-600 mb-4">{error || 'Gruppe nicht gefunden'}</p>
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
      <div className="flex-shrink-0 bg-white border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <h1 className="font-semibold text-gray-900">{group.name}</h1>
            <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
              v{group.version}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            von {group.uploadedBy} am{' '}
            {new Date(group.createdAt).toLocaleDateString('de-DE')}
          </span>
          <button
            onClick={() => setShowGroupComments(!showGroupComments)}
            className={`ml-auto flex items-center gap-1 px-3 py-1 rounded text-sm ${
              showGroupComments
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <MessageSquare size={16} />
            Gruppen-Kommentare ({group.comments.length})
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - File List & Tree */}
        <div className="w-1/3 border-r bg-gray-50 flex flex-col overflow-hidden">
          {/* File List */}
          <div className="flex-shrink-0 border-b bg-white">
            <div className="p-2 border-b">
              <h2 className="text-sm font-medium text-gray-700">Dateien ({group.schemas.length})</h2>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {group.schemas.map((schema) => (
                <button
                  key={schema.id}
                  onClick={() => {
                    setSelectedSchemaId(schema.id);
                    setSelectedNode(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    selectedSchemaId === schema.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                  }`}
                >
                  <FileCode size={16} className={selectedSchemaId === schema.id ? 'text-blue-600' : 'text-gray-400'} />
                  <span className="flex-1 truncate">{schema.filename}</span>
                  {getRoleBadge(schema.role)}
                  {schema.commentCount > 0 && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {schema.commentCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Dependencies */}
          {selectedSchema && selectedSchema.dependencies && selectedSchema.dependencies.length > 0 && (
            <div className="flex-shrink-0 border-b bg-white">
              <div className="p-2 border-b">
                <h3 className="text-xs font-medium text-gray-500 uppercase">Abhängigkeiten</h3>
              </div>
              <div className="p-2 space-y-1">
                {selectedSchema.dependencies.map((dep, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedSchemaId(dep.targetId)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ChevronRight size={12} />
                    <span className="text-gray-500">{dep.type}:</span>
                    {dep.targetFilename}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Schema Tree */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 border-b bg-white sticky top-0">
              <h2 className="text-sm font-medium text-gray-700">
                {selectedSchema ? selectedSchema.filename : 'Schema-Struktur'}
              </h2>
            </div>
            {parsedSchema ? (
              <div className="py-2">
                <SchemaTree
                  node={parsedSchema}
                  selectedNode={selectedNode}
                  onSelectNode={setSelectedNode}
                  commentCounts={commentCounts}
                />
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                {selectedSchema ? 'Schema konnte nicht geparst werden' : 'Keine Datei ausgewählt'}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Details & Comments */}
        <div className="flex-1 overflow-y-auto">
          {showGroupComments ? (
            /* Group Comments View */
            <div className="p-4 space-y-6">
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Kommentare zur Schema-Gruppe
                  {group.comments.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({group.comments.length})
                    </span>
                  )}
                </h3>

                {group.description && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                    {group.description}
                  </div>
                )}

                {/* Group Comments List */}
                <div className="space-y-4 mb-6">
                  {group.comments.length === 0 ? (
                    <p className="text-gray-500 text-sm">Noch keine Gruppen-Kommentare vorhanden.</p>
                  ) : (
                    group.comments.map((comment) => (
                      <div key={comment.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium text-sm">{comment.authorName}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.createdAt).toLocaleString('de-DE')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">{comment.commentText}</p>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 text-xs">
                          <button
                            onClick={() => setReplyingToGroupComment(
                              replyingToGroupComment === comment.id ? null : comment.id
                            )}
                            className="flex items-center gap-1 text-gray-500 hover:text-blue-600"
                          >
                            <Reply size={14} />
                            Antworten
                          </button>
                          {user && (
                            <button
                              onClick={() => handleDeleteGroupComment(comment.id)}
                              className="flex items-center gap-1 text-gray-500 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                              Löschen
                            </button>
                          )}
                        </div>

                        {/* Reply Form */}
                        {replyingToGroupComment === comment.id && (
                          <div className="mt-3 pt-3 border-t">
                            <textarea
                              value={groupReplyText}
                              onChange={(e) => setGroupReplyText(e.target.value)}
                              placeholder="Antwort schreiben..."
                              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                              rows={2}
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleGroupCommentReply(comment.id)}
                                disabled={submitting || !groupReplyText.trim()}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                Antworten
                              </button>
                              <button
                                onClick={() => {
                                  setReplyingToGroupComment(null);
                                  setGroupReplyText('');
                                }}
                                className="px-3 py-1 text-gray-600 text-sm hover:text-gray-800"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Replies */}
                        {comment.replies.length > 0 && (
                          <div className="mt-3 pl-3 border-l-2 space-y-2">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="text-sm">
                                <span className="font-medium">{reply.authorName}</span>
                                <span className="text-gray-500 mx-1">·</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(reply.createdAt).toLocaleString('de-DE')}
                                </span>
                                <p className="text-gray-700 mt-1">{reply.replyText}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add Group Comment Form */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Neuer Gruppen-Kommentar
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
            <div className="p-4 space-y-6">
              {/* Element Details */}
              <div className="bg-white border rounded-lg p-4">
                <ElementDetails node={selectedNode} />
              </div>

              {/* Comments Section */}
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">
                    Kommentare
                    {nodeComments.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({nodeComments.length})
                      </span>
                    )}
                  </h3>

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
                  onResolve={handleResolve}
                  onReply={handleReply}
                  onDelete={handleDelete}
                />

                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
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

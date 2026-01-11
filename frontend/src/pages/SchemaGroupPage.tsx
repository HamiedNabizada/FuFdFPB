import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, FolderOpen, Filter, ChevronRight, MessageSquare, Reply, Trash2, Calendar, User as UserIcon } from 'lucide-react';
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
            </div>
          </div>
          <button
            onClick={() => setShowGroupComments(!showGroupComments)}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - File List & Tree */}
        <div className="w-1/3 border-r border-primary-100 bg-white flex flex-col overflow-hidden">
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

          {/* Schema Tree */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="px-3 py-2 border-b border-primary-50 bg-primary-50 sticky top-0 z-10">
              <h2 className="text-sm font-medium text-primary-700">
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
              <div className="p-8 text-center text-primary-400 text-sm">
                {selectedSchema ? 'Schema konnte nicht geparst werden' : 'Keine Datei ausgewählt'}
              </div>
            )}
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
                      <div key={comment.id} className="border border-primary-100 rounded-lg p-4 bg-primary-50/50">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium text-sm text-primary-900">{comment.authorName}</span>
                          <span className="text-xs text-primary-400">
                            {new Date(comment.createdAt).toLocaleString('de-DE')}
                          </span>
                        </div>
                        <p className="text-sm text-primary-700 mb-3">{comment.commentText}</p>

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
                              <div key={reply.id} className="text-sm">
                                <span className="font-medium text-primary-800">{reply.authorName}</span>
                                <span className="text-primary-300 mx-1">·</span>
                                <span className="text-xs text-primary-400">
                                  {new Date(reply.createdAt).toLocaleString('de-DE')}
                                </span>
                                <p className="text-primary-600 mt-1">{reply.replyText}</p>
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
              {/* Element Details */}
              <div className="card p-5">
                <ElementDetails node={selectedNode} />
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

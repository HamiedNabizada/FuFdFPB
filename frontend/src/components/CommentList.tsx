import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, Check, Reply, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { User } from '../App';
import { CATEGORIES, type CommentCategory } from '../lib/categories';
import { convertReferencesToMarkdown } from '../lib/references';

export interface CommentReply {
  id: number;
  replyText: string;
  authorName: string | null;
  author: { name: string } | null;
  createdAt: string;
}

export interface Comment {
  id: number;
  xpath: string;
  elementName: string | null;
  commentText: string;
  authorName: string | null;
  author: { name: string } | null;
  status: 'open' | 'resolved';
  category?: CommentCategory;
  createdAt: string;
  replies: CommentReply[];
}

interface CommentListProps {
  comments: Comment[];
  user: User | null;
  onResolve: (commentId: number) => void;
  onReply: (commentId: number, text: string, authorName?: string) => void;
  onDelete: (commentId: number) => void;
}

export default function CommentList({
  comments,
  user,
  onResolve,
  onReply,
  onDelete,
}: CommentListProps) {
  const { groupId } = useParams<{ groupId?: string }>();
  const currentGroupId = groupId ? parseInt(groupId, 10) : undefined;

  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyAuthor, setReplyAuthor] = useState('');

  const handleSubmitReply = (commentId: number) => {
    if (!replyText.trim()) return;
    if (!user && !replyAuthor.trim()) return;

    onReply(commentId, replyText, user ? undefined : replyAuthor);
    setReplyText('');
    setReplyAuthor('');
    setReplyingTo(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAuthorName = (comment: Comment | CommentReply) => {
    return comment.author?.name || comment.authorName || 'Anonym';
  };

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-primary-400">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Noch keine Kommentare</p>
      </div>
    );
  }

  // Check if a link is a reference link (internal)
  const isReferenceLink = (href: string) => href?.startsWith('/') || href?.startsWith('#');

  // Markdown component styling
  const markdownComponents = {
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
    ),
    pre: ({ children }: { children?: React.ReactNode }) => (
      <pre className="bg-primary-50 border border-primary-200 rounded-md p-3 overflow-x-auto my-2 text-xs">{children}</pre>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href && isReferenceLink(href)) {
        // Reference link - use React Router Link with special styling
        return (
          <Link
            to={href}
            className="inline-flex items-center px-1 py-0.5 rounded
                       bg-primary-100 text-primary-700 hover:bg-primary-200
                       font-mono text-xs transition-colors no-underline"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </Link>
        );
      }
      // External link
      return (
        <a href={href} className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
      );
    },
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  };

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className={`border rounded-lg p-4 ${
            comment.status === 'resolved' ? 'bg-accent-50 border-accent-200' : 'bg-white border-primary-200'
          }`}
        >
          {/* Comment Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary-400 font-mono">C-{comment.id}</span>
              <span className="font-medium text-primary-900">{getAuthorName(comment)}</span>
              {comment.category && CATEGORIES[comment.category] && (
                <span
                  title={CATEGORIES[comment.category].description}
                  className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 ${CATEGORIES[comment.category].bgColor} ${CATEGORIES[comment.category].color}`}
                >
                  <span className={`w-2 h-2 rounded-full ${CATEGORIES[comment.category].dotColor}`}></span>
                  {CATEGORIES[comment.category].label}
                </span>
              )}
              <span className="text-xs text-primary-500">{formatDate(comment.createdAt)}</span>
            </div>
            {comment.status === 'resolved' && (
              <span className="text-xs bg-accent-100 text-accent-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                Erledigt
              </span>
            )}
          </div>

          {/* Comment Text */}
          <div className="text-primary-700 text-sm mb-3 prose prose-sm max-w-none">
            <ReactMarkdown components={markdownComponents}>
              {convertReferencesToMarkdown(comment.commentText, currentGroupId)}
            </ReactMarkdown>
          </div>

          {/* Replies */}
          {comment.replies.length > 0 && (
            <div className="ml-4 border-l-2 border-primary-200 pl-4 space-y-3 mb-3">
              {comment.replies.map((reply) => (
                <div key={reply.id}>
                  <div className="text-xs text-primary-500 mb-1">
                    <span className="text-primary-400 font-mono mr-1">R-{reply.id}</span>
                    <span className="font-medium text-primary-700">{getAuthorName(reply)}</span>
                    <span className="ml-2">{formatDate(reply.createdAt)}</span>
                  </div>
                  <div className="text-sm text-primary-600 prose prose-sm max-w-none">
                    <ReactMarkdown components={markdownComponents}>
                      {convertReferencesToMarkdown(reply.replyText, currentGroupId)}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply Form */}
          {replyingTo === comment.id && (
            <div className="mt-3 space-y-2">
              {!user && (
                <input
                  type="text"
                  placeholder="Ihr Name"
                  value={replyAuthor}
                  onChange={(e) => setReplyAuthor(e.target.value)}
                  className="input-sm"
                />
              )}
              <textarea
                placeholder="Antwort schreiben... (Markdown wird unterstützt)"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="input text-sm resize-none"
                rows={2}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSubmitReply(comment.id)}
                  className="btn-primary text-xs py-1.5"
                >
                  Antworten
                </button>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="btn-ghost text-xs"
                >
                  Abbrechen
                </button>
                <span className="text-xs text-primary-400 ml-auto">Markdown unterstützt</span>
              </div>
            </div>
          )}

          {/* Actions */}
          {replyingTo !== comment.id && (
            <div className="flex gap-3 mt-3 pt-3 border-t border-primary-100">
              <button
                onClick={() => setReplyingTo(comment.id)}
                className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1"
              >
                <Reply className="w-3.5 h-3.5" />
                Antworten
              </button>
              {comment.status === 'open' && (
                <button
                  onClick={() => onResolve(comment.id)}
                  className="text-xs text-primary-500 hover:text-accent-600 flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Als erledigt markieren
                </button>
              )}
              {user && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="text-xs text-primary-400 hover:text-red-600 flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

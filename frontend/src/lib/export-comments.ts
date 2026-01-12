import type { Comment } from '../components/CommentList';

interface ExportOptions {
  schemaName: string;
  schemaVersion: string;
  includeResolved?: boolean;
  groupByElement?: boolean;
}

/**
 * Generates a Markdown document from comments
 */
export function exportCommentsToMarkdown(
  comments: Comment[],
  options: ExportOptions
): string {
  const { schemaName, schemaVersion, includeResolved = true, groupByElement = true } = options;

  const filteredComments = includeResolved
    ? comments
    : comments.filter(c => c.status === 'open');

  if (filteredComments.length === 0) {
    return `# Kommentare: ${schemaName} v${schemaVersion}\n\nKeine Kommentare vorhanden.`;
  }

  const lines: string[] = [];

  // Header
  lines.push(`# Kommentare: ${schemaName} v${schemaVersion}`);
  lines.push('');
  lines.push(`Exportiert am: ${new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Statistics
  const openCount = filteredComments.filter(c => c.status === 'open').length;
  const resolvedCount = filteredComments.filter(c => c.status === 'resolved').length;
  lines.push(`**Statistik:** ${filteredComments.length} Kommentare (${openCount} offen, ${resolvedCount} erledigt)`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (groupByElement) {
    // Group comments by xpath/element
    const grouped = new Map<string, Comment[]>();

    for (const comment of filteredComments) {
      const key = comment.elementName || comment.xpath;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(comment);
    }

    for (const [element, elementComments] of grouped) {
      lines.push(`## ${element}`);
      lines.push('');

      // Show xpath if different from element name
      const xpath = elementComments[0].xpath;
      if (xpath !== element) {
        lines.push(`*XPath: \`${xpath}\`*`);
        lines.push('');
      }

      for (const comment of elementComments) {
        lines.push(...formatComment(comment));
        lines.push('');
      }
    }
  } else {
    // Chronological order
    const sorted = [...filteredComments].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const comment of sorted) {
      lines.push(`### ${comment.elementName || comment.xpath}`);
      lines.push('');
      lines.push(...formatComment(comment));
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatComment(comment: Comment): string[] {
  const lines: string[] = [];
  const authorName = comment.author?.name || comment.authorName || 'Anonym';
  const date = new Date(comment.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const statusBadge = comment.status === 'resolved' ? ' [Erledigt]' : '';

  lines.push(`**${authorName}** - ${date}${statusBadge}`);
  lines.push('');
  lines.push(comment.commentText);

  // Replies
  if (comment.replies.length > 0) {
    lines.push('');
    for (const reply of comment.replies) {
      const replyAuthor = reply.author?.name || reply.authorName || 'Anonym';
      const replyDate = new Date(reply.createdAt).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      lines.push(`> **${replyAuthor}** - ${replyDate}`);
      lines.push(`> ${reply.replyText.split('\n').join('\n> ')}`);
      lines.push('');
    }
  }

  lines.push('---');

  return lines;
}

/**
 * Triggers a download of the markdown content
 */
export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export comments for a schema group (multiple files)
 */
export function exportGroupCommentsToMarkdown(
  groupName: string,
  groupVersion: string,
  schemaComments: Array<{
    schemaName: string;
    comments: Comment[];
  }>,
  groupComments?: Comment[]
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Kommentare: ${groupName} v${groupVersion}`);
  lines.push('');
  lines.push(`Exportiert am: ${new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Group-level comments
  if (groupComments && groupComments.length > 0) {
    lines.push('## Allgemeine Kommentare zur Gruppe');
    lines.push('');

    for (const comment of groupComments) {
      lines.push(...formatComment(comment));
      lines.push('');
    }
  }

  // Per-schema comments
  for (const { schemaName, comments } of schemaComments) {
    if (comments.length === 0) continue;

    lines.push(`## ${schemaName}`);
    lines.push('');

    // Group by element within schema
    const grouped = new Map<string, Comment[]>();
    for (const comment of comments) {
      const key = comment.elementName || comment.xpath;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(comment);
    }

    for (const [element, elementComments] of grouped) {
      lines.push(`### ${element}`);
      lines.push('');

      const xpath = elementComments[0].xpath;
      if (xpath !== element) {
        lines.push(`*XPath: \`${xpath}\`*`);
        lines.push('');
      }

      for (const comment of elementComments) {
        lines.push(...formatComment(comment));
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

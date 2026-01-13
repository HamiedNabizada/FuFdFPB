import { Link, useParams } from 'react-router-dom';
import { splitTextWithReferences, getReferenceUrl, getReferenceLabel } from '../lib/references';

interface ReferenceTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with @G-X, @S-X, @C-X, @R-X references as clickable links
 */
export default function ReferenceText({ text, className = '' }: ReferenceTextProps) {
  const { groupId } = useParams<{ groupId?: string }>();
  const currentGroupId = groupId ? parseInt(groupId, 10) : undefined;

  const parts = splitTextWithReferences(text);

  if (parts.length === 1 && parts[0].type === 'text') {
    // No references, return plain text
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.content}</span>;
        }

        const ref = part.reference!;
        const url = getReferenceUrl(ref, currentGroupId);
        const label = getReferenceLabel(ref.type);

        return (
          <Link
            key={index}
            to={url}
            title={`${label} ${ref.prefix}-${ref.id}`}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 -mx-0.5 rounded
                       bg-primary-100 text-primary-700 hover:bg-primary-200
                       font-mono text-xs transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {part.content}
          </Link>
        );
      })}
    </span>
  );
}

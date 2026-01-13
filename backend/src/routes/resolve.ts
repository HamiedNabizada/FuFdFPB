import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

/**
 * Convert Base36 string to number
 */
function fromBase36(str: string): number {
  return parseInt(str.toLowerCase(), 36);
}

/**
 * Convert number to Base36 string
 */
function toBase36(num: number): string {
  return num.toString(36).toLowerCase();
}

/**
 * Resolve a reference (G-X, S-X, C-X, R-X) to a full URL
 * Accepts both numeric IDs and Base36 encoded IDs
 * GET /api/resolve/:reference
 */
router.get('/:reference', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { reference } = req.params;

    // Parse reference format: G-abc, S-123, C-7ps, R-rs, U-a (alphanumeric Base36)
    const match = reference.match(/^([GSCRU])-([a-z0-9]+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Ungültiges Referenzformat. Erwartet: G-X, S-X, C-X, R-X oder U-X' });
    }

    const type = match[1].toUpperCase();
    const base36Id = match[2].toLowerCase();
    const id = fromBase36(base36Id);

    let url: string | null = null;

    switch (type) {
      case 'G': {
        // Group reference
        const group = await prisma.schemaGroup.findUnique({
          where: { id },
          select: { id: true }
        });
        if (group) {
          url = `/group/${group.id}`;
        }
        break;
      }

      case 'S': {
        // Schema reference - need to find its group
        const schema = await prisma.schema.findUnique({
          where: { id },
          select: { id: true, groupId: true }
        });
        if (schema) {
          if (schema.groupId) {
            url = `/group/${schema.groupId}?schemaId=${schema.id}`;
          } else {
            // Standalone schema (legacy)
            url = `/schema/${schema.id}`;
          }
        }
        break;
      }

      case 'C': {
        // Comment reference - need to find its schema and group
        const comment = await prisma.comment.findUnique({
          where: { id },
          select: {
            id: true,
            schemaId: true,
            groupId: true,
            schema: {
              select: { groupId: true }
            }
          }
        });
        if (comment) {
          if (comment.groupId) {
            // Group-level comment
            url = `/group/${comment.groupId}#comment-${comment.id}`;
          } else if (comment.schemaId && comment.schema?.groupId) {
            // Schema comment within a group
            url = `/group/${comment.schema.groupId}?schemaId=${comment.schemaId}#comment-${comment.id}`;
          } else if (comment.schemaId) {
            // Standalone schema comment (legacy)
            url = `/schema/${comment.schemaId}#comment-${comment.id}`;
          }
        }
        break;
      }

      case 'R': {
        // Reply reference - need to find its parent comment, then schema/group
        const reply = await prisma.reply.findUnique({
          where: { id },
          select: {
            id: true,
            comment: {
              select: {
                id: true,
                schemaId: true,
                groupId: true,
                schema: {
                  select: { groupId: true }
                }
              }
            }
          }
        });
        if (reply && reply.comment) {
          const comment = reply.comment;
          if (comment.groupId) {
            url = `/group/${comment.groupId}#reply-${reply.id}`;
          } else if (comment.schemaId && comment.schema?.groupId) {
            url = `/group/${comment.schema.groupId}?schemaId=${comment.schemaId}#reply-${reply.id}`;
          } else if (comment.schemaId) {
            url = `/schema/${comment.schemaId}#reply-${reply.id}`;
          }
        }
        break;
      }

      case 'U': {
        // User reference - return user info (no URL, just name)
        const user = await prisma.user.findUnique({
          where: { id },
          select: { id: true, name: true }
        });
        if (user) {
          // Users don't have a profile page, so we return special info
          return res.json({
            type: 'U',
            id,
            base36Id,
            name: user.name,
            url: null // No URL for users
          });
        }
        break;
      }
    }

    if (!url) {
      return res.status(404).json({ error: `${type}-${base36Id} nicht gefunden` });
    }

    res.json({ url, type, id, base36Id });
  } catch (error) {
    console.error('Resolve reference error:', error);
    res.status(500).json({ error: 'Fehler beim Auflösen der Referenz' });
  }
});

export default router;

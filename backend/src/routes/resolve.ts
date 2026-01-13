import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

/**
 * Resolve a reference (G-X, S-X, C-X, R-X) to a full URL
 * GET /api/resolve/:reference
 */
router.get('/:reference', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { reference } = req.params;

    // Parse reference format: G-123, S-456, C-789, R-012
    const match = reference.match(/^([GSCR])-(\d+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Ungültiges Referenzformat. Erwartet: G-X, S-X, C-X oder R-X' });
    }

    const type = match[1].toUpperCase();
    const id = parseInt(match[2], 10);

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
    }

    if (!url) {
      return res.status(404).json({ error: `${type}-${id} nicht gefunden` });
    }

    res.json({ url, type, id });
  } catch (error) {
    console.error('Resolve reference error:', error);
    res.status(500).json({ error: 'Fehler beim Auflösen der Referenz' });
  }
});

export default router;

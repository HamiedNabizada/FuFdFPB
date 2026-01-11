import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import schemaRoutes from './routes/schemas';
import commentRoutes from './routes/comments';
import schemaGroupRoutes from './routes/schemaGroups';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Erhöht für Multi-File-Uploads

// Prisma Client als Request-Property verfügbar machen
app.use((req, res, next) => {
  (req as any).prisma = prisma;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/schemas', schemaRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/schema-groups', schemaGroupRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Frontend statische Dateien
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// SPA Catch-All: Alle nicht-API Routes auf index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Server starten
app.listen(PORT, () => {
  console.log(`🚀 XSD Review Tool Backend running on http://localhost:${PORT}`);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

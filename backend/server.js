import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import projectRoutes from './routes/projects.js';
import proposalRoutes from './routes/proposals.js';
import milestoneRoutes from './routes/milestones.js';
import aiRoutes from './routes/ai.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development
app.use(cors({
  origin: '*', // For local workspace development, allowing any origin is easiest
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize SQLite database tables
initDb()
  .then(() => console.log('Database initialized.'))
  .catch((err) => {
    console.error('Database initialization failed. Exiting...', err);
    process.exit(1);
  });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/ai', aiRoutes);

// Base route/health check
app.get('/', (req, res) => {
  res.json({ message: 'AI-Powered Freelance Marketplace API is online.' });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

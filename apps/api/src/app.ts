import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { initializeDatabase } from './database/init.js';
import { authRoutes } from './routes/auth.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { categoriesRoutes } from './routes/categories.routes.js';
import { equipmentsRoutes } from './routes/equipments.routes.js';
import { movementsRoutes } from './routes/movements.routes.js';
import { maintenancesRoutes } from './routes/maintenances.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { auditRoutes } from './routes/audit.routes.js';
import { backupRoutes } from './routes/backup.routes.js';
import { reportsRoutes } from './routes/reports.routes.js';
import { errorHandler, notFound } from './middlewares/error.js';

export const app = express();
const ready = initializeDatabase();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN, credentials: false }));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
app.use(async (_req, _res, next) => { try { await ready; next(); } catch (error) { next(error); } });

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'controle-equipamentos-av-api', database: 'postgres' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/equipments', equipmentsRoutes);
app.use('/api/movements', movementsRoutes);
app.use('/api/maintenances', maintenancesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/reports', reportsRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;

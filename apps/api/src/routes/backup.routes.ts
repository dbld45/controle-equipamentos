import { Router } from 'express';
import { pool } from '../database/index.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';
import { audit } from '../services/audit.service.js';

export const backupRoutes = Router();
backupRoutes.use(requireAuth, requireAdmin);

async function exportPayload() {
  const [users,categories,equipments,movements,movementItems,returns,returnItems,maintenances,auditLogs] = await Promise.all([
    pool.query(`SELECT id,name,email,role,is_active AS "isActive",created_at AS "createdAt",updated_at AS "updatedAt" FROM users ORDER BY id`),
    pool.query(`SELECT * FROM categories ORDER BY id`), pool.query(`SELECT * FROM equipments ORDER BY id`), pool.query(`SELECT * FROM movements ORDER BY id`),
    pool.query(`SELECT * FROM movement_items ORDER BY id`), pool.query(`SELECT * FROM returns ORDER BY id`), pool.query(`SELECT * FROM return_items ORDER BY id`),
    pool.query(`SELECT * FROM maintenances ORDER BY id`), pool.query(`SELECT * FROM audit_logs ORDER BY id`)
  ]);
  return { version:2, database:'postgres', exportedAt:new Date().toISOString(), users:users.rows, categories:categories.rows, equipments:equipments.rows, movements:movements.rows, movementItems:movementItems.rows, returns:returns.rows, returnItems:returnItems.rows, maintenances:maintenances.rows, auditLogs:auditLogs.rows };
}
function stamp() { return new Date().toISOString().replace(/[:.]/g,'-'); }
function sendJsonDownload(res:any, payload:unknown, filename:string) { res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Content-Disposition',`attachment; filename="${filename}"`); res.send(JSON.stringify(payload,null,2)); }

backupRoutes.get('/', asyncHandler(async (_req,res)=>{
  const rows=(await pool.query(`SELECT filename,pg_column_size(payload)::int AS size,created_at AS "createdAt" FROM app_backups ORDER BY created_at DESC LIMIT 30`)).rows;
  res.json(rows);
}));
backupRoutes.post('/', asyncHandler(async (req,res)=>{
  const payload=await exportPayload(); const filename=`controle-av-cloud-backup-${stamp()}.json`;
  await pool.query(`INSERT INTO app_backups (filename,payload) VALUES ($1,$2::jsonb)`,[filename,JSON.stringify(payload)]);
  await audit({req,action:'CREATE_BACKUP',entity:'BACKUP',description:`Backup ${filename} criado.`});
  res.status(201).json({filename,downloadUrl:`/api/backups/download/${encodeURIComponent(filename)}`});
}));
backupRoutes.get('/download/:filename', asyncHandler(async (req,res)=>{
  const filename=String(req.params.filename); const row=(await pool.query(`SELECT payload FROM app_backups WHERE filename=$1`,[filename])).rows[0];
  if(!row) throw new HttpError(404,'Backup não encontrado.'); sendJsonDownload(res,row.payload,filename);
}));
backupRoutes.get('/database', asyncHandler(async (req,res)=>{
  const payload=await exportPayload(); const filename=`controle-av-cloud-backup-${stamp()}.json`; await audit({req,action:'DOWNLOAD_DATABASE_BACKUP',entity:'BACKUP',description:`Backup ${filename} gerado para download.`}); sendJsonDownload(res,payload,filename);
}));
backupRoutes.get('/export-json', asyncHandler(async (req,res)=>{
  const payload=await exportPayload(); const filename=`controle-av-export-${stamp()}.json`; await audit({req,action:'EXPORT_JSON',entity:'BACKUP',description:'Exportação JSON completa dos dados gerada.'}); sendJsonDownload(res,payload,filename);
}));

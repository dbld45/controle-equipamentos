import { initializeDatabase } from './init.js';
initializeDatabase().then(() => { console.log('Banco PostgreSQL inicializado/seed aplicado.'); process.exit(0); }).catch(error => { console.error(error); process.exit(1); });

require('dotenv').config();
const { openDb } = require('./db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/notes.db';

createApp(openDb(DB_PATH)).listen(PORT, () => console.log(`http://localhost:${PORT}`));

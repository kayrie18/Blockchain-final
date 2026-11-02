const mongoose = require('mongoose');
const { Document } = require('../src/models/Document');
const { Block } = require('../src/models/Block');
const { AuditLog } = require('../src/models/AuditLog');
const path = require('path');

// Load environment variables directly from server env context
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bbdivs_db";

async function run() {
  console.log('Connecting to database:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  console.log('Clearing Document collection...');
  await Document.deleteMany({});
  
  console.log('Clearing Block collection (local blockchain ledger)...');
  await Block.deleteMany({});
  
  console.log('Clearing AuditLog collection...');
  await AuditLog.deleteMany({});

  console.log('Data wipe complete! Only Users remain intact.');
  process.exit(0);
}

run().catch(console.error);

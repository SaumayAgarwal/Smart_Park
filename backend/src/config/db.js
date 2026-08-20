require('dotenv').config();
require('dotenv').config({ path: '/etc/secrets/.env' });
const { PrismaClient } = require('@prisma/client');

// Fix BigInt serialization in JSON.stringify
BigInt.prototype.toJSON = function () {
  return Number(this);
};

const databaseUrl = process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

module.exports = { prisma };

const { PrismaClient } = require('@prisma/client');

// Fix BigInt serialization in JSON.stringify
BigInt.prototype.toJSON = function () {
  return Number(this);
};

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

module.exports = { prisma };

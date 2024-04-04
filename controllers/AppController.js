// controllers/AppController.js

const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

async function getStatus(req, res) {
  const redisAlive = await redisClient.isAlive();
  const dbAlive = dbClient.isAlive();

  if (redisAlive && dbAlive) {
    res.status(200).json({ redis: true, db: true });
  } else {
    res.status(500).json({ redis: false, db: false });
  }
}

async function getStats(req, res) {
  try {
    const nbUsers = await dbClient.nbUsers();
    const nbFiles = await dbClient.nbFiles();
    res.status(200).json({ users: nbUsers, files: nbFiles });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  getStatus,
  getStats,
};

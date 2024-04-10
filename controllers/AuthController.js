// controllers/AuthController.js

const { v4: uuidv4 } = require('uuid');
const sha1 = require('sha1');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

const AuthController = {
  getConnect: async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const encodedCredentials = authHeader.split(' ')[1];
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
    const [email, password] = decodedCredentials.split(':');

    // Find user by email and password
    const hashedPassword = sha1(password);
    const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate a random token
    const token = uuidv4();

    // Store the user ID in Redis with the token as key (valid for 24 hours)
    await redisClient.set(`auth_${token}`, user._id.toString(), 86400); // 86400 seconds = 24 hours

    // Return the token
    return res.status(200).json({ token });
  },

  getDisconnect: async (req, res) => {
    const { 'x-token': token } = req.headers;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve user ID from Redis using token
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete the token from Redis
    await redisClient.del(`auth_${token}`);

    // Return nothing with status 204
    return res.status(204).send();
  },

  authenticateUser: async (req, res, next) => {
    const { 'x-token': token } = req.headers;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - Token not provided' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    req.userId = userId;
    next();
  },
};

module.exports = AuthController;

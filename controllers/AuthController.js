// controllers/AuthController.js

const { v4: uuidv4 } = require('uuid');
const sha1 = require('sha1');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

const AuthController = {
  getConnect: async (req, res) => {
    // Extraction and decoding of the credentials of the authorization header.
    const authorizationHeader = req.headers.authorization || '';
    const [email, password] = Buffer.from(authorizationHeader.replace('Basic ', ''), 'base64').toString().split(':');
    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Search for the user in the database and verify the password.
    const user = await dbClient.db.collection('users').findOne({ email, password: sha1(password) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Creation of a new token and storage in Redis.
    const token = uuidv4();
    await redisClient.set(`auth_${token}`, user._id.toString(), 86400);

    // Return of the generated token to the user.
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
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.userId = userId;
    return next();
  },
};

module.exports = AuthController;

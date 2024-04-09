// controllers/UsersController.js

const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const sha1 = require('sha1');

const UsersController = {
    postNew: async (req, res) => {
        const { email, password } = req.body;

        // Check if email and password are provided
        if (!email) {
            return res.status(400).json({ error: 'Missing email' });
        }
        if (!password) {
            return res.status(400).json({ error: 'Missing password' });
        }

        try {
            // Check if the email already exists in the database
            const existingUser = await dbClient.db.collection('users').findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'Already exist' });
            }

            // Hash the password using SHA1
            const hashedPassword = sha1(password);

            // Create the new user in the database
            const result = await dbClient.db.collection('users').insertOne({ email, password: hashedPassword });

            // Return the newly created user with minimal information (id and email)
            const newUser = {
                id: result.insertedId,
                email
            };

            res.status(201).json(newUser);
        } catch (error) {
            console.error('Error creating user:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

module.exports = UsersController;

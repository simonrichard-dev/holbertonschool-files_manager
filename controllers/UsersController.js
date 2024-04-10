// controllers/UsersController.js

const sha1 = require('sha1');
const dbClient = require('../utils/db');

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
        email,
      };

      return res.status(201).json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  getMe: async (req, res) => {
    const { userId } = req;

    try {
      // Retrieve user details from the database using userId
      const user = await dbClient.db.collection('users').findOne({ _id: userId });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Return user details (email and id)
      const userData = {
        id: user._id,
        email: user.email,
      };

      return res.status(200).json(userData);
    } catch (error) {
      console.error('Error fetching user details:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
};

module.exports = UsersController;

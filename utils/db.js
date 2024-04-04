// utils/db.js

const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    const { DB_HOST = 'localhost', DB_PORT = 27017, DB_DATABASE = 'files_manager' } = process.env;
    this.dbHost = DB_HOST;
    this.dbPort = DB_PORT;
    this.dbDatabase = DB_DATABASE;
    this.client = new MongoClient(`mongodb://${this.dbHost}:${this.dbPort}`, { useUnifiedTopology: true });
    this.db = null;
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db(this.dbDatabase);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
    }
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    try {
      const count = await this.db.collection('users').countDocuments();
      return count;
    } catch (error) {
      console.error('Error counting users:', error);
      return -1;
    }
  }

  async nbFiles() {
    try {
      const count = await this.db.collection('files').countDocuments();
      return count;
    } catch (error) {
      console.error('Error counting files:', error);
      return -1;
    }
  }
}

const dbClient = new DBClient();
dbClient.connect(); // Connect to MongoDB on instantiation

module.exports = dbClient;

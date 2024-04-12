import { ObjectId } from 'mongodb';
import Queue from 'bull';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const FilesController = {
  postUpload: async (req, res) => {
    // Get the user based on the token
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const _id = new ObjectId(userId);
    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({ _id });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verification of the request data
    const {
      name,
      type,
      parentId,
      isPublic,
      data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    const fileTpes = ['folder', 'file', 'image'];
    if (!type || !fileTpes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId) {
      const filesCollection = dbClient.db.collection('files');
      const parentIdObjectId = new ObjectId(parentId);
      const _idParent = await filesCollection.findOne({
        _id: parentIdObjectId,
      });
      if (!_idParent) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (_idParent.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // If folder, add to database
    if (type === 'folder') {
      const filesCollection = dbClient.db.collection('files');
      const newFolder = {
        userId: user._id,
        name,
        type,
        parentId: parentId || 0,
        isPublic: isPublic || false,
      };
      await filesCollection.insertOne(newFolder);
      newFolder.id = newFolder._id;
      return res.status(201).json({
        id: newFolder.id,
        userId: user._id,
        name,
        type,
        isPublic: isPublic || false,
        parentId: parentId || 0,
      });
    }

    // File creation
    const uuid = uuidv4();
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const filePath = `${folderPath}/${uuid}`;

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true }, (err) => {
        if (err) {
          console.error('A problem occured when creating the directory', err);
          res.status(500).end();
        }
      });
    }
    const decryptedData = Buffer.from(data, 'base64');
    fs.writeFile(filePath, decryptedData, (err) => {
      if (err) {
        console.error('A problem occured when creating the file', err);
        res.status(500).end();
      }
    });

    // File to database
    const newFile = {
      userId: user._id,
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId || 0,
      localPath: filePath,
    };
    const filesCollection = dbClient.db.collection('files');
    await filesCollection.insertOne(newFile);
    newFile.id = newFile._id;

    // Add image to the Bull queue
    const queue = new Queue('fileQueue');
    if (newFile.type === 'image') {
      await queue.add({ userId: newFile.userId, fileId: newFile.id });
    }

    return res.status(201).json({
      id: newFile.id,
      userId,
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId || 0,
    });
  },
  getShow: async (req, res) => {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const fileId = new ObjectId(req.params.id);
    const filesCollection = dbClient.db.collection('files');
    const file = await filesCollection.findOne({ _id: fileId });
    if (!file || userId !== file.userId.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  },
  getIndex: async (req, res) => {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId, page = 0 } = req.query;
    const filesCollection = dbClient.db.collection('files');
    const userIdtoFind = new ObjectId(userId);
    let allFiles = [];

    if (parentId) {
      const cursor = await filesCollection.aggregate([
        { $match: { userId: userIdtoFind, parentId: new ObjectId(parentId) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ]);
      allFiles = await cursor.toArray();
    } else {
      const cursor = await filesCollection.aggregate([
        { $match: { userId: userIdtoFind } },
        { $skip: page * 20 },
        { $limit: 20 },
      ]);
      allFiles = await cursor.toArray();
    }

    const jsonResponse = [];
    for await (const file of allFiles) {
      jsonResponse.push({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      });
    }

    return res.status(200).json(jsonResponse);
  },
  putPublish: async (req, res) => {
    // Get the user based on the token
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const _id = new ObjectId(userId);
    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({ _id });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // check if the id is linked to the user
    const fileId = ObjectId(req.params.id);
    const filesCollection = dbClient.db.collection('files');
    const file = await filesCollection.findOne({ _id: fileId });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (user._id.toString() !== file.userId.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update the document
    const update = {
      $set: {
        isPublic: true,
      },
    };

    await filesCollection.updateOne({ _id: fileId }, update);

    const fileUpdated = await filesCollection.findOne({ _id: fileId });
    fileUpdated.id = fileUpdated._id;
    delete fileUpdated._id;
    return res.json(fileUpdated);
  },

  putUnpublish: async (req, res) => {
    // Get the user based on the token
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const _id = new ObjectId(userId);
    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({ _id });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // check if the id is linked to the user
    const fileId = ObjectId(req.params.id);
    const filesCollection = dbClient.db.collection('files');
    const file = await filesCollection.findOne({ _id: fileId });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (user._id.toString() !== file.userId.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update the document
    const update = {
      $set: {
        isPublic: false,
      },
    };

    await filesCollection.updateOne({ _id: fileId }, update);

    const fileUpdated = await filesCollection.findOne({ _id: fileId });
    fileUpdated.id = fileUpdated._id;
    delete fileUpdated._id;
    return res.json(fileUpdated);
  },
};

module.exports = FilesController;

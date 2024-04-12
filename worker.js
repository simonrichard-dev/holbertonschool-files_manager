import { ObjectId } from 'mongodb';
import Queue from 'bull';
import fs from 'fs';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db';

const queue = new Queue('fileQueue');

queue.process(async (job, done) => {
  try {
    // data verifications
    const { userId, fileId } = job.data;
    if (!fileId) throw new Error('Missing fileId');
    if (!userId) throw new Error('Missing userId');

    const filesCollection = await dbClient.db.collection('files');
    const image = await filesCollection.findOne(
      {
        userId: ObjectId(userId),
        _id: ObjectId(fileId),
      },
    );
    if (!image) throw new Error('File not found');

    // Generate Thumbnail
    try {
      const processedImage100 = await imageThumbnail(image.localPath, { width: 100 });
      const newPath100 = `${image.localPath}_100`;
      fs.writeFileSync(newPath100, processedImage100);
      const processedImage250 = await imageThumbnail(image.localPath, { width: 250 });
      const newPath250 = `${image.localPath}_250`;
      fs.writeFileSync(newPath250, processedImage250);
      const processedImage500 = await imageThumbnail(image.localPath, { width: 500 });
      const newPath500 = `${image.localPath}_500`;
      fs.writeFileSync(newPath500, processedImage500);
    } catch (err) {
      throw new Error(err);
    }
    done();
  } catch (error) {
    console.error(error);
  }
});

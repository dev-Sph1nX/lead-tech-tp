const { PubSub } = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');
const ZipStream = require('zip-stream');
const photoModel = require('./photo_model');
const got = require('got');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

let storage = new Storage();
const pubSubClient = new PubSub();
const bucketName = 'dmii2024bucket';
const jobStatus = {};
const appFirebase = initializeApp({
  databaseURL:
    'https://dmii-2024-default-rtdb.europe-west1.firebasedatabase.app'
});

const db = getDatabase(appFirebase);

async function generateSignedUrl(fileName) {
  const options = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000
  };

  const [url] = await storage
    .bucket(bucketName)
    .file(fileName)
    .getSignedUrl(options);

  return url;
}

async function createAndUploadZip(photos, tags) {
  return new Promise((resolve, reject) => {
    const zip = new ZipStream();

    const zipFileName = `photos_${encodeURIComponent(tags)}.zip`;
    const file = storage.bucket(bucketName).file(zipFileName);
    const stream = file.createWriteStream({
      metadata: {
        contentType: 'application/zip',
        cacheControl: 'private'
      },
      resumable: false
    });

    stream.on('error', err => {
      reject(err);
    });

    stream.on('finish', async () => {
      try {
        const publicUrl = await generateSignedUrl(zipFileName);
        resolve(publicUrl);
      } catch (error) {
        reject(error);
      }
    });

    zip.pipe(stream);

    const queue = photos.map((photo, index) => ({
      name: `photo_${index}.jpg`,
      url: photo.media.m
    }));

    function addNextFile() {
      if (queue.length === 0) {
        zip.finalize();
        return;
      }

      const { name, url } = queue.shift();
      const imageStream = got.stream(url);

      imageStream.on('error', err => {
        reject(err);
      });

      zip.entry(imageStream, { name }, err => {
        if (err) {
          reject(err);
        } else {
          addNextFile();
        }
      });
    }
    addNextFile();
  });
}

function listenForMessages(subscriptionNameOrId) {
  // References an existing subscription; if you are unsure if the
  // subscription will exist, try the optimisticSubscribe sample.
  const subscription = pubSubClient.subscription(subscriptionNameOrId);

  // Create an event handler to handle messages
  const messageHandler = async message => {
    console.log(`Received message ${message.id}:`);
    console.log(`\tData: ${message.data}`);
    console.log(`\tAttributes: ${message.attributes}`);
    message.ack();

    const data = JSON.parse(message.data);
    const tags = data.tags;

    try {
      const photos = await photoModel.getFlickrPhotos(tags, 'any');
      const topPhotos = photos.slice(0, 10);
      const publicUrl = await createAndUploadZip(topPhotos, tags);

      console.log(`Zip uploadé : ${publicUrl}`);

      const status = {
        status: 'success',
        url: publicUrl
      };

      jobStatus[tags] = status;

      const currentTime = new Date().toISOString().replace(/[:.]/g, '-');
      const firebasePath = `/lucas/${currentTime}/${tags}`;
      await db.ref(firebasePath).set(status);
    } catch (error) {
      console.error(`Erreur message : ${error.message}`);

      const status = {
        status: 'error',
        error: error.message
      };

      jobStatus[tags] = status;

      const currentTime = new Date().toISOString().replace(/[:.]/g, '-');
      const firebasePath = `/votreprenom/${currentTime}/${tags}`;
      await db.ref(firebasePath).set(status);
    }
  };

  // Listen for new messages until timeout is hit
  subscription.on('message', messageHandler);

  // Wait a while for the subscription to run. (Part of the sample only.)
  // setTimeout(() => {
  //   subscription.removeListener('message', messageHandler);
  //   console.log(`${messageCount} message(s) received.`);
  // }, timeout * 1000);
}

module.exports = { listenForMessages, jobStatus };

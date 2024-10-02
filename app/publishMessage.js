const { PubSub } = require('@google-cloud/pubsub');

const pubsub = new PubSub();

async function publishMessage(tags) {
  console.log('publishMessage function called with tags:', tags);
  const topicName = 'dmii2-9';
  const dataBuffer = Buffer.from(JSON.stringify({ tags }));

  console.log(`dataBuffer: ${dataBuffer}`);

  try {
    const messageId = await pubsub
      .topic(topicName)
      .publishMessage({ data: dataBuffer });
    console.log(`Message ${messageId} published.`);
  } catch (error) {
    console.error(`Error publishing message: ${error.message}`);
    throw new Error('Failed to publish message');
  }
}

module.exports = publishMessage;

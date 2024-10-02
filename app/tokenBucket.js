const { createClient } = require('redis');

var R = 1;
var B = 15;
var COST_PER_REQUEST = 3;

let client = null;

const tokenBuckets = new Map();

async function initClient() {
  client = await createClient({
    password: process.env.REDIS_PWD,
    socket: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT
    }
  })
    .on('error', err => console.log('Redis Client Error', err))
    .connect();
}

async function checkTokenBucket(req) {
  var IP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
  const now = Date.now();

  if (!IP) {
    return { allowed: false, message: "Impossible de déterminer l'IP" };
  }
  if (!client) {
    return { allowed: false, message: 'Client Redis undefined' };
  }

  console.log(client);
  let bucket = await client.get(IP);

  if (bucket) {
    bucket = JSON.parse(bucket);
  } else {
    bucket = { tokens: B, lastRequestTime: now };
  }

  console.log(bucket);

  const elapsedTime = (now - bucket.lastRequestTime) / 1000;
  const tokensToAdd = Math.floor(elapsedTime * R);

  bucket.tokens = Math.min(bucket.tokens + tokensToAdd, B);

  bucket.lastRequestTime = now;

  if (bucket.tokens >= COST_PER_REQUEST) {
    bucket.tokens -= COST_PER_REQUEST;
    await client.set(IP, JSON.stringify(bucket));
    return {
      allowed: true,
      message: 'Requête autorisée',
      tokensRemaining: bucket.tokens
    };
  } else {
    await client.set(IP, JSON.stringify(bucket));
    return {
      allowed: false,
      message: 'Requête refusée : pas assez de jetons',
      tokensRemaining: bucket.tokens
    };
  }
}

initClient();

module.exports = { checkTokenBucket };

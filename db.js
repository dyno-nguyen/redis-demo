const { createClient } = require('redis');

let redisClient = null;

(async () => {
	redisClient = createClient();

	redisClient.on('error', (err) => {
		console.log('Redis Client Connect Error', err);
		process.exit(1);
	});

	await redisClient.connect();
})();

module.exports = redisClient;

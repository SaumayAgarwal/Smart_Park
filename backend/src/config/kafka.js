const { Kafka, logLevel } = require('kafkajs');

const broker = process.env.KAFKA_BROKER || process.env.KAFKA_HOST || 'kafka:9092';
const clientId = 'smartpark-backend';

const kafka = new Kafka({
  clientId,
  brokers: [broker],
  logLevel: logLevel ? logLevel.WARN : undefined,
  retry: {
    initialRetryTime: 1000,
    retries: 5,
  },
});

module.exports = { kafka };

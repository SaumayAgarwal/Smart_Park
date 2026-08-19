const { kafka } = require('../config/kafka');

const producer = kafka.producer();
let isConnected = false;

async function connectProducer() {
  if (isConnected) return;
  try {
    await producer.connect();
    isConnected = true;
    console.log('✅ Apache Kafka Producer connected');
  } catch (err) {
    console.warn('⚠️ Kafka Producer connection warning (will retry on next message):', err.message);
  }
}

/**
 * Publish an event to a Kafka topic.
 * @param {string} topic - Topic name, e.g. 'smartpark.booking.events'
 * @param {string} eventType - e.g. 'BOOKING_CONFIRMED', 'EXTENSION_REQUESTED'
 * @param {object} payload - Event payload data
 */
async function publishEvent(topic, eventType, payload) {
  try {
    if (!isConnected) {
      await connectProducer();
    }
    if (!isConnected) {
      console.warn(`[Kafka Producer] Skipped publishing ${eventType} (broker unavailable)`);
      return;
    }

    const message = {
      key: String(payload.bookingId || payload.id || Date.now()),
      value: JSON.stringify({
        eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    };

    await producer.send({
      topic,
      messages: [message],
    });

    console.log(`[Kafka Producer] 📤 Event published to topic [${topic}]: ${eventType}`);
  } catch (err) {
    console.warn(`[Kafka Producer] ⚠️ Failed to publish ${eventType}:`, err.message);
  }
}

// ─── Event publisher helpers ──────────────────────────────────────────────────

async function publishBookingEvent(eventType, payload) {
  return publishEvent('smartpark.booking.events', eventType, payload);
}

async function publishPaymentEvent(eventType, payload) {
  return publishEvent('smartpark.payment.events', eventType, payload);
}

module.exports = {
  connectProducer,
  publishEvent,
  publishBookingEvent,
  publishPaymentEvent,
};

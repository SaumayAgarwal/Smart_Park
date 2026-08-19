const Razorpay = require('razorpay');

const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_TPAcsJkyv1j89b';
const keySecret = process.env.RAZORPAY_KEY_SECRET || 'NCDcCtWMATbG5qEcoa8cK21k';

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

module.exports = { razorpay, keyId, keySecret };

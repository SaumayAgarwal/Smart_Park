import { request } from './apiClient';

export const authService = {
  async sendOtp(email, phone = null) {
    return request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email, phone }),
    });
  },

  async register(data) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async login(credentials) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
};

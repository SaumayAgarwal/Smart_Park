const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const BASE_URL = `${BACKEND_URL}/api`;

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('smartpark_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    
    // Safely parse JSON or text response to handle empty or non-JSON HTTP status codes
    const text = await response.text();
    let result = {};
    if (text && text.trim()) {
      try {
        result = JSON.parse(text);
      } catch (e) {
        result = { success: false, message: text || `HTTP ${response.status} Error` };
      }
    } else {
      result = { success: response.ok, message: response.ok ? 'Success' : `HTTP ${response.status} (${response.statusText})` };
    }

    if (!response.ok || (result && result.success === false)) {
      const errorMessage = result?.message || result?.error || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return result;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error.message);
    throw error;
  }
}

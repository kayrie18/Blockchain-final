const rawApiUrl = (import.meta as any).env.VITE_API_URL || '';
const API_BASE = rawApiUrl
  ? rawApiUrl.replace(/\/api\/?$/, '') + '/api'
  : typeof window !== 'undefined'
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api';

export const api = {
  async post(endpoint: string, data?: any, token?: string) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = 'Request failed';
      try {
        msg = JSON.parse(text).error?.message || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },
  
  async get(endpoint: string, token?: string) {
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, { headers });
    if (!res.ok) {
      const text = await res.text();
      let msg = 'Request failed';
      try {
        msg = JSON.parse(text).error?.message || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },

  async patch(endpoint: string, data?: any, token?: string) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = 'Request failed';
      try {
        msg = JSON.parse(text).error?.message || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },

  async uploadForm(endpoint: string, formData: FormData, token?: string) {
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = 'Request failed';
      try {
        msg = JSON.parse(text).error?.message || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },

  async delete(endpoint: string, token?: string) {
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE', headers });
    if (!res.ok) {
      const text = await res.text();
      let msg = 'Request failed';
      try {
        msg = JSON.parse(text).error?.message || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },
};

export const getBaseUrl = () => API_BASE.replace(/\/api\/?$/, '');

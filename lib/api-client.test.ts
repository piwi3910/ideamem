import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiClientError, apiClient } from './api-client';

describe('API Client', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  describe('apiClient', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { data: 'test' };
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      } as Response);

      const result = await apiClient('/api/test');

      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }));
      expect(result).toEqual(mockResponse);
    });

    it('should handle non-2xx responses', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' }),
      } as Response);

      await expect(apiClient('/api/test')).rejects.toThrow(ApiClientError);
      await expect(apiClient('/api/test')).rejects.toMatchObject({
        message: 'Resource not found',
        status: 404,
        statusText: 'Not Found',
      });
    });

    it('should handle timeout', async () => {
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise((resolve) => setTimeout(resolve, 1000))
      );

      await expect(apiClient('/api/test', { timeout: 100 })).rejects.toThrow(ApiClientError);
      await expect(apiClient('/api/test', { timeout: 100 })).rejects.toMatchObject({
        message: 'Request timeout after 100ms',
        status: 408,
      });
    });

    it('should retry on network errors', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true }),
        });
      });

      const result = await apiClient('/api/test', { retries: 2, retryDelay: 10 });
      
      expect(attempts).toBe(2);
      expect(result).toEqual({ success: true });
    });
  });

  describe('api methods', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      });
    });

    it('should make GET request', async () => {
      await api.get('/api/test');
      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'GET',
      }));
    });

    it('should make POST request with data', async () => {
      const data = { name: 'test' };
      await api.post('/api/test', data);
      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(data),
      }));
    });

    it('should make PUT request with data', async () => {
      const data = { name: 'updated' };
      await api.put('/api/test', data);
      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(data),
      }));
    });

    it('should make DELETE request', async () => {
      await api.delete('/api/test');
      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'DELETE',
      }));
    });
  });
});
import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from './error-handler';

describe('Error Handler Middleware', () => {
  const mockRequest = new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
  });

  it('should pass through successful responses', async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ success: true })
    );
    const wrappedHandler = withErrorHandling(handler);

    const response = await wrappedHandler(mockRequest);
    const data = await response.json();

    expect(data).toEqual({ success: true });
    expect(handler).toHaveBeenCalledWith(mockRequest, undefined);
  });

  it('should handle generic errors', async () => {
    const error = new Error('Something went wrong');
    const handler = vi.fn().mockRejectedValue(error);
    const wrappedHandler = withErrorHandling(handler, { resource: 'test' });

    const response = await wrappedHandler(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toMatchObject({
      error: 'Something went wrong',
    });
  });

  it('should handle Zod validation errors', async () => {
    const zodError = {
      name: 'ZodError',
      issues: [
        { path: ['name'], message: 'Required' },
        { path: ['email'], message: 'Invalid email' },
      ],
    };
    const handler = vi.fn().mockRejectedValue(zodError);
    const wrappedHandler = withErrorHandling(handler);

    const response = await wrappedHandler(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      error: 'Invalid request data',
      details: expect.objectContaining({
        validationErrors: zodError.issues,
      }),
    });
  });

  it('should include context in error logs', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test error');
    const handler = vi.fn().mockRejectedValue(error);
    const context = { resource: 'project', userId: '123', projectId: '456' };
    const wrappedHandler = withErrorHandling(handler, context);

    await wrappedHandler(mockRequest);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Route error:',
      expect.objectContaining({
        url: 'http://localhost:3000/api/test',
        method: 'POST',
        error: 'Test error',
        context,
        userId: '123',
        projectId: '456',
      })
    );

    consoleSpy.mockRestore();
  });

  it('should handle errors with custom status codes', async () => {
    const error = {
      message: 'Not found',
      statusCode: 404,
    };
    const handler = vi.fn().mockRejectedValue(error);
    const wrappedHandler = withErrorHandling(handler);

    const response = await wrappedHandler(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toMatchObject({
      error: 'Not found',
    });
  });
});
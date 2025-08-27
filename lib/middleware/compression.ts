import { NextRequest, NextResponse } from 'next/server';
import { gzip, deflate, brotliCompress, constants } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const deflateAsync = promisify(deflate);
const brotliAsync = promisify(brotliCompress);

export type CompressionConfig = {
  threshold?: number;
  level?: number;
  encodings?: ('gzip' | 'deflate' | 'br')[];
  filter?: (request: NextRequest, response: NextResponse) => boolean;
  skipCompressedContent?: boolean;
};

/**
 * Default compression configuration
 */
export const defaultCompressionConfig: CompressionConfig = {
  threshold: 1024, // 1KB minimum size
  level: 6, // Compression level (0-9 for gzip/deflate, 0-11 for brotli)
  encodings: ['br', 'gzip', 'deflate'],
  skipCompressedContent: true,
};

/**
 * Determine the best encoding based on Accept-Encoding header
 */
function selectEncoding(
  acceptEncoding: string | null,
  availableEncodings: string[]
): string | null {
  if (!acceptEncoding) return null;

  const accepted = acceptEncoding
    .toLowerCase()
    .split(',')
    .map((encoding) => encoding.trim());

  // Prefer brotli > gzip > deflate
  const preferenceOrder = ['br', 'gzip', 'deflate'];

  for (const preferred of preferenceOrder) {
    if (availableEncodings.includes(preferred) && accepted.includes(preferred)) {
      return preferred;
    }
  }

  return null;
}

/**
 * Compress data using the specified encoding
 */
async function compressData(
  data: Buffer | string,
  encoding: string,
  level: number
): Promise<Buffer> {
  const input = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;

  switch (encoding) {
    case 'gzip':
      return gzipAsync(input, { level });
    case 'deflate':
      return deflateAsync(input, { level });
    case 'br':
      return brotliAsync(input, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: level,
        },
      });
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

/**
 * Check if content should be compressed
 */
function shouldCompress(
  request: NextRequest,
  response: NextResponse,
  config: CompressionConfig
): boolean {
  // Check custom filter
  if (config.filter && !config.filter(request, response)) {
    return false;
  }

  // Check if already compressed
  if (config.skipCompressedContent) {
    const contentEncoding = response.headers.get('content-encoding');
    if (contentEncoding && contentEncoding !== 'identity') {
      return false;
    }
  }

  // Check content type
  const contentType = response.headers.get('content-type');
  if (!contentType) return false;

  // Compress JSON, text, HTML, CSS, JavaScript, XML
  const compressibleTypes = [
    'application/json',
    'application/javascript',
    'application/xml',
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'text/xml',
  ];

  return compressibleTypes.some((type) => contentType.includes(type));
}

/**
 * Compression middleware for Next.js API routes
 */
export function withCompression(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse,
  config?: CompressionConfig
) {
  const compressionConfig = { ...defaultCompressionConfig, ...config };

  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const response = await handler(request, context);

    // Check if compression should be applied
    if (!shouldCompress(request, response, compressionConfig)) {
      return response;
    }

    // Get Accept-Encoding header
    const acceptEncoding = request.headers.get('accept-encoding');
    const selectedEncoding = selectEncoding(
      acceptEncoding,
      compressionConfig.encodings || []
    );

    if (!selectedEncoding) {
      return response;
    }

    try {
      // Clone the response to avoid consuming the original stream
      const clonedResponse = response.clone();
      
      // Get response body from the clone
      const originalBody = await clonedResponse.text();

      // Check threshold
      if (
        originalBody.length < (compressionConfig.threshold || 0)
      ) {
        return response;
      }

      // Compress the body
      const compressedBody = await compressData(
        originalBody,
        selectedEncoding,
        compressionConfig.level || 6
      );

      // Create new response with compressed body
      const compressedResponse = new NextResponse(compressedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      // Set compression headers
      compressedResponse.headers.set('content-encoding', selectedEncoding);
      compressedResponse.headers.set('vary', 'accept-encoding');
      compressedResponse.headers.delete('content-length'); // Remove as it will be wrong

      return compressedResponse;
    } catch (error) {
      console.error('Compression error:', error);
      // Return original response on error
      return response;
    }
  };
}

/**
 * Pre-configured compression for different use cases
 */
export const Compression = {
  /**
   * Default compression for API routes
   */
  api: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withCompression(handler, {
      threshold: 1024, // 1KB
      level: 6,
    }),

  /**
   * Aggressive compression for large responses
   */
  aggressive: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withCompression(handler, {
      threshold: 512, // 512 bytes
      level: 9, // Maximum compression
    }),

  /**
   * Fast compression for real-time responses
   */
  fast: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withCompression(handler, {
      threshold: 2048, // 2KB
      level: 1, // Fastest compression
    }),

  /**
   * Compression for search results
   */
  search: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withCompression(handler, {
      threshold: 1024,
      level: 6,
      filter: (req, res) => {
        // Only compress successful responses
        return res.status === 200;
      },
    }),

  /**
   * Compression for webhook responses (usually small)
   */
  webhook: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withCompression(handler, {
      threshold: 2048, // Higher threshold for webhooks
      level: 3, // Balanced speed/compression
    }),
};
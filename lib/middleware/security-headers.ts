import { NextRequest, NextResponse } from 'next/server';
import helmet from 'helmet';

export type SecurityHeadersConfig = {
  contentSecurityPolicy?: helmet.ContentSecurityPolicyOptions | false;
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: helmet.CrossOriginOpenerPolicyOptions | false;
  crossOriginResourcePolicy?: helmet.CrossOriginResourcePolicyOptions | false;
  dnsPrefetchControl?: helmet.DnsPrefetchControlOptions | false;
  frameguard?: helmet.FrameguardOptions | false;
  hidePoweredBy?: boolean;
  hsts?: helmet.StrictTransportSecurityOptions | false;
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: helmet.PermittedCrossDomainPoliciesOptions | false;
  referrerPolicy?: helmet.ReferrerPolicyOptions | false;
  xssFilter?: boolean;
};

/**
 * Default security headers configuration
 */
export const defaultSecurityConfig: SecurityHeadersConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      childSrc: ["'self'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
    reportOnly: false,
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
};

/**
 * Development-friendly security headers configuration
 */
export const developmentSecurityConfig: SecurityHeadersConfig = {
  ...defaultSecurityConfig,
  contentSecurityPolicy: {
    directives: {
      ...defaultSecurityConfig.contentSecurityPolicy?.directives,
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "http:", "https:"],
      connectSrc: ["'self'", "http:", "https:", "ws:", "wss:"],
    },
    reportOnly: true,
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: false,
};

/**
 * Apply security headers to a response
 */
function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = defaultSecurityConfig
) {
  // Content Security Policy
  if (config.contentSecurityPolicy !== false) {
    const csp = buildCSP(config.contentSecurityPolicy);
    if (csp) {
      response.headers.set(
        config.contentSecurityPolicy.reportOnly
          ? 'Content-Security-Policy-Report-Only'
          : 'Content-Security-Policy',
        csp
      );
    }
  }

  // COEP
  if (config.crossOriginEmbedderPolicy) {
    response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  }

  // COOP
  if (config.crossOriginOpenerPolicy !== false) {
    response.headers.set(
      'Cross-Origin-Opener-Policy',
      config.crossOriginOpenerPolicy.policy
    );
  }

  // CORP
  if (config.crossOriginResourcePolicy !== false) {
    response.headers.set(
      'Cross-Origin-Resource-Policy',
      config.crossOriginResourcePolicy.policy
    );
  }

  // DNS Prefetch Control
  if (config.dnsPrefetchControl !== false) {
    response.headers.set(
      'X-DNS-Prefetch-Control',
      config.dnsPrefetchControl.allow ? 'on' : 'off'
    );
  }

  // Frameguard
  if (config.frameguard !== false) {
    let value = 'DENY';
    if (config.frameguard.action === 'sameorigin') {
      value = 'SAMEORIGIN';
    } else if (config.frameguard.action === 'allow-from' && config.frameguard.domain) {
      value = `ALLOW-FROM ${config.frameguard.domain}`;
    }
    response.headers.set('X-Frame-Options', value);
  }

  // Hide Powered By
  if (config.hidePoweredBy) {
    response.headers.delete('X-Powered-By');
  }

  // HSTS
  if (config.hsts !== false) {
    let value = `max-age=${config.hsts.maxAge}`;
    if (config.hsts.includeSubDomains) {
      value += '; includeSubDomains';
    }
    if (config.hsts.preload) {
      value += '; preload';
    }
    response.headers.set('Strict-Transport-Security', value);
  }

  // IE No Open
  if (config.ieNoOpen) {
    response.headers.set('X-Download-Options', 'noopen');
  }

  // No Sniff
  if (config.noSniff) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }

  // Origin Agent Cluster
  if (config.originAgentCluster) {
    response.headers.set('Origin-Agent-Cluster', '?1');
  }

  // Permitted Cross Domain Policies
  if (config.permittedCrossDomainPolicies !== false) {
    response.headers.set(
      'X-Permitted-Cross-Domain-Policies',
      config.permittedCrossDomainPolicies.permittedPolicies
    );
  }

  // Referrer Policy
  if (config.referrerPolicy !== false) {
    const policies = Array.isArray(config.referrerPolicy.policy)
      ? config.referrerPolicy.policy
      : [config.referrerPolicy.policy];
    response.headers.set('Referrer-Policy', policies.join(','));
  }

  // XSS Filter
  if (config.xssFilter) {
    response.headers.set('X-XSS-Protection', '1; mode=block');
  }

  return response;
}

/**
 * Build Content Security Policy string from directives
 */
function buildCSP(config: helmet.ContentSecurityPolicyOptions): string {
  if (!config.directives) return '';

  const directives: string[] = [];
  
  for (const [key, value] of Object.entries(config.directives)) {
    const directiveName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    
    if (Array.isArray(value) && value.length === 0) {
      directives.push(directiveName);
    } else if (Array.isArray(value)) {
      directives.push(`${directiveName} ${value.join(' ')}`);
    } else if (typeof value === 'string') {
      directives.push(`${directiveName} ${value}`);
    }
  }

  return directives.join('; ');
}

/**
 * Security headers middleware for Next.js API routes
 */
export function withSecurityHeaders(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse,
  config?: SecurityHeadersConfig
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const securityConfig =
      process.env.NODE_ENV === 'production'
        ? { ...defaultSecurityConfig, ...config }
        : { ...developmentSecurityConfig, ...config };

    const response = await handler(request, context);
    return applySecurityHeaders(response, securityConfig);
  };
}

/**
 * Pre-configured security headers for different use cases
 */
export const SecurityHeaders = {
  /**
   * Default security headers for API routes
   */
  api: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withSecurityHeaders(handler, {
      contentSecurityPolicy: false, // CSP not needed for API routes
      frameguard: { action: 'deny' },
    }),

  /**
   * Security headers for webhook endpoints
   */
  webhook: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withSecurityHeaders(handler, {
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin for webhooks
      frameguard: { action: 'deny' },
    }),

  /**
   * Security headers for public API endpoints
   */
  publicApi: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withSecurityHeaders(handler, {
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),

  /**
   * Security headers for admin routes (stricter)
   */
  admin: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withSecurityHeaders(handler, {
      ...defaultSecurityConfig,
      contentSecurityPolicy: {
        ...defaultSecurityConfig.contentSecurityPolicy,
        directives: {
          ...defaultSecurityConfig.contentSecurityPolicy?.directives,
          frameAncestors: ["'none'"], // No framing allowed for admin
        },
      },
    }),
};
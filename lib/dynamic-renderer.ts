import { chromium, Browser, Page } from 'playwright';

interface RenderingResult {
  html: string;
  contentLength: number;
  renderingTime: number;
  signals: {
    hasJavaScript: boolean;
    hasDynamicContent: boolean;
    hasAsyncLoading: boolean;
    hasFrameworks: boolean;
    contentDifference: number;
    loadTime: number;
  };
}

interface DetectionSignals {
  hasReactElements: boolean;
  hasVueElements: boolean;
  hasAngularElements: boolean;
  hasJavaScriptFrameworks: boolean;
  hasAsyncContent: boolean;
  hasSkeletonLoading: boolean;
  hasProgressIndicators: boolean;
  hasDataAttributes: boolean;
  hasClientSideRouting: boolean;
  hasDynamicUrls: boolean;
}

export class DynamicContentDetector {
  private static readonly SPA_INDICATORS = [
    // React indicators
    'react',
    'reactdom',
    '__react',
    '_reactInternalInstance',
    'data-reactroot',
    'data-react-',
    'react-root',

    // Vue indicators
    'vue',
    '__vue',
    'v-if',
    'v-for',
    'v-show',
    'data-v-',

    // Angular indicators
    'angular',
    'ng-',
    '_angular',
    'data-ng-',

    // General SPA indicators
    'single-page',
    'spa-',
    'client-side-rendering',
    'csr-',
    'hydrat',
    'mount-point',
    'app-root',
  ];

  private static readonly DYNAMIC_CONTENT_SELECTORS = [
    '[data-loading]',
    '[data-skeleton]',
    '.loading',
    '.skeleton',
    '.spinner',
    '.progress',
    '.lazy-load',
    '[data-lazy]',
    '[data-async]',
  ];

  static async detectRenderingNeeds(url: string, initialHtml?: string): Promise<boolean> {
    const signals = await this.analyzeStaticSignals(url, initialHtml || '');

    // If we detect strong SPA signals, we need dynamic rendering
    if (signals.hasReactElements || signals.hasVueElements || signals.hasAngularElements) {
      return true;
    }

    // If we detect async content or loading patterns
    if (signals.hasAsyncContent || signals.hasSkeletonLoading) {
      return true;
    }

    // Check URL patterns that typically indicate dynamic content
    if (signals.hasDynamicUrls) {
      return true;
    }

    return false;
  }

  private static async analyzeStaticSignals(url: string, html: string): Promise<DetectionSignals> {
    const lowerHtml = html.toLowerCase();
    const lowerUrl = url.toLowerCase();

    return {
      hasReactElements: this.containsAny(lowerHtml, [
        'react',
        '__react',
        'data-reactroot',
        'data-react-',
      ]),
      hasVueElements: this.containsAny(lowerHtml, ['__vue', 'v-if', 'v-for', 'data-v-']),
      hasAngularElements: this.containsAny(lowerHtml, ['angular', 'ng-', 'data-ng-']),
      hasJavaScriptFrameworks: this.containsAny(lowerHtml, this.SPA_INDICATORS),
      hasAsyncContent: this.containsAny(lowerHtml, [
        'async',
        'await',
        'fetch(',
        'xmlhttprequest',
        'axios',
      ]),
      hasSkeletonLoading: this.containsAny(lowerHtml, [
        'skeleton',
        'loading',
        'spinner',
        'data-loading',
      ]),
      hasProgressIndicators: this.containsAny(lowerHtml, [
        'progress',
        'loading-bar',
        'load-indicator',
      ]),
      hasDataAttributes: /data-[a-z]+-[a-z]+/i.test(html),
      hasClientSideRouting: this.containsAny(lowerHtml, [
        'router',
        'route-',
        'history.push',
        'navigate',
      ]),
      hasDynamicUrls: this.containsAny(lowerUrl, [
        '/app/',
        '/dashboard/',
        '/admin/',
        '/#/',
        '/spa/',
      ]),
    };
  }

  private static containsAny(text: string, patterns: string[]): boolean {
    return patterns.some((pattern) => text.includes(pattern));
  }
}

export class PlaywrightRenderer {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }

  async renderPage(
    url: string,
    options: {
      timeout?: number;
      waitForSelector?: string;
      waitForLoadState?: 'load' | 'domcontentloaded' | 'networkidle';
      viewport?: { width: number; height: number };
    } = {}
  ): Promise<RenderingResult> {
    if (!this.browser) {
      await this.initialize();
    }

    const startTime = Date.now();
    const page = await this.browser!.newPage();

    try {
      // Set viewport
      if (options.viewport) {
        await page.setViewportSize(options.viewport);
      }

      // Navigate to page
      const response = await page.goto(url, {
        timeout: options.timeout || 30000,
        waitUntil: options.waitForLoadState || 'networkidle',
      });

      // Wait for specific selector if provided
      if (options.waitForSelector) {
        await page
          .waitForSelector(options.waitForSelector, {
            timeout: 10000,
          })
          .catch(() => {
            // Selector not found, continue anyway
          });
      }

      // Wait for any dynamic content to load
      await page.waitForTimeout(2000);

      // Get initial content length
      const initialLength = await page.content().then((c) => c.length);

      // Wait a bit more for any lazy-loaded content
      await page.waitForTimeout(3000);

      // Get final content
      const finalHtml = await page.content();
      const renderingTime = Date.now() - startTime;

      // Analyze what we detected
      const signals = await this.analyzeRenderedContent(page, initialLength, finalHtml.length);

      return {
        html: finalHtml,
        contentLength: finalHtml.length,
        renderingTime,
        signals,
      };
    } finally {
      await page.close();
    }
  }

  private async analyzeRenderedContent(page: Page, initialLength: number, finalLength: number) {
    // Check for JavaScript execution
    const hasJavaScript = await page
      .evaluate(() => {
        return (
          typeof window !== 'undefined' && window.document && window.document.scripts.length > 0
        );
      })
      .catch(() => false);

    // Check for dynamic loading indicators
    const hasDynamicContent = await page
      .evaluate(() => {
        const indicators = document.querySelectorAll(
          '[data-loading], .loading, .skeleton, .spinner'
        );
        return indicators.length > 0;
      })
      .catch(() => false);

    // Check for async loading patterns
    const hasAsyncLoading = await page
      .evaluate(() => {
        const asyncElements = document.querySelectorAll('[data-lazy], [data-async], .lazy-load');
        return asyncElements.length > 0;
      })
      .catch(() => false);

    // Check for common frameworks
    const hasFrameworks = await page
      .evaluate(() => {
        return !!(
          (window as any).React ||
          (window as any).Vue ||
          (window as any).angular ||
          document.querySelector('[data-reactroot]') ||
          document.querySelector('[data-v-]') ||
          document.querySelector('[ng-app]')
        );
      })
      .catch(() => false);

    const contentDifference = finalLength - initialLength;

    return {
      hasJavaScript,
      hasDynamicContent,
      hasAsyncLoading,
      hasFrameworks,
      contentDifference,
      loadTime: 0, // This would be measured during the rendering process
    };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Singleton instance for reuse
export const dynamicRenderer = new PlaywrightRenderer();

// Utility function to determine rendering strategy
export async function shouldUseDynamicRendering(
  url: string,
  staticHtml?: string
): Promise<{
  useDynamic: boolean;
  confidence: number;
  reasons: string[];
}> {
  const reasons: string[] = [];
  let confidence = 0;

  // Analyze static signals first (fast)
  const needsDynamic = await DynamicContentDetector.detectRenderingNeeds(url, staticHtml);

  if (needsDynamic) {
    confidence += 0.7;
    reasons.push('SPA framework detected in HTML or URL pattern');
  }

  // URL-based detection
  if (url.includes('docs.') || url.includes('/docs/')) {
    confidence += 0.3;
    reasons.push('Documentation site - likely static');
  }

  if (url.includes('/app/') || url.includes('/dashboard/') || url.includes('/#/')) {
    confidence += 0.8;
    reasons.push('Application route detected');
  }

  // Content-based detection if we have HTML
  if (staticHtml) {
    if (staticHtml.includes('<!-- This HTML file is a template -->')) {
      confidence += 0.9;
      reasons.push('Template-based SPA detected');
    }

    if (staticHtml.includes('Loading...') || staticHtml.includes('loading')) {
      confidence += 0.4;
      reasons.push('Loading indicators found');
    }
  }

  const useDynamic = confidence > 0.5;

  return {
    useDynamic,
    confidence,
    reasons,
  };
}

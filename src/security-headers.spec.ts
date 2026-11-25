import {
  APP_SOURCE,
  TAG_SOURCES,
  TURNSTILE_ORIGIN,
  headerKindForPath,
  isHttpsRequest,
  securityHeaders,
} from './security-headers';

describe('security-headers', () => {
  describe('headerKindForPath', () => {
    it.each(['/7K3MQ9XAC', '/7K3M-Q9XA-C', '/7k3m-q9xa-c/', '/7k3m%20q9xa%20c', '/7K3M%20Q9XA%20C/'])(
      '%s é da tag',
      (path) => expect(headerKindForPath(path)).toBe('tag'),
    );

    it.each([
      '/',
      '/auth/login',
      '/app/conta/senha',
      '/admin',
      '/legal/termos',
      '/favicon.ico',
      '/7K3MQ9XAC/perdido',
      '/ativar/7K3MQ9XAC',
      '/12345678',
      '/123456789012',
      '/recuperar-senha',
    ])('%s é do app', (path) => expect(headerKindForPath(path)).toBe('app'));
  });

  it('as fontes da tag e a do app são mutuamente exclusivas por construção', () => {
    expect(TAG_SOURCES.length).toBeGreaterThan(0);
    expect(APP_SOURCE.startsWith('/((?!')).toBe(true);
  });

  describe('valores', () => {
    const tag = securityHeaders('tag', { https: true });
    const app = securityHeaders('app', { https: true });

    it('tag: sem host de terceiro, sem frame-src, sem câmera, sem referrer', () => {
      expect(tag['Content-Security-Policy']).not.toContain(TURNSTILE_ORIGIN);
      expect(tag['Content-Security-Policy']).not.toContain('frame-src');
      expect(tag['Permissions-Policy']).toBe('geolocation=(self), camera=(), microphone=(), payment=(), usb=()');
      expect(tag['Referrer-Policy']).toBe('no-referrer');
      expect(tag['Cross-Origin-Opener-Policy']).toBe('same-origin');
      expect(tag['Cross-Origin-Resource-Policy']).toBe('same-origin');
    });

    it('app: desafio em script-src e frame-src, câmera própria, popups permitidos', () => {
      const csp = app['Content-Security-Policy'];
      expect(csp).toContain(`script-src 'self' ${TURNSTILE_ORIGIN}`);
      expect(csp).toContain(`frame-src ${TURNSTILE_ORIGIN}`);
      expect(app['Permissions-Policy']).toBe('geolocation=(self), camera=(self), microphone=(), payment=(), usb=()');
      expect(app['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(app['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
    });

    it('nunca afrouxa a CSP: sem unsafe-eval nem unsafe-inline em script-src', () => {
      for (const headers of [tag, app]) {
        const csp = headers['Content-Security-Policy'];
        expect(csp).not.toContain("'unsafe-eval'");
        expect(csp.split('; ').find((d) => d.startsWith('script-src'))).not.toContain("'unsafe-inline'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(headers['X-Frame-Options']).toBe('DENY');
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
      }
    });

    it('HSTS sem preload', () => {
      expect(tag['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains');
      expect(app['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains');
    });

    it('em HTTP (localhost) não há HSTS nem upgrade-insecure-requests', () => {
      for (const kind of ['tag', 'app'] as const) {
        const http = securityHeaders(kind, { https: false });
        expect(http['Strict-Transport-Security']).toBeUndefined();
        expect(http['Content-Security-Policy']).not.toContain('upgrade-insecure-requests');
        expect(securityHeaders(kind, { https: true })['Content-Security-Policy']).toContain(
          'upgrade-insecure-requests',
        );
      }
    });

    it('o host do Supabase entra no connect-src', () => {
      const csp = securityHeaders('app', { https: false, supabaseHost: 'abc.supabase.co' })['Content-Security-Policy'];
      expect(csp).toContain('connect-src \'self\' https://abc.supabase.co wss://abc.supabase.co');
    });
  });

  describe('isHttpsRequest', () => {
    it('lê x-forwarded-proto (Vercel) e o socket cifrado', () => {
      expect(isHttpsRequest('https', false)).toBe(true);
      expect(isHttpsRequest('https, http', false)).toBe(true);
      expect(isHttpsRequest(['https'], false)).toBe(true);
      expect(isHttpsRequest('http', false)).toBe(false);
      expect(isHttpsRequest(undefined, false)).toBe(false);
      expect(isHttpsRequest(undefined, true)).toBe(true);
    });
  });
});

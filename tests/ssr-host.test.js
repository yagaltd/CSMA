import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSSRApp, loadSSRConfig, matchSSRPage } from '../server/ssr-hono/app.js';

function createAssetManifest() {
  return {
    activation: {
      isEntry: true,
      file: 'assets/page-activation.js',
      css: ['assets/app.css']
    }
  };
}

describe('ssr-hono host', () => {
  const tempDirs = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('loads SSR config defaults for demo', async () => {
    const config = await loadSSRConfig('demo');

    expect(config).toMatchObject({
      appPreset: 'full-csr',
      enabled: false,
      pagesModule: './render.pages.js',
      publicAssetsDir: 'dist-ssr/demo',
      payloadScriptId: 'csma-render-bootstrap',
      site: 'default',
      port: 8787
    });
  });

  it('matches SSR pages by exact route path', () => {
    const pages = [
      { id: 'home', routePath: '/', viewId: 'ai-ui.login-form' },
      { id: 'contact', routePath: '/contact', viewId: 'ai-ui.contact-form' }
    ];

    expect(matchSSRPage(pages, '/contact')).toEqual(pages[1]);
    expect(matchSSRPage(pages, '/contact/')).toEqual(pages[1]);
  });

  it('rejects SSR host startup when the app preset does not enable SSR', async () => {
    await expect(createSSRApp({
      appName: 'demo'
    })).rejects.toThrow(/SSR disabled/i);
  });

  it('renders HTML from the shared contract path for manifest-backed pages', async () => {
    const { app } = await createSSRApp({
      appName: 'demo',
      config: {
        pagesModule: './render.pages.js',
        publicAssetsDir: 'dist-ssr/demo',
        payloadScriptId: 'csma-render-bootstrap',
        ssmaBaseUrl: '',
        site: 'default',
        port: 8787
      },
      pages: [
        {
          id: 'auth-login',
          routePath: '/',
          viewId: 'ai-ui.login-form',
          title: 'Sign in',
          description: 'SSR uses the same render contract.',
          props: {
            headline: 'SSR Sign in',
            supportingText: 'Rendered through the shared contract path.'
          }
        }
      ],
      assetManifest: createAssetManifest(),
      fetchImpl: vi.fn()
    });

    const response = await app.request('http://localhost/');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('SSR Sign in');
    expect(html).toContain('/assets/app.css');
    expect(html).not.toContain('/assets/page-activation.js');
    expect(html).not.toContain('csma-render-bootstrap');
  });

  it('forwards SSMA request context and relays response headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'ok',
      data: {
        headline: 'Welcome back from SSMA',
        supportingText: 'Request context reached the gateway.'
      }
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'ssma_anon=guest-123; Path=/; HttpOnly; SameSite=Lax',
        'x-request-id': 'req-ssma-42'
      }
    }));
    const { app } = await createSSRApp({
      appName: 'demo',
      config: {
        pagesModule: './render.pages.js',
        publicAssetsDir: 'dist-ssr/demo',
        payloadScriptId: 'csma-render-bootstrap',
        ssmaBaseUrl: 'https://ssma.example.test',
        site: 'marketing',
        port: 8787
      },
      pages: [
        {
          id: 'auth-login',
          routePath: '/',
          viewId: 'ai-ui.login-form',
          title: 'Sign in',
          ssmaQuery: {
            name: 'page.login',
            buildPayload: ({ searchParams }) => ({
              ref: searchParams.get('ref')
            }),
            mapResponse: (_context, data) => ({
              props: {
                headline: data.headline,
                supportingText: data.supportingText
              }
            })
          }
        }
      ],
      assetManifest: createAssetManifest(),
      fetchImpl
    });

    const response = await app.request(new Request('http://localhost/?ref=hero', {
      headers: {
        cookie: 'ssma_anon=existing-guest',
        'user-agent': 'VitestAgent/1.0',
        'x-request-id': 'req-incoming-1',
        'x-forwarded-for': '203.0.113.10'
      }
    }));
    const html = await response.text();

    expect(fetchImpl).toHaveBeenCalledWith('https://ssma.example.test/query/page.login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'ssma_anon=existing-guest',
        'user-agent': 'VitestAgent/1.0',
        'x-ssma-site': 'marketing',
        'x-request-id': 'req-incoming-1',
        'x-forwarded-for': '203.0.113.10'
      },
      body: JSON.stringify({
        payload: {
          ref: 'hero'
        }
      })
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBe('ssma_anon=guest-123; Path=/; HttpOnly; SameSite=Lax');
    expect(response.headers.get('x-request-id')).toBe('req-ssma-42');
    expect(html).toContain('Welcome back from SSMA');
    expect(html).not.toContain('/assets/page-activation.js');
  });

  it('returns 404 for unknown routes', async () => {
    const { app } = await createSSRApp({
      appName: 'demo',
      config: {
        pagesModule: './render.pages.js',
        publicAssetsDir: 'dist-ssr/demo',
        payloadScriptId: 'csma-render-bootstrap',
        ssmaBaseUrl: '',
        site: 'default',
        port: 8787
      },
      pages: [
        { id: 'auth-login', routePath: '/', viewId: 'ai-ui.login-form', title: 'Sign in' }
      ],
      assetManifest: createAssetManifest(),
      fetchImpl: vi.fn()
    });

    const response = await app.request('http://localhost/missing');

    expect(response.status).toBe(404);
  });

  it('resolves trailing-slash requests with the shared page normalization rule', async () => {
    const { app } = await createSSRApp({
      appName: 'demo',
      config: {
        pagesModule: './render.pages.js',
        publicAssetsDir: 'dist-ssr/demo',
        payloadScriptId: 'csma-render-bootstrap',
        ssmaBaseUrl: '',
        site: 'default',
        port: 8787
      },
      pages: [
        { id: 'contact-page', routePath: '/contact', viewId: 'ai-ui.contact-form', title: 'Contact' }
      ],
      assetManifest: createAssetManifest(),
      fetchImpl: vi.fn()
    });

    const response = await app.request('http://localhost/contact/');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Contact');
  });

  it('returns 502 when SSMA fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'BACKEND_QUERY_FAILED'
    }), {
      status: 500,
      headers: {
        'content-type': 'application/json'
      }
    }));
    const { app } = await createSSRApp({
      appName: 'demo',
      config: {
        pagesModule: './render.pages.js',
        publicAssetsDir: 'dist-ssr/demo',
        payloadScriptId: 'csma-render-bootstrap',
        ssmaBaseUrl: 'https://ssma.example.test',
        site: 'default',
        port: 8787
      },
      pages: [
        {
          id: 'auth-login',
          routePath: '/',
          viewId: 'ai-ui.login-form',
          ssmaQuery: {
            name: 'page.login'
          }
        }
      ],
      assetManifest: createAssetManifest(),
      fetchImpl
    });

    const response = await app.request('http://localhost/');

    expect(response.status).toBe(502);
  });

  it('serves built assets from the configured SSR asset directory', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'csma-ssr-assets-'));
    tempDirs.push(tempDir);
    const assetsDir = path.join(tempDir, 'assets');
    await mkdir(assetsDir, { recursive: true });
    await writeFile(path.join(assetsDir, 'page-activation.js'), 'console.log("ssr asset");', 'utf8');

    const { app } = await createSSRApp({
      appName: 'demo',
      config: {
        pagesModule: './render.pages.js',
        publicAssetsDir: tempDir,
        payloadScriptId: 'csma-render-bootstrap',
        ssmaBaseUrl: '',
        site: 'default',
        port: 8787
      },
      pages: [
        { id: 'auth-login', routePath: '/', viewId: 'ai-ui.login-form', title: 'Sign in' }
      ],
      assetManifest: createAssetManifest(),
      fetchImpl: vi.fn()
    });

    const response = await app.request('http://localhost/assets/page-activation.js');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/javascript');
    expect(body).toContain('ssr asset');
  });
});

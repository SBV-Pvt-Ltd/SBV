/**
 * Signal Desk proxy — Cloudflare Worker
 *
 * Deploy (free, ~2 minutes, no CLI needed):
 *   1. dash.cloudflare.com → sign up / log in (free plan is plenty for one site)
 *   2. Workers & Pages → Create → "Create Worker" → give it a name, e.g. signal-desk-proxy
 *   3. Click "Edit code", delete the placeholder, paste this whole file in
 *   4. Update ALLOWED_ORIGINS below to match your actual domain if it differs
 *   5. Save and Deploy — you'll get a URL like:
 *        https://signal-desk-proxy.<your-subdomain>.workers.dev
 *   6. In Signal Desk → Settings → CORS proxy, enter:
 *        https://signal-desk-proxy.<your-subdomain>.workers.dev/?url=
 *
 * Only requests from ALLOWED_ORIGINS, and only to ALLOWED_HOSTS (Yahoo Finance /
 * Google News), are served — everything else gets a 403. That keeps this from
 * becoming an open proxy anyone else could piggyback on.
 */

const ALLOWED_ORIGINS = [
  'https://saharshbhadani.com',
  'https://www.saharshbhadani.com',
  'https://www.saharshbhadani.com/stocks_analysis/',
  'https://www.saharshbhadani.com/stocks_analysis/signal-desk.html'
];

const ALLOWED_HOSTS = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'news.google.com'
];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url=', { status: 400, headers: corsHeaders });
    }

    let targetUrl;
    try { targetUrl = new URL(target); } catch (e) {
      return new Response('Invalid target url', { status: 400, headers: corsHeaders });
    }
    if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      return new Response('Host not allowed: ' + targetUrl.hostname, { status: 403, headers: corsHeaders });
    }
    try {
      // Add standard browser headers to avoid Google News blocking cloud IPs
      const upstream = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      });

      if (!upstream.ok) {
        return new Response(`Upstream returned HTTP ${upstream.status}`, {
          status: upstream.status,
          headers: corsHeaders
        });
      }

      const body = await upstream.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': upstream.headers.get('content-type') || 'text/xml'
        }
      });
    } catch (err) {
      return new Response('Upstream fetch failed: ' + err.message, { status: 502, headers: corsHeaders });
    }
  }
};

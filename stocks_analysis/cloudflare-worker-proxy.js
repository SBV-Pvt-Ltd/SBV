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
 * Google News) via the generic ?url= route, are served — everything else gets a
 * 403. That keeps this from becoming an open proxy anyone else could piggyback on.
 *
 * There's a second, separate route — GET /nse-quote?symbol=RELIANCE — used only
 * as a last-resort fallback when Yahoo Finance has no data for a symbol. NSE
 * India's own quote API blocks plain requests, so this route does the two-step
 * dance their own website does: fetch the quote page first to pick up a session
 * cookie, then call the JSON API with that cookie attached. This is inherently
 * more fragile than the Yahoo passthrough — NSE can still block datacenter IPs
 * outright regardless of cookies — which is exactly why it's tried last, not first.
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
  'news.google.com',
  'script.google.com'
];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9'
};

async function fetchNseQuote(symbol){
  const quotePage = 'https://www.nseindia.com/get-quotes/equity?symbol=' + encodeURIComponent(symbol);

  // Step 1: warm-up request — NSE only issues the session cookie a browser needs
  // to a request that looks like it came from visiting the page directly.
  const homeRes = await fetch(quotePage, {
    headers: { ...BROWSER_HEADERS, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
  });

  let cookieHeader = '';
  if (typeof homeRes.headers.getSetCookie === 'function'){
    cookieHeader = homeRes.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  } else {
    const raw = homeRes.headers.get('set-cookie') || '';
    cookieHeader = raw.split(',').map(c => c.trim().split(';')[0]).filter(c => c.includes('=')).join('; ');
  }

  // Step 2: the actual quote API, using the cookie just picked up.
  const apiRes = await fetch('https://www.nseindia.com/api/quote-equity?symbol=' + encodeURIComponent(symbol), {
    headers: {
      ...BROWSER_HEADERS,
      'Accept': 'application/json, text/plain, */*',
      'Referer': quotePage,
      'Cookie': cookieHeader
    }
  });
  if (!apiRes.ok) throw new Error('NSE HTTP ' + apiRes.status);
  return await apiRes.json();
}

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

    if (reqUrl.pathname === '/nse-quote'){
      const symbol = reqUrl.searchParams.get('symbol');
      if (!symbol) return new Response('Missing ?symbol=', { status: 400, headers: corsHeaders });
      try{
        const data = await fetchNseQuote(symbol);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }catch(err){
        return new Response('NSE fetch failed: ' + err.message, { status: 502, headers: corsHeaders });
      }
    }

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
          ...BROWSER_HEADERS,
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
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

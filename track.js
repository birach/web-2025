// Safe, minimal tracker. Sends one POST per pageview to window.TRACK_ENDPOINT.
// No external geo lookup here; server-side Worker will enrich with CF info.
// Add <script src="config.js"></script> before including this file.

(function () {
  try {
    function readCookie(name) {
      var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
      return m ? decodeURIComponent(m[2]) : null;
    }
    function setCookie(name, value, days) {
      var expires = new Date(Date.now() + (days||3650)*24*60*60*1000).toUTCString();
      document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; expires=' + expires + '; SameSite=Lax';
    }
    function newUuid() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    function run() {
      try {
        var TRACK_ENDPOINT = (window && window.TRACK_ENDPOINT) ? window.TRACK_ENDPOINT : '';
        if (!TRACK_ENDPOINT || TRACK_ENDPOINT.indexOf('REPLACE_WITH_YOUR_WORKER_URL') !== -1) {
          // Not configured; in local dev log to console
          if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            console.log('[tracker] TRACK_ENDPOINT not configured:', TRACK_ENDPOINT);
          }
          return;
        }

        var visitorCookieName = 'visitor_id_v1';
        var visitorId = readCookie(visitorCookieName);
        if (!visitorId) {
          visitorId = newUuid();
          try { setCookie(visitorCookieName, visitorId, 3650); } catch (e) {}
        }

        var payload = {
          visitorId: visitorId,
          page: (location && location.pathname ? location.pathname : '') + (location.search || ''),
          ts: new Date().toISOString(),
          referrer: (document && document.referrer) ? document.referrer : '',
          userAgent: (navigator && navigator.userAgent) ? navigator.userAgent : ''
        };

        // Send non-blocking via fetch with keepalive and swallow any errors
        try {
          if (window.fetch) {
            setTimeout(function () {
              try {
                fetch(TRACK_ENDPOINT, {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify(payload),
                  keepalive: true
                }).catch(function () { /* ignore */ });
              } catch (e) { /* ignore */ }
            }, 0);
          } else if (navigator && navigator.sendBeacon) {
            try {
              var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
              navigator.sendBeacon(TRACK_ENDPOINT, blob);
            } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
      } catch (e) { /* swallow */ }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(run, 0);
    } else {
      window.addEventListener('load', function () { setTimeout(run, 0); }, {passive:true});
    }
  } catch (err) { /* final swallow */ }
})();

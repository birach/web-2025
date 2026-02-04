// Lightweight tracker — place in the repo root next to index.html and script.js.
// It reads window.TRACK_ENDPOINT (set in config.js) and sends a POST on each page load.

(function () {
  var TRACK_ENDPOINT = window.TRACK_ENDPOINT || '';

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

  var visitorCookieName = 'visitor_id_v1';
  var visitorId = readCookie(visitorCookieName);
  if (!visitorId) {
    visitorId = newUuid();
    setCookie(visitorCookieName, visitorId, 3650);
  }

  var payloadBase = {
    visitorId: visitorId,
    page: location.pathname + location.search,
    ts: new Date().toISOString(),
    referrer: document.referrer || '',
    userAgent: navigator.userAgent || ''
  };

  var LOCATION_TIMEOUT = 1200;
  var locationResolved = false;
  var didSend = false;

  function sendPayload(payload) {
    if (!TRACK_ENDPOINT || TRACK_ENDPOINT.indexOf('REPLACE_WITH_YOUR_APPS_SCRIPT_URL') !== -1) {
      // not configured — in dev log to console
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') console.log('TRACK payload', payload);
      return;
    }
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(TRACK_ENDPOINT, blob);
      } else {
        fetch(TRACK_ENDPOINT, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: body,
          keepalive: true
        }).catch(function(){});
      }
    } catch (e) { console.warn('tracking send error', e); }
  }

  var timer = setTimeout(function () {
    if (!locationResolved && !didSend) {
      didSend = true;
      sendPayload(payloadBase);
    }
  }, LOCATION_TIMEOUT);

  // IP-based geolocation (no permission prompt). Uses ipapi.co (free tier).
  fetch('https://ipapi.co/json/')
    .then(function (res) { return res.ok ? res.json() : Promise.reject('no geo'); })
    .then(function (loc) {
      locationResolved = true;
      clearTimeout(timer);
      var payload = Object.assign({}, payloadBase, {
        location: {
          ip: loc.ip || '',
          city: loc.city || '',
          region: loc.region || '',
          country: loc.country_name || '',
          latitude: loc.latitude || loc.lat || '',
          longitude: loc.longitude || loc.lon || ''
        }
      });
      if (!didSend) { didSend = true; sendPayload(payload); }
    })
    .catch(function () {
      // if geo lookup fails, timeout will trigger sendPayload with base payload
    });

  if (!window.fetch) { sendPayload(payloadBase); }
})();

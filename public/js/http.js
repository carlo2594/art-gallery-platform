'use strict';

// Axios wrapper + fetch shim
// - Exposes window.api (axios instance with defaults)
// - Overrides window.fetch to route through axios while preserving fetch-like semantics

(function initHttp() {
  try {
    if (!window || !window.axios) {
      console.error('[http] Axios no está disponible en window. Asegúrate de incluirlo antes.');
      return;
    }

    // Create a dedicated axios instance for app use
    var api = window.axios.create({
      withCredentials: true,
      timeout: 15000,
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });

    // Optional: normalize error objects (keep axios behavior but add a concise message field)
    api.interceptors.response.use(
      function onFulfilled(res) { return res; },
      function onRejected(err) {
        try {
          var status = err && err.response && err.response.status;
          var data = err && err.response && err.response.data;
          var message = (data && (data.message || data.error)) || err.message || 'Request failed';
          err.normalized = { status: status, message: message, data: data };
        } catch (_) {}
        return Promise.reject(err);
      }
    );

    // Expose instance globally
    window.api = api;

    // Helper to convert fetch Headers/init headers to plain object
    function headersToObject(hdrs) {
      if (!hdrs) return undefined;
      // If already a plain object
      if (Object.prototype.toString.call(hdrs) === '[object Object]') return hdrs;
      // If it's a Headers-like iterable
      try {
        var out = {};
        if (typeof hdrs.forEach === 'function') {
          hdrs.forEach(function(v, k) { out[k] = v; });
          return out;
        }
        // Array of pairs
        if (Array.isArray(hdrs)) {
          for (var i = 0; i < hdrs.length; i++) {
            var pair = hdrs[i];
            if (pair && pair.length === 2) out[pair[0]] = pair[1];
          }
          return out;
        }
      } catch (_) {}
      return undefined;
    }

    // Build a fetch-like Response wrapper from axios response
    function toFetchResponse(resp) {
      var headersObj = resp && resp.headers ? resp.headers : {};
      var res = {
        ok: resp.status >= 200 && resp.status < 300,
        status: resp.status,
        statusText: resp.statusText || '',
        url: resp.config && resp.config.url,
        headers: {
          get: function(name) {
            if (!name) return null;
            var key = String(name).toLowerCase();
            return headersObj[key] || headersObj[name] || null;
          }
        },
        json: function() {
          return Promise.resolve(resp.data);
        },
        text: function() {
          if (typeof resp.data === 'string') return Promise.resolve(resp.data);
          try { return Promise.resolve(JSON.stringify(resp.data)); } catch (_) { return Promise.resolve(''); }
        }
      };
      return res;
    }

    // fetch shim using axios under the hood. Keeps fetch semantics:
    // - Does NOT reject on HTTP error status (uses validateStatus => true)
    // - Returns object with ok/status/json()/text()
    // - Maps credentials: 'include'/'same-origin' => withCredentials true
    // - Special-case keepalive: uses navigator.sendBeacon when possible
    function fetchShim(input, init) {
      init = init || {};
      var url = (typeof input === 'string') ? input : (input && input.url) || String(input);
      var method = (init.method || (input && input.method) || 'GET').toUpperCase();
      var headers = headersToObject(init.headers || (input && input.headers));
      var body = init.body;

      // If keepalive and sendBeacon available, prefer it for POST/PUT/PATCH
      if (init.keepalive && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        try {
          var beaconBody = body;
          // If body is a plain object and header signals JSON, stringify
          var ct = headers && (headers['Content-Type'] || headers['content-type']);
          if (ct && typeof beaconBody === 'object' && !(beaconBody instanceof FormData)) {
            beaconBody = (ct.indexOf('application/json') !== -1) ? JSON.stringify(beaconBody) : beaconBody;
          }
          var ok = navigator.sendBeacon(url, beaconBody);
          var resp = { status: ok ? 204 : 500, statusText: ok ? 'No Content' : 'Failed', config: { url: url }, headers: {} };
          return Promise.resolve(toFetchResponse(resp));
        } catch (_) {}
      }

      var withCreds = false;
      if (init.credentials === 'include' || init.credentials === 'same-origin') withCreds = true;

      var config = {
        url: url,
        method: method,
        headers: headers,
        data: body,
        withCredentials: withCreds,
        // Important: do not reject for non-2xx to preserve fetch behavior
        validateStatus: function() { return true; }
      };

      return api.request(config).then(function(resp) {
        return toFetchResponse(resp);
      }, function(err) {
        // Network/timeout errors: emulate fetch rejecting only on network errors
        return Promise.reject(err);
      });
    }

    // Install the shim if fetch exists or not
    try {
      window.fetch = fetchShim;
    } catch (e) {
      try { window['fetch'] = fetchShim; } catch(_) {}
    }

  } catch (e) {
    try { console.error('[http] init error:', e); } catch(_) {}
  }
})();


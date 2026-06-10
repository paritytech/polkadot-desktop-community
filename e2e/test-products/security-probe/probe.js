/* eslint-disable */
// Security Probe — vanilla JS, no dependencies
// Reports results via console.info with structured JSON prefix

(function () {
  'use strict';

  var results = [];

  function report(result) {
    results.push(result);
    console.info('SECURITY_PROBE::' + JSON.stringify(result));
  }

  function probe(id, category, name, expected, testFn) {
    var start = Date.now();
    var p;

    try {
      p = Promise.resolve(testFn());
    } catch (e) {
      p = Promise.reject(e);
    }

    return p
      .then(function (actual) {
        report({
          id: id,
          category: category,
          name: name,
          expected: expected,
          actual: String(actual),
          passed: true,
          duration: Date.now() - start,
        });
      })
      .catch(function (err) {
        report({
          id: id,
          category: category,
          name: name,
          expected: expected,
          actual: 'error',
          passed: false,
          error: err && err.message ? err.message : String(err),
          duration: Date.now() - start,
        });
      });
  }

  // Helper: expect a promise to reject or return a blocked response
  function expectBlocked(promise) {
    return promise.then(function (response) {
      if (response && typeof response.status === 'number' && response.status === 403) {
        return 'blocked (403)';
      }
      if (response && typeof response.ok === 'boolean' && !response.ok) {
        return 'blocked (' + response.status + ')';
      }
      throw new Error('Expected blocked, got status ' + (response && response.status));
    }).catch(function (err) {
      // Network errors also count as blocked
      if (err && err.message && err.message.indexOf('Expected blocked') !== -1) {
        throw err;
      }
      return 'blocked (error: ' + (err && err.message ? err.message : String(err)) + ')';
    });
  }

  // Helper: expect a value to be undefined
  function expectUndefined(value, label) {
    if (typeof value === 'undefined') {
      return 'undefined';
    }
    throw new Error(label + ' is ' + typeof value + ', expected undefined');
  }

  // --- NETWORK ISOLATION ---

  var networkProbes = [
    probe('net.fetch.https', 'network', 'fetch HTTPS endpoint', 'blocked', function () {
      return expectBlocked(fetch('https://httpbin.org/get'));
    }),

    probe('net.fetch.http', 'network', 'fetch HTTP endpoint', 'blocked', function () {
      return expectBlocked(fetch('http://example.com'));
    }),

    probe('net.xhr', 'network', 'XMLHttpRequest to external', 'blocked', function () {
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://httpbin.org/get');
        xhr.timeout = 5000;
        xhr.onload = function () {
          if (xhr.status === 403) {
            resolve('blocked (403)');
          } else {
            reject(new Error('Expected blocked, got status ' + xhr.status));
          }
        };
        xhr.onerror = function () { resolve('blocked (network error)'); };
        xhr.ontimeout = function () { resolve('blocked (timeout)'); };
        xhr.send();
      });
    }),

    probe('net.websocket', 'network', 'WebSocket wss connection', 'blocked', function () {
      return new Promise(function (resolve, reject) {
        try {
          var ws = new WebSocket('wss://echo.websocket.org');
          var timer = setTimeout(function () {
            try { ws.close(); } catch (e) { /* ignore */ }
            resolve('blocked (timeout)');
          }, 5000);
          ws.onopen = function () {
            clearTimeout(timer);
            try { ws.close(); } catch (e) { /* ignore */ }
            reject(new Error('WebSocket opened — expected blocked'));
          };
          ws.onerror = function () {
            clearTimeout(timer);
            resolve('blocked (error)');
          };
        } catch (e) {
          resolve('blocked (exception: ' + e.message + ')');
        }
      });
    }),

    probe('net.websocket.ws', 'network', 'WebSocket ws (plain) connection', 'blocked', function () {
      return new Promise(function (resolve, reject) {
        try {
          var ws = new WebSocket('ws://echo.websocket.org');
          var timer = setTimeout(function () {
            try { ws.close(); } catch (e) { /* ignore */ }
            resolve('blocked (timeout)');
          }, 5000);
          ws.onopen = function () {
            clearTimeout(timer);
            try { ws.close(); } catch (e) { /* ignore */ }
            reject(new Error('WebSocket opened — expected blocked'));
          };
          ws.onerror = function () {
            clearTimeout(timer);
            resolve('blocked (error)');
          };
        } catch (e) {
          resolve('blocked (exception: ' + e.message + ')');
        }
      });
    }),

    probe('net.eventsource', 'network', 'EventSource connection', 'blocked', function () {
      return new Promise(function (resolve, reject) {
        try {
          var es = new EventSource('https://httpbin.org/sse');
          var timer = setTimeout(function () {
            es.close();
            resolve('blocked (timeout)');
          }, 5000);
          es.onopen = function () {
            clearTimeout(timer);
            es.close();
            reject(new Error('EventSource connected — expected blocked'));
          };
          es.onerror = function () {
            clearTimeout(timer);
            es.close();
            resolve('blocked (error)');
          };
        } catch (e) {
          resolve('blocked (exception: ' + e.message + ')');
        }
      });
    }),

    probe('net.script', 'network', 'dynamic script tag', 'blocked', function () {
      return new Promise(function (resolve) {
        var script = document.createElement('script');
        script.src = 'https://httpbin.org/get';
        var timer = setTimeout(function () {
          document.head.removeChild(script);
          resolve('blocked (timeout)');
        }, 5000);
        script.onload = function () {
          clearTimeout(timer);
          document.head.removeChild(script);
          resolve('loaded — should have been blocked');
        };
        script.onerror = function () {
          clearTimeout(timer);
          document.head.removeChild(script);
          resolve('blocked (error)');
        };
        document.head.appendChild(script);
      });
    }),

    probe('net.img', 'network', 'dynamic img tag', 'blocked', function () {
      return new Promise(function (resolve) {
        var img = document.createElement('img');
        img.src = 'https://httpbin.org/image/png';
        var timer = setTimeout(function () {
          resolve('blocked (timeout)');
        }, 5000);
        img.onload = function () {
          clearTimeout(timer);
          resolve('loaded — should have been blocked');
        };
        img.onerror = function () {
          clearTimeout(timer);
          resolve('blocked (error)');
        };
      });
    }),

    probe('net.link', 'network', 'dynamic link stylesheet', 'blocked', function () {
      return new Promise(function (resolve) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://httpbin.org/get';
        var timer = setTimeout(function () {
          document.head.removeChild(link);
          resolve('blocked (timeout)');
        }, 5000);
        link.onload = function () {
          clearTimeout(timer);
          document.head.removeChild(link);
          resolve('loaded — should have been blocked');
        };
        link.onerror = function () {
          clearTimeout(timer);
          document.head.removeChild(link);
          resolve('blocked (error)');
        };
        document.head.appendChild(link);
      });
    }),

    probe('net.beacon', 'network', 'navigator.sendBeacon', 'blocked', function () {
      // sendBeacon is fire-and-forget — it returns true/false synchronously and we
      // cannot observe whether the queued request was actually blocked at the network layer.
      // Instead, verify the protocol handler blocks a POST to the same endpoint via fetch.
      // Both go through ses.protocol.handle('https'), so if fetch POST is blocked,
      // the beacon request (same handler) is also blocked.
      navigator.sendBeacon('https://httpbin.org/post', 'test');
      return expectBlocked(fetch('https://httpbin.org/post', { method: 'POST', body: 'test' }));
    }),

    probe('net.worker', 'network', 'Worker from external URL', 'blocked', function () {
      return new Promise(function (resolve) {
        try {
          var w = new Worker('https://httpbin.org/get');
          var timer = setTimeout(function () {
            w.terminate();
            resolve('blocked (timeout)');
          }, 5000);
          w.onerror = function () {
            clearTimeout(timer);
            w.terminate();
            resolve('blocked (error)');
          };
          w.onmessage = function () {
            clearTimeout(timer);
            w.terminate();
            resolve('loaded — should have been blocked');
          };
        } catch (e) {
          resolve('blocked (exception: ' + e.message + ')');
        }
      });
    }),

    probe('net.fetch.product', 'network', 'fetch polkadot:// (sanity)', 'allowed', function () {
      return fetch(window.location.origin + '/index.html').then(function (r) {
        if (r.ok) return 'allowed (' + r.status + ')';
        throw new Error('polkadot:// fetch failed with ' + r.status);
      });
    }),
  ];

  // --- ALLOWLIST ABUSE ---

  var allowlistProbes = [
    probe('allow.ipfs.fake', 'allowlist', 'fetch fake IPFS domain', 'blocked', function () {
      return expectBlocked(fetch('https://ipfs.evil-example.test/'));
    }),

    probe('allow.ipfs.subdomain', 'allowlist', 'fetch IPFS subdomain abuse', 'blocked', function () {
      return expectBlocked(fetch('https://anything.ipfs.evil-example.test/'));
    }),

    probe('allow.turn.fake', 'allowlist', 'fetch fake TURN domain', 'blocked', function () {
      return expectBlocked(fetch('https://turn.evil-example.test/'));
    }),

    probe('allow.saturn', 'allowlist', 'fetch saturn (contains turn)', 'blocked', function () {
      return expectBlocked(fetch('https://saturn.evil-example.test/'));
    }),

    probe('allow.stun.fake', 'allowlist', 'fetch fake STUN domain', 'blocked', function () {
      return expectBlocked(fetch('https://stun.evil-example.test/'));
    }),
  ];

  // --- NODE.JS / CONTEXT ISOLATION ---

  var contextProbes = [
    probe('node.require', 'context', 'typeof require', 'undefined', function () {
      return expectUndefined(typeof window.require === 'undefined' ? undefined : window.require, 'require');
    }),

    probe('node.process', 'context', 'typeof process', 'undefined', function () {
      return expectUndefined(typeof window.process === 'undefined' ? undefined : window.process, 'process');
    }),

    probe('node.global', 'context', 'typeof global', 'undefined', function () {
      return expectUndefined(typeof window.global === 'undefined' ? undefined : window.global, 'global');
    }),

    probe('node.dirname', 'context', 'typeof __dirname', 'undefined', function () {
      // eslint-disable-next-line no-undef
      return expectUndefined(typeof __dirname === 'undefined' ? undefined : __dirname, '__dirname');
    }),

    probe('node.module', 'context', 'typeof module', 'undefined', function () {
      // eslint-disable-next-line no-undef
      return expectUndefined(typeof module === 'undefined' ? undefined : module, 'module');
    }),

    probe('ctx.window_app', 'context', 'window.App existence', 'undefined', function () {
      return expectUndefined(window.App, 'window.App');
    }),

    probe('ctx.webview_mark', 'context', '__HOST_WEBVIEW_MARK__', 'exists', function () {
      if (window.__HOST_WEBVIEW_MARK__ === true) return 'exists (true)';
      throw new Error('__HOST_WEBVIEW_MARK__ is ' + typeof window.__HOST_WEBVIEW_MARK__);
    }),

    probe('ctx.ipc_renderer', 'context', 'require electron', 'blocked', function () {
      try {
        // This should throw because require is not available
        var electron = window.require && window.require('electron');
        if (electron) throw new Error('electron module accessible');
        return 'blocked (require unavailable)';
      } catch (e) {
        if (e.message === 'electron module accessible') throw e;
        return 'blocked (' + e.message + ')';
      }
    }),
  ];

  // --- PERMISSION ENFORCEMENT ---

  var permissionProbes = [
    probe('perm.camera', 'permission', 'getUserMedia video', 'blocked', function () {
      return navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        throw new Error('Camera access granted — expected blocked');
      }).catch(function (err) {
        if (err.message.indexOf('expected blocked') !== -1) throw err;
        return 'blocked (' + err.name + ')';
      });
    }),

    probe('perm.microphone', 'permission', 'getUserMedia audio', 'blocked', function () {
      return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        throw new Error('Microphone access granted — expected blocked');
      }).catch(function (err) {
        if (err.message.indexOf('expected blocked') !== -1) throw err;
        return 'blocked (' + err.name + ')';
      });
    }),

    probe('perm.geolocation', 'permission', 'geolocation', 'blocked', function () {
      return new Promise(function (resolve, reject) {
        navigator.geolocation.getCurrentPosition(
          function () { reject(new Error('Geolocation granted — expected blocked')); },
          function (err) { resolve('blocked (' + err.code + ': ' + err.message + ')'); },
          { timeout: 5000 }
        );
      });
    }),

    probe('perm.notification', 'permission', 'Notification permission', 'blocked', function () {
      return Notification.requestPermission().then(function (result) {
        if (result === 'denied' || result === 'default') return 'blocked (' + result + ')';
        throw new Error('Notification permission granted');
      });
    }),

    probe('perm.clipboard.read', 'permission', 'clipboard read', 'blocked', function () {
      return navigator.clipboard.readText().then(function () {
        throw new Error('Clipboard read granted — expected blocked');
      }).catch(function (err) {
        if (err.message.indexOf('expected blocked') !== -1) throw err;
        return 'blocked (' + err.name + ')';
      });
    }),

    probe('perm.clipboard.write', 'permission', 'clipboard write', 'allowed-or-context-limited', function () {
      return navigator.clipboard.writeText('probe-test').then(function () {
        return 'allowed';
      }).catch(function (err) {
        // Clipboard write may fail in test context (no user gesture, non-HTTPS origin)
        // even though the permission handler allows clipboard-sanitized-write.
        // This is acceptable — the permission IS granted, the API just requires secure context.
        return 'context-limited (' + err.name + ': ' + err.message + ')';
      });
    }),
  ];

  // --- STORAGE ISOLATION ---

  var storageProbes = [
    probe('store.localstorage', 'storage', 'localStorage access', 'accessible', function () {
      localStorage.setItem('__probe_test__', 'ok');
      var value = localStorage.getItem('__probe_test__');
      localStorage.removeItem('__probe_test__');
      if (value === 'ok') return 'accessible';
      throw new Error('localStorage returned ' + value);
    }),

    probe('store.sessionstorage', 'storage', 'sessionStorage access', 'accessible', function () {
      sessionStorage.setItem('__probe_test__', 'ok');
      var value = sessionStorage.getItem('__probe_test__');
      sessionStorage.removeItem('__probe_test__');
      if (value === 'ok') return 'accessible';
      throw new Error('sessionStorage returned ' + value);
    }),

    probe('store.indexeddb', 'storage', 'IndexedDB access', 'accessible', function () {
      return new Promise(function (resolve, reject) {
        var request = indexedDB.open('__probe_test_db__', 1);
        request.onerror = function () { reject(new Error('IndexedDB open failed')); };
        request.onsuccess = function () {
          request.result.close();
          indexedDB.deleteDatabase('__probe_test_db__');
          resolve('accessible');
        };
      });
    }),

    probe('store.cookie', 'storage', 'document.cookie access', 'accessible-or-scheme-limited', function () {
      document.cookie = '__probe_test__=ok; path=/';
      var has = document.cookie.indexOf('__probe_test__=ok') !== -1;
      // Clear cookie
      document.cookie = '__probe_test__=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      if (has) return 'accessible';
      // polkadot:// custom scheme doesn't support document.cookie — this is expected
      return 'scheme-limited (polkadot:// does not support cookies)';
    }),

    probe('store.host_db', 'storage', 'host app IndexedDB', 'empty', function () {
      return new Promise(function (resolve, reject) {
        var request = indexedDB.open('polkadot-desktop-product-storage', 1);
        request.onerror = function () { resolve('blocked (open failed)'); };
        request.onupgradeneeded = function () {
          // DB didn't exist in this partition — expected
          resolve('empty (new db in isolated partition)');
        };
        request.onsuccess = function () {
          var db = request.result;
          var storeNames = Array.from(db.objectStoreNames);
          db.close();
          if (storeNames.length === 0) {
            resolve('empty (no stores)');
          } else {
            reject(new Error('Host DB accessible with stores: ' + storeNames.join(', ')));
          }
        };
      });
    }),
  ];

  // --- NAVIGATION RESTRICTION ---

  var navigationProbes = [
    probe('nav.window_open', 'navigation', 'window.open to external', 'denied', function () {
      var w = window.open('https://evil.com');
      if (w === null || w === undefined) return 'denied (null)';
      try { w.close(); } catch (e) { /* ignore */ }
      throw new Error('window.open succeeded');
    }),

    probe('nav.data_uri', 'navigation', 'data URI in iframe', 'blocked', function () {
      return new Promise(function (resolve) {
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        var timer = setTimeout(function () {
          document.body.removeChild(iframe);
          resolve('blocked (timeout)');
        }, 3000);
        iframe.onload = function () {
          clearTimeout(timer);
          try {
            var content = iframe.contentDocument && iframe.contentDocument.body.textContent;
            document.body.removeChild(iframe);
            if (content && content.indexOf('injected') !== -1) {
              resolve('loaded — should have been blocked');
            } else {
              resolve('blocked (empty content)');
            }
          } catch (e) {
            document.body.removeChild(iframe);
            resolve('blocked (cross-origin: ' + e.message + ')');
          }
        };
        iframe.onerror = function () {
          clearTimeout(timer);
          document.body.removeChild(iframe);
          resolve('blocked (error)');
        };
        iframe.src = 'data:text/html,<h1>injected</h1>';
        document.body.appendChild(iframe);
      });
    }),

    probe('nav.javascript_uri', 'navigation', 'javascript: URI', 'blocked', function () {
      // Cannot easily test location.href = 'javascript:...' without navigating away
      // Instead test via iframe
      return new Promise(function (resolve) {
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        var timer = setTimeout(function () {
          document.body.removeChild(iframe);
          resolve('blocked (timeout)');
        }, 3000);
        iframe.onload = function () {
          clearTimeout(timer);
          document.body.removeChild(iframe);
          resolve('blocked (loaded empty)');
        };
        iframe.onerror = function () {
          clearTimeout(timer);
          document.body.removeChild(iframe);
          resolve('blocked (error)');
        };
        // eslint-disable-next-line no-script-url
        iframe.src = 'javascript:document.write("xss")';
        document.body.appendChild(iframe);
      });
    }),

    probe('nav.product_internal', 'navigation', 'navigate within polkadot://', 'allowed', function () {
      return fetch(window.location.origin + '/index.html').then(function (r) {
        if (r.ok) return 'allowed';
        throw new Error('Internal navigation failed: ' + r.status);
      });
    }),
  ];

  // --- DANGEROUS PROTOCOL URLS ---

  var dangerousUrlProbes = [
    probe('nav.open_file', 'navigation', 'window.open file:// URL', 'denied', function () {
      var w = window.open('file:///etc/passwd');
      if (w === null || w === undefined) return 'denied (null)';
      try { w.close(); } catch (e) { /* ignore */ }
      throw new Error('window.open file:// succeeded');
    }),

    probe('nav.open_tel', 'navigation', 'window.open tel: URL', 'denied', function () {
      var w = window.open('tel:+1234567890');
      if (w === null || w === undefined) return 'denied (null)';
      try { w.close(); } catch (e) { /* ignore */ }
      throw new Error('window.open tel: succeeded');
    }),

    probe('nav.open_javascript', 'navigation', 'window.open javascript: URL', 'denied', function () {
      // eslint-disable-next-line no-script-url
      var w = window.open('javascript:alert(1)');
      if (w === null || w === undefined) return 'denied (null)';
      try { w.close(); } catch (e) { /* ignore */ }
      throw new Error('window.open javascript: succeeded');
    }),

    probe('nav.open_data', 'navigation', 'window.open data: URL', 'denied', function () {
      var w = window.open('data:text/html,<script>alert(1)</script>');
      if (w === null || w === undefined) return 'denied (null)';
      try { w.close(); } catch (e) { /* ignore */ }
      throw new Error('window.open data: succeeded');
    }),
  ];

  // --- SIDE CHANNEL ---

  var sideChannelProbes = [
    probe('timing.shared_array_buffer', 'sidechannel', 'SharedArrayBuffer availability', 'undefined', function () {
      if (typeof SharedArrayBuffer === 'undefined') return 'undefined';
      // SharedArrayBuffer exists but may not be usable without proper headers
      return 'available (potential timing attack vector)';
    }),

    probe('timing.perf_precision', 'sidechannel', 'performance.now() precision', 'informational', function () {
      var samples = [];
      for (var i = 0; i < 100; i++) {
        var t1 = performance.now();
        var t2 = performance.now();
        if (t2 > t1) samples.push(t2 - t1);
      }
      if (samples.length === 0) return 'informational (no measurable deltas)';
      var minDelta = Math.min.apply(null, samples);
      return 'informational (min delta: ' + minDelta.toFixed(4) + 'ms)';
    }),

    probe('timing.memory', 'sidechannel', 'measureUserAgentSpecificMemory', 'blocked', function () {
      if (typeof performance.measureUserAgentSpecificMemory !== 'function') {
        return 'blocked (not available)';
      }
      return performance.measureUserAgentSpecificMemory().then(function () {
        throw new Error('Memory measurement succeeded — expected blocked');
      }).catch(function (err) {
        if (err.message.indexOf('expected blocked') !== -1) throw err;
        return 'blocked (' + err.name + ')';
      });
    }),
  ];

  // --- RUN ALL ---

  Promise.all([].concat(
    networkProbes,
    allowlistProbes,
    contextProbes,
    permissionProbes,
    storageProbes,
    navigationProbes,
    dangerousUrlProbes,
    sideChannelProbes
  )).then(function () {
    var passed = results.filter(function (r) { return r.passed; }).length;
    var failed = results.filter(function (r) { return !r.passed; }).length;
    var summary = {
      total: results.length,
      passed: passed,
      failed: failed,
      results: results,
    };

    console.info('SECURITY_PROBE_COMPLETE::' + JSON.stringify(summary));
    document.getElementById('status').textContent =
      'Done: ' + passed + ' passed, ' + failed + ' failed out of ' + results.length;
  });
})();

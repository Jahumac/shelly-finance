/* app.js — Core client-side logic for Shelly Finance */

(function() {
  /* ── CSRF Protection ─────────────────────────────────────────────── */
  var csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

  /* Inject CSRF into a single form element if it's missing */
  function ensureCsrf(form) {
    if (form.method && form.method.toUpperCase() === 'POST') {
      if (!form.querySelector('input[name="csrf_token"]')) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'csrf_token';
        input.value = csrfToken;
        form.insertBefore(input, form.firstChild);
      }
    }
  }

  /* Scan and inject into all current POST forms on the page */
  function injectAll() {
    document.querySelectorAll('form').forEach(ensureCsrf);
  }

  /* Run immediately (covers all static forms in the HTML) */
  document.addEventListener('DOMContentLoaded', injectAll);

  /* Also catch any forms injected dynamically by JavaScript */
  if (window.MutationObserver) {
    new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'FORM') { ensureCsrf(node); return; }
          if (node.querySelectorAll) {
            node.querySelectorAll('form').forEach(ensureCsrf);
          }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ── Tag Management ─────────────────────────────────────────────── */
  (function initTagManagement() {
    function handleDeleteTag(e) {
      e.preventDefault();
      e.stopPropagation();
      var btn = e.currentTarget;
      var tagName = btn.getAttribute('data-delete-tag');
      if (!tagName) return;

      shellyConfirm({
        title: 'Remove "' + tagName + '"?',
        message: 'This removes the tag from the list. Accounts already tagged with it keep their tag — you can remove it manually.',
        confirmText: 'Yes, remove tag',
        cancelText: 'Keep it',
      }).then(function (confirmed) {
        if (!confirmed) return;
        var fd = new FormData();
        fd.append('tag', tagName);
        var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        fetch('/accounts/api/tags/delete', { method: 'POST', body: fd, headers: { 'X-CSRFToken': csrf } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) { alert(data.error || 'Cannot delete this tag'); return; }
            document.querySelectorAll('[data-delete-tag="' + tagName + '"]').forEach(function (el) {
              var chip = el.closest('.tag-chip');
              if (chip) chip.remove();
            });
          });
      });
    }

    document.addEventListener('DOMContentLoaded', function() {
      document.querySelectorAll('.tag-delete').forEach(function (btn) {
        btn.addEventListener('click', handleDeleteTag);
      });

      var addBtn = document.querySelector('[data-add-tag-btn]');
      if (addBtn) {
        var tagInput = addBtn.closest('.tag-add-row').querySelector('[data-new-tag-input]');
        addBtn.addEventListener('click', function () {
          var tagName = (tagInput.value || '').trim();
          if (!tagName) return;
          var fd = new FormData();
          fd.append('tag', tagName);
          var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
          fetch('/accounts/api/tags/add', { method: 'POST', body: fd, headers: { 'X-CSRFToken': csrf } })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (!data.ok) { alert(data.error || 'Cannot add this tag'); return; }
              window.location.reload();
            });
        });
      }
    });
  })();

  /* Belt-and-suspenders: also catch on submit in case a form was missed */
  document.addEventListener('submit', function(e) { ensureCsrf(e.target); });

  /* Add CSRF token to all AJAX fetch POST requests */
  var originalFetch = window.fetch;
  window.fetch = function() {
    var args = Array.prototype.slice.call(arguments);
    if (args.length > 1 && args[1] && args[1].method && args[1].method.toUpperCase() === 'POST') {
      args[1].headers = args[1].headers || {};
      if (args[1].headers instanceof Headers) {
        args[1].headers.set('X-CSRFToken', csrfToken);
      } else {
        args[1].headers['X-CSRFToken'] = csrfToken;
      }
    }
    return originalFetch.apply(this, args);
  };

  /* ── Shelly confirm — replaces browser confirm() ─────────────────── */
  var overlay = document.getElementById('shelly-confirm');
  var titleEl = document.getElementById('shelly-confirm-title');
  var msgEl   = document.getElementById('shelly-confirm-msg');
  var okBtn   = document.getElementById('shelly-confirm-ok');
  var cancelBtn = document.getElementById('shelly-confirm-cancel');
  var pendingResolve = null;

  window.shellyConfirm = function (opts) {
    opts = opts || {};
    titleEl.textContent = opts.title || 'Are you sure?';
    msgEl.textContent   = opts.message || '';
    okBtn.textContent   = opts.confirmText || 'Yes, do it';
    cancelBtn.textContent = opts.cancelText || 'Nope, go back';
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    okBtn.focus();

    return new Promise(function (resolve) {
      pendingResolve = resolve;
    });
  };

  function closeConfirm(result) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    if (pendingResolve) {
      pendingResolve(result);
      pendingResolve = null;
    }
  }

  if (okBtn) okBtn.addEventListener('click', function () { closeConfirm(true); });
  if (cancelBtn) cancelBtn.addEventListener('click', function () { closeConfirm(false); });
  if (overlay) overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeConfirm(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) closeConfirm(false);
  });

  /* ── Wire up all [data-confirm] elements ─────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-confirm]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        shellyConfirm({
          title: el.getAttribute('data-confirm-title') || 'Hang on a sec…',
          message: el.getAttribute('data-confirm'),
          confirmText: el.getAttribute('data-confirm-ok') || 'Yes, do it',
          cancelText: el.getAttribute('data-confirm-cancel') || 'Nope, go back',
        }).then(function (confirmed) {
          if (!confirmed) return;
          var form = el.closest('form');
          if (form && (el.tagName === 'BUTTON' || el.type === 'submit')) {
            form.submit();
          } else if (el.href) {
            window.location.href = el.href;
          }
        });
      });
    });
  });

  /* ── Tag sync helper ─────────────────────────────────────────────── */
  window.syncTagsInForm = function(form) {
    var tagHiddenInput = form.querySelector('[data-tags-hidden-input]');
    if (!tagHiddenInput) return;
    var checked = Array.from(form.querySelectorAll('[data-tag-checkbox]:checked')).map(function(el) {
      return el.value;
    });
    tagHiddenInput.value = checked.join(', ');
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form').forEach(function (form) {
      var tagHiddenInput = form.querySelector('[data-tags-hidden-input]');
      if (tagHiddenInput) {
        form.querySelectorAll('[data-tag-checkbox]').forEach(function (checkbox) {
          checkbox.addEventListener('change', function() { syncTagsInForm(form); });
          checkbox.addEventListener('click', function() {
            setTimeout(function() { syncTagsInForm(form); }, 0);
          });
        });
        form.querySelectorAll('.tag-chip').forEach(function(chip) {
          chip.addEventListener('click', function() {
            setTimeout(function() { syncTagsInForm(form); }, 0);
          });
        });
        syncTagsInForm(form);
      }
    });

    document.querySelectorAll('[data-valuation-mode]').forEach(function (select) {
      var form = select.closest('form');
      if (!form) return;
      var manualFields = form.querySelector('[data-manual-fields]');
      var positionsPanel = form.querySelector('[data-positions-panel]');
      var positionFormPanel = form.querySelector('[data-position-form-panel]');
      var hintManual = select.closest('label') && select.closest('label').querySelector('[data-hint-manual]');
      var hintHoldings = select.closest('label') && select.closest('label').querySelector('[data-hint-holdings]');

      function syncValuationMode() {
        var isHoldings = select.value === 'holdings';
        if (manualFields) {
          manualFields.hidden = isHoldings;
          manualFields.style.display = isHoldings ? 'none' : 'contents';
        }
        if (positionsPanel) {
          positionsPanel.hidden = !isHoldings;
          positionsPanel.style.display = isHoldings ? 'block' : 'none';
        }
        if (positionFormPanel) {
          positionFormPanel.hidden = !isHoldings;
          positionFormPanel.style.display = isHoldings ? 'block' : 'none';
        }
        if (hintManual)   hintManual.style.display   = isHoldings ? 'none' : '';
        if (hintHoldings) hintHoldings.style.display = isHoldings ? '' : 'none';
      }

      select.addEventListener('change', syncValuationMode);
      syncValuationMode();
    });

    var PROVIDER_DEFAULTS = {
      'nest':                    { wrapper: 'Workplace Pension', category: 'Pension' },
      "the people's pension":    { wrapper: 'Workplace Pension', category: 'Pension' },
      'now: pensions':           { wrapper: 'Workplace Pension', category: 'Pension' },
      'smart pension':           { wrapper: 'Workplace Pension', category: 'Pension' },
      'cushon':                  { wrapper: 'Workplace Pension', category: 'Pension' },
      'salary finance':          { wrapper: 'Workplace Pension', category: 'Pension' },
      'standard life':           { wrapper: 'Workplace Pension', category: 'Pension' },
      'aviva':                   { wrapper: 'Workplace Pension', category: 'Pension' },
      'legal & general':         { wrapper: 'Workplace Pension', category: 'Pension' },
      'scottish widows':         { wrapper: 'Workplace Pension', category: 'Pension' },
      'royal london':            { wrapper: 'Workplace Pension', category: 'Pension' },
      'aegon':                   { wrapper: 'Workplace Pension', category: 'Pension' },
      'zurich':                  { wrapper: 'Workplace Pension', category: 'Pension' },
      'aon':                     { wrapper: 'Workplace Pension', category: 'Pension' },
      'mercer':                  { wrapper: 'Workplace Pension', category: 'Pension' },
      'willis towers watson':    { wrapper: 'Workplace Pension', category: 'Pension' },
      'pensionbee':              { wrapper: 'SIPP', category: 'Pension' },
      'investengine':            { wrapper: 'Stocks & Shares ISA', category: 'ISA' },
      'freetrade':               { wrapper: 'Stocks & Shares ISA', category: 'ISA' },
      'trading 212':             { wrapper: 'Stocks & Shares ISA', category: 'ISA' },
      'nutmeg':                  { wrapper: 'Stocks & Shares ISA', category: 'ISA' },
      'wealthify':               { wrapper: 'Stocks & Shares ISA', category: 'ISA' },
      'moneyfarm':               { wrapper: 'Stocks & Shares ISA', category: 'ISA' },
      'wealthsimple':            { wrapper: 'Stocks & Shares ISA', category: 'ISA' },
      'moneybox':                { wrapper: 'Lifetime ISA', category: 'ISA' },
      "ns&i":                    { wrapper: 'Other', category: 'Other' },
      'marcus by goldman sachs': { wrapper: 'Other', category: 'Other' },
      'chip':                    { wrapper: 'Other', category: 'Other' },
      'plum':                    { wrapper: 'Other', category: 'Other' },
    };

    document.querySelectorAll('input[list="provider-list"]').forEach(function (input) {
      var form = input.closest('form');
      if (!form) return;
      input.addEventListener('change', function () {
        var key = input.value.trim().toLowerCase();
        var defaults = PROVIDER_DEFAULTS[key];
        if (!defaults) return;
        var wrapperSel = form.querySelector('select[name="wrapper_type"]');
        var categorySel = form.querySelector('select[name="category"]');
        if (wrapperSel) {
          var opt = Array.from(wrapperSel.options).find(function(o) { return o.value === defaults.wrapper; });
          if (opt) wrapperSel.value = defaults.wrapper;
        }
        if (categorySel) {
          var opt2 = Array.from(categorySel.options).find(function(o) { return o.value === defaults.category; });
          if (opt2) categorySel.value = defaults.category;
        }
      });
    });

    document.querySelectorAll('[data-growth-mode]').forEach(function (select) {
      var form = select.closest('form');
      if (!form) return;
      var customRateField = form.querySelector('[data-custom-rate-field]');
      var hintDefault = select.closest('label') && select.closest('label').querySelector('[data-hint-growth-default]');
      var hintCustom  = select.closest('label') && select.closest('label').querySelector('[data-hint-growth-custom]');

      function syncGrowthMode() {
        var isCustom = select.value === 'custom';
        if (customRateField) customRateField.style.display = isCustom ? '' : 'none';
        if (hintDefault) hintDefault.style.display = isCustom ? 'none' : '';
        if (hintCustom)  hintCustom.style.display  = isCustom ? '' : 'none';
      }

      select.addEventListener('change', syncGrowthMode);
      syncGrowthMode();
    });

    document.querySelectorAll('tr[data-href]').forEach(function (row) {
      row.addEventListener('click', function () {
        window.location.href = row.dataset.href;
      });
    });

    var focusPanel = document.querySelector('[data-focus-panel]');
    if (focusPanel) {
      requestAnimationFrame(function () {
        focusPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    /* ── Projections What-If Logic ──────────────────────────────────── */
    (function initWhatIf() {
      var ageInput = document.getElementById('wi_age');
      if (!ageInput) return;

      var BASE_CURRENT_AGE = parseFloat(ageInput.dataset.currentAgeFrac);
      var BASE_RETIREMENT_AGE = parseInt(ageInput.dataset.baseRetirementAge);
      var BASE_YEARS_REMAINING = parseFloat(ageInput.dataset.baseYearsRemaining);
      var BASE_MONTHS_REMAINING = parseInt(ageInput.dataset.baseMonthsRemaining);
      var DEFAULT_RATE_PCT = parseFloat(ageInput.dataset.defaultRatePct);

      function fv(current, monthly, annualRate, years, months) {
        var r = annualRate / 12;
        var n = (typeof months === 'number') ? months : Math.floor(years * 12);
        var fc = current * Math.pow(1 + r, n);
        var fm = r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
        return fc + fm;
      }

      function projectAccount(current, monthly, annualRate, retAge, isLISA) {
        var onPlan = (retAge === BASE_RETIREMENT_AGE);
        var years  = onPlan ? BASE_YEARS_REMAINING : Math.max(retAge - BASE_CURRENT_AGE, 0);
        var months = onPlan ? BASE_MONTHS_REMAINING : undefined;
        if (isLISA) {
          var contribEndAge = Math.min(50, retAge);
          var contribYears  = Math.max(contribEndAge - BASE_CURRENT_AGE, 0);
          var frozenYears   = Math.max(years - contribYears, 0);
          var valAtEnd = fv(current, monthly, annualRate, contribYears);
          return fv(valAtEnd, 0, annualRate, frozenYears);
        }
        return fv(current, monthly, annualRate, years, months);
      }

      function fmt(v) {
        return '£' + Math.round(v).toLocaleString('en-GB');
      }

      var inputs  = Array.from(document.querySelectorAll('.wi-contrib-input'));
      var labels  = Array.from(document.querySelectorAll('[data-projected-label]'));
      var rateInput = document.getElementById('wi_rate');

      function recalc() {
        var retAge      = parseFloat(ageInput.value)  || BASE_RETIREMENT_AGE;
        var globalPct   = parseFloat(rateInput.value) || 0;
        var years       = (retAge === BASE_RETIREMENT_AGE)
          ? BASE_YEARS_REMAINING
          : Math.max(retAge - BASE_CURRENT_AGE, 0);
        var rateChanged = Math.abs(globalPct - DEFAULT_RATE_PCT) > 0.0001;

        var scenarioTotal = 0;
        var planTotal     = 0;
        var totalMonthly  = 0;

        inputs.forEach(function(inp, i) {
          var current     = parseFloat(inp.dataset.current) || 0;
          var personal    = parseFloat(inp.value) || 0;
          var planPersonal= parseFloat(inp.dataset.plan) || 0;
          var planEffective = parseFloat(inp.dataset.effective) || planPersonal;
          var acctRate    = parseFloat(inp.dataset.rate) || 0;
          var isLISA      = inp.dataset.wrapper === 'Lifetime ISA';

          var ratio = planPersonal > 0 ? (planEffective / planPersonal) : 1;
          var monthly = personal * ratio;
          var useRate = rateChanged ? (globalPct / 100) : acctRate;

          var proj = projectAccount(current, monthly, useRate, retAge, isLISA);
          var plan = projectAccount(current, planEffective, acctRate, BASE_RETIREMENT_AGE, isLISA);

          scenarioTotal += proj;
          planTotal     += plan;
          totalMonthly  += personal;

          if (labels[i]) labels[i].textContent = fmt(proj);
        });

        var diff    = scenarioTotal - planTotal;
        var diffEl  = document.getElementById('wi_diff');
        if (diffEl) {
          diffEl.textContent = (diff >= 0 ? '+' : '') + fmt(diff);
          diffEl.className   = diff >= 0 ? 'whatif-positive' : 'whatif-negative';
        }

        var totalEl = document.getElementById('wi_total');
        if (totalEl) totalEl.textContent = fmt(scenarioTotal);
        var yearsEl = document.getElementById('wi_years');
        if (yearsEl) yearsEl.textContent = Math.round(years) + ' years';
        var monthlyEl = document.getElementById('wi_monthly');
        if (monthlyEl) monthlyEl.textContent = fmt(totalMonthly) + '/mo';
      }

      ageInput.addEventListener('input', recalc);
      rateInput.addEventListener('input', recalc);
      inputs.forEach(function(inp) { inp.addEventListener('input', recalc); });

      var resetBtn = document.getElementById('wi_reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', function() {
          ageInput.value  = BASE_RETIREMENT_AGE;
          rateInput.value = DEFAULT_RATE_PCT;
          inputs.forEach(function(inp) { inp.value = inp.dataset.plan; });
          recalc();
        });
      }
      recalc();
    })();

    /* ── Instrument Search / Lookup Logic ────────────────────────────── */
    (function initHoldingsLookup() {
      var input = document.getElementById('instrument-search-input');
      var btn   = document.getElementById('instrument-search-btn');
      var resultBox = document.getElementById('instrument-search-result');
      if (!input || !btn || !resultBox) return;

      function fmtPrice(price, currency, change_pct) {
        var priceStr = currency === 'GBp' ? price.toFixed(2) + 'p' : '£' + price.toFixed(4);
        var changeStr = '';
        if (change_pct !== null && change_pct !== undefined) {
          var cls = change_pct >= 0 ? 'perf-positive' : 'perf-negative';
          changeStr = ' <span class="' + cls + '" style="font-size:0.8rem;">' + (change_pct >= 0 ? '+' : '') + change_pct.toFixed(2) + '%</span>';
        }
        return priceStr + changeStr;
      }

      async function doSearch() {
        var q = input.value.trim();
        if (!q) return;
        btn.textContent = '…';
        btn.disabled = true;
        resultBox.style.display = 'none';
        resultBox.innerHTML = '';

        try {
          var resp = await fetch('/holdings/api/lookup?q=' + encodeURIComponent(q));
          var data = await resp.json();
          if (!resp.ok) {
            resultBox.innerHTML = '<p style="color:#fca5a5;font-size:0.875rem;">⚠ ' + (data.error || 'Not found') + '</p>';
            resultBox.style.display = 'block';
            return;
          }

          var inCat = data.in_catalogue;
          var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
          var addToCatBtn = inCat ? '' :
            '<form method="post" style="margin:0;">' +
              '<input type="hidden" name="csrf_token" value="' + csrf + '">' +
              '<input type="hidden" name="form_name" value="catalogue">' +
              '<input type="hidden" name="catalogue_holding_name" value="' + data.name.replace(/"/g,'&quot;') + '">' +
              '<input type="hidden" name="catalogue_ticker" value="' + data.ticker + '">' +
              '<input type="hidden" name="catalogue_asset_type" value="' + data.asset_type + '">' +
              '<input type="hidden" name="catalogue_bucket" value="Global Equity">' +
              '<input type="hidden" name="catalogue_notes" value="">' +
              '<button type="submit" class="badge badge-meta">+ Save to instruments</button>' +
            '</form>';

          var addAction = data.catalogue_id ? '/holdings/' + data.catalogue_id + '/add-to-account' : '/holdings/search/add-to-account';
          var acctOptions = resultBox.dataset.accounts || '';

          var addToAcctForm =
            '<form method="post" action="' + addAction + '" style="display:flex;align-items:flex-end;gap:0.6rem;flex-wrap:wrap;margin-top:0.75rem;">' +
              '<input type="hidden" name="csrf_token" value="' + csrf + '">' +
              '<input type="hidden" name="ticker" value="' + data.ticker + '">' +
              '<input type="hidden" name="name" value="' + data.name.replace(/"/g,'&quot;') + '">' +
              '<input type="hidden" name="asset_type" value="' + data.asset_type + '">' +
              '<input type="hidden" name="price" value="' + data.price_gbp + '">' +
              '<label style="display:flex;flex-direction:column;gap:0.2rem;">' +
                '<span style="font-size:0.72rem;color:var(--muted);text-transform:uppercase;">Account</span>' +
                '<select name="account_id" required style="background:var(--panel-2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:0.35rem 0.6rem;font-size:0.875rem;">' +
                  acctOptions +
                '</select>' +
              '</label>' +
              '<label style="display:flex;flex-direction:column;gap:0.2rem;">' +
                '<span style="font-size:0.72rem;color:var(--muted);text-transform:uppercase;">Units</span>' +
                '<input type="number" name="units" step="any" placeholder="e.g. 42.5" required style="width:8rem;background:var(--panel-2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:0.35rem 0.6rem;font-size:0.875rem;">' +
              '</label>' +
              '<button type="submit" class="badge badge-primary-action">Add to account</button>' +
            '</form>';

          resultBox.innerHTML =
            '<div class="instrument-result-card">' +
              '<strong>' + data.name + '</strong> <span class="holding-ticker">' + data.ticker + '</span>' +
              '<p>' + fmtPrice(data.price, data.currency, data.change_pct) + '</p>' +
              (inCat ? '<p style="color:#86efac;font-size:0.875rem;">✓ Already in instruments</p>' : '') +
              (addToCatBtn ? '<div class="badge-row">' + addToCatBtn + '</div>' : '') +
              addToAcctForm +
            '</div>';
          resultBox.style.display = 'block';
        } catch(e) {
          resultBox.innerHTML = '<p style="color:#fca5a5;font-size:0.875rem;">⚠ Request failed.</p>';
          resultBox.style.display = 'block';
        } finally {
          btn.textContent = 'Look up';
          btn.disabled = false;
        }
      }

      btn.addEventListener('click', doSearch);
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter') doSearch(); });
    })();
  });

  /* ── Online/Offline status ───────────────────────────────────────── */
  (function () {
    var banner = document.getElementById('offline-banner');
    var toast  = document.getElementById('online-toast');
    if (!banner) return;
    var wasOffline = false;
    var lastPingOk = true;
    var toastTimer = null;

    function showOffline() {
      document.body.classList.remove('is-back-online');
      document.body.classList.add('is-offline');
      banner.classList.remove('hidden');
      if (toast) toast.classList.add('hidden');
    }

    function showOnline() {
      document.body.classList.remove('is-offline');
      banner.classList.add('hidden');
      if (wasOffline && toast) {
        document.body.classList.add('is-back-online');
        toast.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
          toast.classList.add('hidden');
          document.body.classList.remove('is-back-online');
        }, 3000);
      }
      wasOffline = false;
    }

    function checkServer() {
      if (!navigator.onLine) {
        wasOffline = true;
        lastPingOk = false;
        showOffline();
        return;
      }
      fetch('/api/ping', { cache: 'no-store' })
        .then(function (r) {
          lastPingOk = !!(r && r.ok);
          if (lastPingOk) showOnline();
          else { wasOffline = true; showOffline(); }
        })
        .catch(function () {
          wasOffline = true;
          lastPingOk = false;
          showOffline();
        });
    }

    checkServer();
    window.addEventListener('online',  checkServer);
    window.addEventListener('offline', checkServer);
    window.__shellyIsOffline = function () { return !navigator.onLine || !lastPingOk; };
  })();

  /* ── Form submit: disable button & show spinner ─────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form').forEach(function(form) {
      if (form.classList.contains('budget-amount-form')) return;
      form.addEventListener('submit', function(e) {
        syncTagsInForm(form);
        var isPost = form.method && form.method.toUpperCase() === 'POST';
        if (isPost && window.__shellyIsOffline && window.__shellyIsOffline()) {
          e.preventDefault();
          var banner = document.getElementById('offline-banner');
          if (banner) banner.classList.remove('hidden');
          return;
        }
        var btn = form.querySelector('button[type="submit"]');
        if (btn && !btn.classList.contains('btn-loading')) {
          btn.classList.add('btn-loading');
          btn.disabled = true;
          setTimeout(function() {
            btn.classList.remove('btn-loading');
            btn.disabled = false;
          }, 8000);
        }
      });
    });
  });

  /* ── Service Worker registration ──────────────────────────────────── */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(function(reg) {
        setInterval(function() { reg.update(); }, 60 * 60 * 1000);
      })
      .catch(function() { });
  }
})();

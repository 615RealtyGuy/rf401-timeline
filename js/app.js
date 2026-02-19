/* RF401 Contract Timeline — Main Application Entry Point */

// -----------------------------------------------------------------------
// Global: Toast notifications
// -----------------------------------------------------------------------

function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(function () {
        toast.classList.add('show');
    });

    setTimeout(function () {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', function () { toast.remove(); });
        setTimeout(function () { toast.remove(); }, 500);
    }, 5000);
}

// -----------------------------------------------------------------------
// Current state
// -----------------------------------------------------------------------

var _currentDeal = null;
var _currentTab = 'manual_entry';
var _showArchived = false;
var _calYear = null;
var _calMonth = null;

// -----------------------------------------------------------------------
// Page: Login
// -----------------------------------------------------------------------

function initLoginPage() {
    // Auto-redirect if already logged in
    if (Store.getUser()) {
        window.location.href = 'dashboard.html';
        return;
    }

    var form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var username = document.getElementById('login-username').value.trim();
            if (!username) {
                var errEl = document.getElementById('login-error');
                if (errEl) {
                    errEl.textContent = 'Please enter a username.';
                    errEl.style.display = 'block';
                }
                return;
            }
            Store.setUser(username);
            window.location.href = 'dashboard.html';
        });
    }
}

// -----------------------------------------------------------------------
// Page: Dashboard
// -----------------------------------------------------------------------

function initDashboard() {
    UI.renderNav(Store.getUser());

    // Render deal list
    _renderDashboard();

    // Create deal form
    var form = document.getElementById('create-deal-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = document.getElementById('deal-name').value.trim();
            if (!name) return;

            var deal = Store.createDeal({
                name: name,
                property_address: document.getElementById('deal-address').value.trim(),
                buyer_name: document.getElementById('deal-buyer').value.trim(),
                seller_name: document.getElementById('deal-seller').value.trim(),
                binding_agreement_date: document.getElementById('deal-bad').value || null
            });

            showToast('Deal created: ' + deal.name, 'success');
            window.location.href = 'deal.html?id=' + deal.id;
        });
    }

    // Logout button (event delegation)
    document.addEventListener('click', function (e) {
        if (e.target.id === 'logout-btn' || e.target.closest('#logout-btn')) {
            Store.clearUser();
            window.location.href = 'index.html';
        }
        if (e.target.id === 'toggle-archive-btn' || e.target.closest('#toggle-archive-btn')) {
            _showArchived = !_showArchived;
            _renderDashboard();
        }
    });
}

function _renderDashboard() {
    var allDeals = Store.getAllDeals();
    var archivedCount = Store.getArchivedCount();
    var displayDeals = _showArchived ? allDeals : allDeals.filter(function (d) { return d.status !== 'archived'; });

    UI.renderDealList(displayDeals, _showArchived);
    UI.renderArchiveToggle(archivedCount, _showArchived);
}

// -----------------------------------------------------------------------
// Page: Deal Detail
// -----------------------------------------------------------------------

function initDealDetail(dealId) {
    UI.renderNav(Store.getUser());

    var deal = Store.getDeal(dealId);
    if (!deal) {
        showToast('Deal not found.', 'error');
        window.location.href = 'dashboard.html';
        return;
    }

    _currentDeal = deal;

    // Render full page
    UI.renderDealPage(deal);

    // Restore last active tab
    var storageKey = 'rf401-tab-' + dealId;
    var savedTab = localStorage.getItem(storageKey) || 'manual_entry';
    _switchTab(savedTab);

    // Set up event listeners
    _setupDealEventListeners(dealId);
}

function _switchTab(tabName) {
    _currentTab = tabName;
    var dealId = _currentDeal.id;
    var storageKey = 'rf401-tab-' + dealId;
    localStorage.setItem(storageKey, tabName);

    // Update tab button styles
    var btns = document.querySelectorAll('.tab-btn');
    btns.forEach(function (btn) {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) btn.classList.add('active');
    });

    // Render tab content
    var container = document.getElementById('tab-content');
    if (!container) return;

    // Reload deal from store to get latest data
    _currentDeal = Store.getDeal(_currentDeal.id) || _currentDeal;

    switch (tabName) {
        case 'manual_entry':
            container.innerHTML = UI.renderManualEntryTab(_currentDeal);
            break;
        case 'timeline':
            container.innerHTML = UI.renderTimelineTab(_currentDeal);
            break;
        case 'calendar':
            container.innerHTML = UI.renderCalendarTab(_currentDeal, _calYear, _calMonth);
            break;
        case 'deal_info':
            container.innerHTML = UI.renderDealInfoTab(_currentDeal);
            break;
        case 'tasks':
            container.innerHTML = UI.renderTasksTab(_currentDeal);
            break;
        default:
            container.innerHTML = '<div class="empty-state"><p>Select a tab above.</p></div>';
    }
}

function _refreshCurrentTab() {
    _switchTab(_currentTab);
    // Update badges
    _updateBadges();
}

function _updateBadges() {
    var deal = _currentDeal;
    var timelineCount = (deal.events || []).filter(function (e) { return e.event_type !== 'info'; }).length;
    var infoCount = (deal.info_items || []).length;
    var taskCount = (deal.tasks || []).length;

    _setBadge('timeline', timelineCount);
    _setBadge('calendar', timelineCount);
    _setBadge('deal_info', infoCount, 'tab-badge-info');
    _setBadge('tasks', taskCount);
}

function _setBadge(tabName, value, extraClass) {
    var btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
    if (!btn) return;
    var badge = btn.querySelector('.tab-badge');
    if (value <= 0) {
        if (badge) badge.remove();
        return;
    }
    if (!badge) {
        badge = document.createElement('span');
        badge.className = extraClass ? 'tab-badge ' + extraClass : 'tab-badge';
        btn.appendChild(badge);
    }
    badge.textContent = value;
}

function _setupDealEventListeners(dealId) {
    document.addEventListener('click', function (e) {
        var target = e.target;

        // Logout
        if (target.id === 'logout-btn' || target.closest('#logout-btn')) {
            Store.clearUser();
            window.location.href = 'index.html';
            return;
        }

        // Tab navigation
        var tabBtn = target.closest('.tab-btn');
        if (tabBtn && tabBtn.dataset.tab) {
            _switchTab(tabBtn.dataset.tab);
            return;
        }

        // BAD edit toggle
        if (target.id === 'bad-edit-toggle') {
            _toggleBadEdit();
            return;
        }
        if (target.id === 'bad-cancel-btn') {
            _toggleBadEdit();
            return;
        }
        if (target.id === 'bad-save-btn') {
            _saveBadDate(dealId);
            return;
        }

        // Archive/Unarchive/Delete
        if (target.id === 'archive-deal-btn') {
            if (confirm('Archive this deal? It will be hidden from the dashboard.')) {
                Store.updateDeal(dealId, { status: 'archived' });
                showToast('Deal archived.', 'success');
                window.location.href = 'dashboard.html';
            }
            return;
        }
        if (target.id === 'unarchive-deal-btn') {
            Store.updateDeal(dealId, { status: 'active' });
            showToast('Deal restored.', 'success');
            window.location.reload();
            return;
        }
        if (target.id === 'delete-deal-btn') {
            if (confirm('Permanently delete this deal and ALL associated data? This cannot be undone.')) {
                Store.deleteDeal(dealId);
                showToast('Deal deleted.', 'success');
                window.location.href = 'dashboard.html';
            }
            return;
        }

        // PDF Deal Card Export
        if (target.id === 'pdf-export-btn' || target.id === 'pdf-export-btn-cal' || target.closest('#pdf-export-btn') || target.closest('#pdf-export-btn-cal')) {
            PdfExport.downloadDealCard(_currentDeal);
            return;
        }

        // ICS Export
        if (target.id === 'ics-export-btn' || target.id === 'ics-export-btn-cal' || target.closest('#ics-export-btn') || target.closest('#ics-export-btn-cal')) {
            Calendar.downloadICS(_currentDeal);
            return;
        }

        // Add All to GCal
        if (target.id === 'gcal-all-btn' || target.id === 'gcal-all-btn-cal' || target.closest('#gcal-all-btn') || target.closest('#gcal-all-btn-cal')) {
            Calendar.addAllToGCal(_currentDeal);
            return;
        }

        // Calendar navigation
        var calNav = target.closest('[data-cal-nav]');
        if (calNav) {
            _calYear = parseInt(calNav.dataset.year);
            _calMonth = parseInt(calNav.dataset.month);
            _switchTab('calendar');
            return;
        }

        // Task toggle
        var taskToggle = target.closest('.task-toggle');
        if (taskToggle) {
            var taskId = taskToggle.dataset.taskId;
            var currentStatus = taskToggle.dataset.status;
            var nextMap = { 'todo': 'doing', 'doing': 'done', 'done': 'todo' };
            var nextStatus = nextMap[currentStatus] || 'todo';
            Store.updateTaskStatus(dealId, taskId, nextStatus);
            _currentDeal = Store.getDeal(dealId);
            _refreshCurrentTab();
            return;
        }

        // Offset edit button
        var offsetEditBtn = target.closest('.offset-edit-btn');
        if (offsetEditBtn) {
            var eventId = offsetEditBtn.dataset.eventId;
            var basis = JSON.parse(offsetEditBtn.dataset.basis);
            var widget = document.getElementById('offset-widget-' + eventId);
            var input = document.getElementById('offset-input-' + eventId);
            if (widget && input) {
                input.value = basis.offset_value || '';
                widget.style.display = 'inline-flex';
            }
            return;
        }

        // Offset cancel
        var offsetCancel = target.closest('.offset-cancel-btn');
        if (offsetCancel) {
            var evtId = offsetCancel.dataset.eventId;
            var w = document.getElementById('offset-widget-' + evtId);
            if (w) w.style.display = 'none';
            return;
        }

        // Offset save
        var offsetSave = target.closest('.offset-save-btn');
        if (offsetSave) {
            _saveOffsetOverride(dealId, offsetSave.dataset.eventId);
            return;
        }
    });

    // Manual entry form submission
    document.addEventListener('submit', function (e) {
        if (e.target.id === 'manual-entry-form') {
            e.preventDefault();
            _submitManualEntry(dealId);
        }
    });
}

// -----------------------------------------------------------------------
// BAD edit
// -----------------------------------------------------------------------

function _toggleBadEdit() {
    var widget = document.getElementById('bad-edit-widget');
    var display = document.getElementById('bad-display');
    var editBtn = document.getElementById('bad-edit-toggle');
    if (!widget) return;

    var isHidden = widget.style.display === 'none';
    widget.style.display = isHidden ? 'inline-flex' : 'none';
    if (display) display.style.display = isHidden ? 'none' : 'inline';
    if (editBtn) editBtn.style.display = isHidden ? 'none' : 'inline';
}

function _saveBadDate(dealId) {
    var input = document.getElementById('bad-date-input');
    if (!input) return;
    var dateValue = input.value || null;

    // Update deal
    Store.updateDeal(dealId, { binding_agreement_date: dateValue });

    // Also update manual_entry anchors if they exist
    _currentDeal = Store.getDeal(dealId);
    if (_currentDeal.manual_entry && _currentDeal.manual_entry.anchors) {
        _currentDeal.manual_entry.anchors.forEach(function (a) {
            if (a.anchor_id === 'binding_agreement_date') {
                a.value = dateValue;
            }
        });
        Store.setManualEntry(dealId, _currentDeal.manual_entry);
    }

    // Re-materialize
    _currentDeal = Store.getDeal(dealId);
    if (_currentDeal.manual_entry) {
        var result = Materializer.rematerialize(_currentDeal);
        Store.setDealEvents(dealId, result.events);
        Store.setDealTasks(dealId, result.tasks);
        Store.setDealInfoItems(dealId, result.infoItems);
        _currentDeal = Store.getDeal(dealId);

        showToast('Timeline recalculated: ' + result.events.filter(function (e) { return e.event_type !== 'info'; }).length + ' events, ' + result.tasks.length + ' tasks.', 'success');
    }

    // Re-render full page to update header + badges
    UI.renderDealPage(_currentDeal);
    _switchTab(_currentTab);
    _setupDealEventListeners(dealId);

    showToast('Binding Agreement Date updated.', 'success');
}

// -----------------------------------------------------------------------
// Manual Entry submission
// -----------------------------------------------------------------------

function _submitManualEntry(dealId) {
    var form = document.getElementById('manual-entry-form');
    var btn = document.getElementById('manual-submit-btn');
    if (!form || !btn) return;

    btn.disabled = true;
    btn.textContent = 'Generating...';

    // Collect form data
    var payload = { anchors: [], offsets: [], financials: [], text_fields: [] };

    // Anchors
    CLAUSE_MAP.anchors.forEach(function (anchor) {
        var input = document.getElementById('anchor-' + anchor.id);
        payload.anchors.push({
            anchor_id: anchor.id,
            value: input ? input.value || null : null
        });
    });

    // Offsets
    var deadlineClauses = CLAUSE_MAP.clauses.filter(function (c) { return c.expected_type === 'deadline'; });
    deadlineClauses.forEach(function (clause) {
        var input = form.querySelector('[name="offset_' + clause.id + '"]');
        var kindSelect = form.querySelector('[name="offset_kind_' + clause.id + '"]');
        var val = input ? parseInt(input.value, 10) : NaN;
        if (!isNaN(val) && val > 0) {
            payload.offsets.push({
                clause_id: clause.id,
                offset_value: val,
                offset_kind: kindSelect ? kindSelect.value : 'calendar',
                direction: clause.direction || 'after',
                trigger: clause.trigger || 'binding_agreement_date'
            });
        }
    });

    // Financials
    CLAUSE_MAP.financial_fields.forEach(function (field) {
        var input = form.querySelector('[name="financial_' + field.id + '"]');
        if (input && input.value.trim()) {
            payload.financials.push({ field_id: field.id, value: input.value.trim() });
        }
    });

    // Text fields
    CLAUSE_MAP.text_fields.forEach(function (field) {
        var el = form.querySelector('[name="text_' + field.id + '"]');
        if (el && el.value.trim()) {
            payload.text_fields.push({ field_id: field.id, value: el.value.trim() });
        }
    });

    // Save manual entry data
    Store.setManualEntry(dealId, payload);

    // Update BAD on deal if provided
    payload.anchors.forEach(function (a) {
        if (a.anchor_id === 'binding_agreement_date' && a.value) {
            Store.updateDeal(dealId, { binding_agreement_date: a.value });
        }
    });

    // Materialize
    _currentDeal = Store.getDeal(dealId);
    var result = Materializer.materialize(_currentDeal);
    Store.setDealEvents(dealId, result.events);
    Store.setDealTasks(dealId, result.tasks);
    Store.setDealInfoItems(dealId, result.infoItems);
    _currentDeal = Store.getDeal(dealId);

    var timelineEvents = result.events.filter(function (e) { return e.event_type !== 'info'; });
    showToast('Timeline generated: ' + timelineEvents.length + ' events, ' + result.tasks.length + ' tasks.', 'success');

    // Update badges and switch to timeline
    _updateBadges();

    btn.disabled = false;
    btn.textContent = 'Generate Timeline';

    // Switch to timeline tab
    _switchTab('timeline');
}

// -----------------------------------------------------------------------
// Offset override save
// -----------------------------------------------------------------------

function _saveOffsetOverride(dealId, eventId) {
    var input = document.getElementById('offset-input-' + eventId);
    if (!input) return;
    var newValue = parseInt(input.value, 10);
    if (isNaN(newValue) || newValue < 1) {
        showToast('Please enter a valid number of days.', 'warning');
        return;
    }

    // Find the event to get its clause_id
    var deal = Store.getDeal(dealId);
    var targetEvent = null;
    (deal.events || []).forEach(function (e) {
        if (e.id === eventId) targetEvent = e;
    });
    if (!targetEvent || !targetEvent.basis || !targetEvent.basis.clause_id) {
        showToast('Cannot find event data.', 'error');
        return;
    }

    var clauseId = targetEvent.basis.clause_id;

    // Update overrides
    var overrides = deal.overrides || {};
    if (!overrides.offsets) overrides.offsets = {};
    overrides.offsets[clauseId] = { offset_value: newValue };
    Store.setOverrides(dealId, overrides);

    // Re-materialize
    _currentDeal = Store.getDeal(dealId);
    var result = Materializer.rematerialize(_currentDeal);
    Store.setDealEvents(dealId, result.events);
    Store.setDealTasks(dealId, result.tasks);
    Store.setDealInfoItems(dealId, result.infoItems);
    _currentDeal = Store.getDeal(dealId);

    showToast('Override saved: ' + clauseId + ' \u2192 ' + newValue + ' days. Timeline recalculated.', 'success');
    _refreshCurrentTab();
}

// -----------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.dataset.page;

    // Login page doesn't need cloud sync — handle immediately
    if (page === 'login') {
        initLoginPage();
        return;
    }

    // Initialize Store (async: signs into Firebase, loads deals from cloud)
    Store.init().then(function () {
        // Auth check
        var user = Store.getUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        if (page === 'dashboard') {
            initDashboard();
        } else if (page === 'deal') {
            var params = new URLSearchParams(window.location.search);
            var dealId = params.get('id');
            if (!dealId) {
                window.location.href = 'dashboard.html';
                return;
            }
            initDealDetail(dealId);
        }
    });
});

/* RF401 Contract Timeline — Admin Panel Module */

var Admin = (function () {

    // Admin username whitelist
    var ADMIN_USERS = ['John'];

    // Internal state
    var _allDeals = [];
    var _filteredDeals = [];
    var _filterOwner = '';
    var _searchQuery = '';

    // -----------------------------------------------------------------------
    // Admin check
    // -----------------------------------------------------------------------

    function isAdmin(username) {
        if (!username) return false;
        for (var i = 0; i < ADMIN_USERS.length; i++) {
            if (ADMIN_USERS[i].toLowerCase() === username.toLowerCase()) {
                return true;
            }
        }
        return false;
    }

    // -----------------------------------------------------------------------
    // Data loading
    // -----------------------------------------------------------------------

    function loadAllDeals() {
        return Store.adminGetAllDeals().then(function (deals) {
            _allDeals = deals;
            _filteredDeals = deals;
            return deals;
        });
    }

    // -----------------------------------------------------------------------
    // Stats
    // -----------------------------------------------------------------------

    function _computeStats(deals) {
        var totalDeals = deals.length;
        var activeDeals = 0;
        var archivedDeals = 0;
        var owners = {};

        for (var i = 0; i < deals.length; i++) {
            if (deals[i].status === 'archived') {
                archivedDeals++;
            } else {
                activeDeals++;
            }
            var owner = deals[i].owner_name || 'Unknown';
            if (!owners[owner]) owners[owner] = 0;
            owners[owner]++;
        }

        return {
            totalDeals: totalDeals,
            activeDeals: activeDeals,
            archivedDeals: archivedDeals,
            uniqueUsers: Object.keys(owners).length,
            ownerCounts: owners
        };
    }

    // -----------------------------------------------------------------------
    // Render: Stats cards
    // -----------------------------------------------------------------------

    function renderStats() {
        var container = document.getElementById('admin-stats');
        if (!container) return;

        var stats = _computeStats(_allDeals);

        container.innerHTML =
            '<div class="admin-stats-grid">' +
            _statCard('Total Deals', stats.totalDeals, 'gold') +
            _statCard('Active', stats.activeDeals, 'success') +
            _statCard('Archived', stats.archivedDeals, 'muted') +
            _statCard('Users', stats.uniqueUsers, 'info') +
            '</div>';
    }

    function _statCard(label, value, colorClass) {
        return '<div class="admin-stat-card">' +
            '<div class="admin-stat-value admin-text-' + colorClass + '">' + value + '</div>' +
            '<div class="admin-stat-label">' + label + '</div>' +
            '</div>';
    }

    // -----------------------------------------------------------------------
    // Render: Filters
    // -----------------------------------------------------------------------

    function renderFilters() {
        var container = document.getElementById('admin-filters');
        if (!container) return;

        var stats = _computeStats(_allDeals);
        var owners = Object.keys(stats.ownerCounts).sort();

        var html = '<div class="admin-filter-bar">';

        // Owner dropdown
        html += '<select id="admin-owner-filter" class="admin-filter-select">';
        html += '<option value="">All Users</option>';
        for (var i = 0; i < owners.length; i++) {
            var selected = _filterOwner === owners[i] ? ' selected' : '';
            html += '<option value="' + UI.esc(owners[i]) + '"' + selected + '>' +
                UI.esc(owners[i]) + ' (' + stats.ownerCounts[owners[i]] + ')</option>';
        }
        html += '</select>';

        // Search input
        html += '<input type="text" id="admin-search" placeholder="Search deal name or address..." ' +
            'class="admin-search-input" value="' + UI.esc(_searchQuery) + '">';

        // Result count
        html += '<span class="admin-result-count">' + _filteredDeals.length + ' deal' +
            (_filteredDeals.length !== 1 ? 's' : '') + '</span>';

        html += '</div>';
        container.innerHTML = html;
    }

    // -----------------------------------------------------------------------
    // Render: User list
    // -----------------------------------------------------------------------

    function renderUserList() {
        var container = document.getElementById('admin-users');
        if (!container) return;

        var stats = _computeStats(_allDeals);
        var owners = Object.keys(stats.ownerCounts).sort();

        if (owners.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No users yet.</p></div>';
            return;
        }

        var html = '<h3 class="admin-section-title">Users</h3>';
        html += '<div class="admin-users-grid">';
        for (var i = 0; i < owners.length; i++) {
            var owner = owners[i];
            var count = stats.ownerCounts[owner];
            var isAdminUser = isAdmin(owner);
            html += '<div class="admin-user-card">' +
                '<div class="admin-user-name">' + UI.esc(owner) +
                (isAdminUser ? ' <span class="admin-badge">Admin</span>' : '') +
                '</div>' +
                '<div class="admin-user-count">' + count + ' deal' + (count !== 1 ? 's' : '') + '</div>' +
                '<button type="button" class="btn-outline btn-sm admin-filter-by-user" ' +
                'data-owner="' + UI.esc(owner) + '">View Deals</button>' +
                '</div>';
        }
        html += '</div>';
        container.innerHTML = html;
    }

    // -----------------------------------------------------------------------
    // Render: All Deals table
    // -----------------------------------------------------------------------

    function renderDealsTable() {
        var container = document.getElementById('admin-deals');
        if (!container) return;

        var html = '<h3 class="admin-section-title">All Deals ' +
            '<span class="admin-section-count">' + _filteredDeals.length + '</span></h3>';

        if (_filteredDeals.length === 0) {
            html += '<div class="empty-state"><p>No deals match the current filters.</p></div>';
            container.innerHTML = html;
            return;
        }

        html += '<div class="timeline-table-wrap"><table class="timeline-table admin-table"><thead><tr>';
        html += '<th>Deal Name</th><th>Owner</th><th>Property</th>';
        html += '<th>Status</th><th>Created</th><th>Updated</th><th>Actions</th>';
        html += '</tr></thead><tbody>';

        for (var i = 0; i < _filteredDeals.length; i++) {
            var deal = _filteredDeals[i];
            var created = deal.created_at
                ? Materializer.formatDateDisplay(deal.created_at.substring(0, 10))
                : '---';
            var updated = deal.updated_at
                ? Materializer.formatDateDisplay(deal.updated_at.substring(0, 10))
                : '---';
            var statusClass = deal.status === 'archived' ? 'archived' : 'active';

            html += '<tr>';
            html += '<td class="admin-deal-name">' + UI.esc(deal.name || 'Untitled') + '</td>';
            html += '<td><span class="admin-owner-tag">' + UI.esc(deal.owner_name || 'Unknown') + '</span></td>';
            html += '<td class="text-sm">' + UI.esc(deal.property_address || '---') + '</td>';
            html += '<td><span class="admin-status-pill admin-status-' + statusClass + '">' +
                UI.esc(deal.status || 'active') + '</span></td>';
            html += '<td class="text-sm">' + created + '</td>';
            html += '<td class="text-sm">' + updated + '</td>';
            html += '<td class="admin-actions">';
            html += '<a href="deal.html?id=' + UI.esc(deal.id) + '" class="btn-outline btn-sm">View</a> ';
            html += '<button type="button" class="btn-outline btn-sm btn-danger-outline admin-delete-deal" ' +
                'data-deal-id="' + UI.esc(deal.id) + '" data-deal-name="' + UI.esc(deal.name || 'Untitled') + '">Delete</button>';
            html += '</td>';
            html += '</tr>';
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // -----------------------------------------------------------------------
    // Filtering
    // -----------------------------------------------------------------------

    function _applyFilters() {
        _filteredDeals = _allDeals.filter(function (deal) {
            if (_filterOwner && deal.owner_name !== _filterOwner) return false;

            if (_searchQuery) {
                var q = _searchQuery.toLowerCase();
                var name = (deal.name || '').toLowerCase();
                var addr = (deal.property_address || '').toLowerCase();
                if (name.indexOf(q) < 0 && addr.indexOf(q) < 0) return false;
            }

            return true;
        });

        _filteredDeals.sort(function (a, b) {
            return (b.updated_at || b.created_at || '').localeCompare(
                a.updated_at || a.created_at || '');
        });
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    function setupEventListeners() {
        document.addEventListener('click', function (e) {
            var target = e.target;

            // Logout
            if (target.id === 'logout-btn' || target.closest('#logout-btn')) {
                Store.clearUser();
                window.location.href = 'index.html';
                return;
            }

            // Filter by user card button
            var filterBtn = target.closest('.admin-filter-by-user');
            if (filterBtn) {
                _filterOwner = filterBtn.dataset.owner || '';
                var ownerSelect = document.getElementById('admin-owner-filter');
                if (ownerSelect) ownerSelect.value = _filterOwner;
                _applyFilters();
                renderFilters();
                renderDealsTable();
                return;
            }

            // Delete deal
            var deleteBtn = target.closest('.admin-delete-deal');
            if (deleteBtn) {
                var dealId = deleteBtn.dataset.dealId;
                var dealName = deleteBtn.dataset.dealName;
                if (confirm('Permanently delete "' + dealName + '"? This cannot be undone.')) {
                    Store.adminDeleteDeal(dealId).then(function () {
                        _allDeals = _allDeals.filter(function (d) { return d.id !== dealId; });
                        _applyFilters();
                        renderAll();
                        showToast('Deal deleted: ' + dealName, 'success');
                    }).catch(function (err) {
                        showToast('Delete failed: ' + err.message, 'error');
                    });
                }
                return;
            }
        });

        // Owner filter dropdown
        document.addEventListener('change', function (e) {
            if (e.target.id === 'admin-owner-filter') {
                _filterOwner = e.target.value;
                _applyFilters();
                renderFilters();
                renderDealsTable();
            }
        });

        // Search input (debounced)
        var _searchTimeout;
        document.addEventListener('input', function (e) {
            if (e.target.id === 'admin-search') {
                clearTimeout(_searchTimeout);
                _searchTimeout = setTimeout(function () {
                    _searchQuery = e.target.value.trim();
                    _applyFilters();
                    renderFilters();
                    renderDealsTable();
                }, 250);
            }
        });
    }

    // -----------------------------------------------------------------------
    // Full render
    // -----------------------------------------------------------------------

    function renderAll() {
        renderStats();
        renderFilters();
        renderUserList();
        renderDealsTable();
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    return {
        ADMIN_USERS: ADMIN_USERS,
        isAdmin: isAdmin,
        loadAllDeals: loadAllDeals,
        renderAll: renderAll,
        setupEventListeners: setupEventListeners
    };
})();

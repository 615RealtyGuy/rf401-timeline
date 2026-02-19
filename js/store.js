/* RF401 Contract Timeline — localStorage CRUD Layer */

var Store = (function () {
    var USER_KEY = 'rf401_user';
    var DEALS_KEY = 'rf401_deals';

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    function _generateId() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for older browsers
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function _loadDeals() {
        try {
            var raw = localStorage.getItem(DEALS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to load deals from localStorage:', e);
            return [];
        }
    }

    function _saveDeals(deals) {
        localStorage.setItem(DEALS_KEY, JSON.stringify(deals));
    }

    function _findDealIndex(deals, dealId) {
        for (var i = 0; i < deals.length; i++) {
            if (deals[i].id === dealId) return i;
        }
        return -1;
    }

    // -----------------------------------------------------------------------
    // User
    // -----------------------------------------------------------------------

    function getUser() {
        return localStorage.getItem(USER_KEY) || null;
    }

    function setUser(username) {
        localStorage.setItem(USER_KEY, username);
    }

    function clearUser() {
        localStorage.removeItem(USER_KEY);
    }

    // -----------------------------------------------------------------------
    // Deals — CRUD
    // -----------------------------------------------------------------------

    function getAllDeals() {
        return _loadDeals();
    }

    function getActiveDeals() {
        return _loadDeals().filter(function (d) { return d.status !== 'archived'; });
    }

    function getArchivedCount() {
        return _loadDeals().filter(function (d) { return d.status === 'archived'; }).length;
    }

    function getDeal(dealId) {
        var deals = _loadDeals();
        var idx = _findDealIndex(deals, dealId);
        return idx >= 0 ? deals[idx] : null;
    }

    function createDeal(data) {
        var deals = _loadDeals();
        var deal = {
            id: _generateId(),
            name: data.name || 'Untitled Deal',
            property_address: data.property_address || '',
            buyer_name: data.buyer_name || '',
            seller_name: data.seller_name || '',
            binding_agreement_date: data.binding_agreement_date || null,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            manual_entry: null,
            overrides: {},
            events: [],
            tasks: [],
            info_items: []
        };
        deals.unshift(deal); // newest first
        _saveDeals(deals);
        return deal;
    }

    function updateDeal(dealId, updates) {
        var deals = _loadDeals();
        var idx = _findDealIndex(deals, dealId);
        if (idx < 0) return null;

        for (var key in updates) {
            if (updates.hasOwnProperty(key)) {
                deals[idx][key] = updates[key];
            }
        }
        deals[idx].updated_at = new Date().toISOString();
        _saveDeals(deals);
        return deals[idx];
    }

    function deleteDeal(dealId) {
        var deals = _loadDeals();
        var idx = _findDealIndex(deals, dealId);
        if (idx < 0) return false;
        deals.splice(idx, 1);
        _saveDeals(deals);
        return true;
    }

    // -----------------------------------------------------------------------
    // Materialized data
    // -----------------------------------------------------------------------

    function setDealEvents(dealId, events) {
        return updateDeal(dealId, { events: events });
    }

    function setDealTasks(dealId, tasks) {
        return updateDeal(dealId, { tasks: tasks });
    }

    function setDealInfoItems(dealId, infoItems) {
        return updateDeal(dealId, { info_items: infoItems });
    }

    // -----------------------------------------------------------------------
    // Task status
    // -----------------------------------------------------------------------

    function updateTaskStatus(dealId, taskId, newStatus) {
        var deals = _loadDeals();
        var idx = _findDealIndex(deals, dealId);
        if (idx < 0) return null;

        var tasks = deals[idx].tasks || [];
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id === taskId) {
                tasks[i].status = newStatus;
                break;
            }
        }
        deals[idx].tasks = tasks;
        deals[idx].updated_at = new Date().toISOString();
        _saveDeals(deals);
        return deals[idx];
    }

    // -----------------------------------------------------------------------
    // Manual entry & overrides
    // -----------------------------------------------------------------------

    function setManualEntry(dealId, manualEntry) {
        return updateDeal(dealId, { manual_entry: manualEntry });
    }

    function setOverrides(dealId, overrides) {
        return updateDeal(dealId, { overrides: overrides });
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    return {
        getUser: getUser,
        setUser: setUser,
        clearUser: clearUser,
        getAllDeals: getAllDeals,
        getActiveDeals: getActiveDeals,
        getArchivedCount: getArchivedCount,
        getDeal: getDeal,
        createDeal: createDeal,
        updateDeal: updateDeal,
        deleteDeal: deleteDeal,
        setDealEvents: setDealEvents,
        setDealTasks: setDealTasks,
        setDealInfoItems: setDealInfoItems,
        updateTaskStatus: updateTaskStatus,
        setManualEntry: setManualEntry,
        setOverrides: setOverrides
    };
})();

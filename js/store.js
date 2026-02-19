/* RF401 Contract Timeline — Data Layer with Firestore Cloud Sync */

var Store = (function () {
    var USER_KEY = 'rf401_user';
    var DEALS_KEY = 'rf401_deals';
    var COLLECTION = 'deals';

    // -----------------------------------------------------------------------
    // Internal state
    // -----------------------------------------------------------------------

    var _user = null;       // current username string
    var _cache = [];        // in-memory deal array (single source of truth for reads)
    var _db = null;         // Firestore reference (set during init)
    var _auth = null;       // Firebase Auth reference
    var _ready = false;     // true once init() completes

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    function _generateId() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function _findIndex(dealId) {
        for (var i = 0; i < _cache.length; i++) {
            if (_cache[i].id === dealId) return i;
        }
        return -1;
    }

    // -----------------------------------------------------------------------
    // localStorage backup (offline fallback)
    // -----------------------------------------------------------------------

    function _persistLocal() {
        try {
            localStorage.setItem(DEALS_KEY, JSON.stringify(_cache));
        } catch (e) {
            console.warn('Store: localStorage write failed', e);
        }
    }

    function _loadLocal() {
        try {
            var raw = localStorage.getItem(DEALS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Store: localStorage read failed', e);
            return [];
        }
    }

    // -----------------------------------------------------------------------
    // Firestore cloud helpers (fire-and-forget)
    // -----------------------------------------------------------------------

    function _syncToCloud(deal) {
        if (!_db) return;
        try {
            _db.collection(COLLECTION).doc(deal.id).set(JSON.parse(JSON.stringify(deal)))
                .catch(function (err) {
                    console.warn('Store: cloud sync failed for ' + deal.id, err);
                });
        } catch (e) {
            console.warn('Store: cloud sync error', e);
        }
    }

    function _deleteFromCloud(dealId) {
        if (!_db) return;
        try {
            _db.collection(COLLECTION).doc(dealId).delete()
                .catch(function (err) {
                    console.warn('Store: cloud delete failed for ' + dealId, err);
                });
        } catch (e) {
            console.warn('Store: cloud delete error', e);
        }
    }

    function _loadFromCloud() {
        if (!_db || !_user) return Promise.resolve([]);
        return _db.collection(COLLECTION)
            .where('owner_name', '==', _user)
            .get()
            .then(function (snapshot) {
                var deals = [];
                snapshot.forEach(function (doc) {
                    deals.push(doc.data());
                });
                // Sort newest first
                deals.sort(function (a, b) {
                    return (b.created_at || '').localeCompare(a.created_at || '');
                });
                return deals;
            });
    }

    // -----------------------------------------------------------------------
    // Migration: push existing localStorage deals to Firestore
    // -----------------------------------------------------------------------

    function _migrateLocalToCloud(localDeals) {
        if (!_db || !_user || localDeals.length === 0) return;
        console.log('Store: migrating ' + localDeals.length + ' local deals to Firestore');
        localDeals.forEach(function (deal) {
            // Tag with owner_name if not already set
            if (!deal.owner_name) {
                deal.owner_name = _user;
            }
            _syncToCloud(deal);
        });
    }

    // -----------------------------------------------------------------------
    // Init — async, called once at boot
    // -----------------------------------------------------------------------

    function init() {
        // Grab Firebase references
        if (typeof FirebaseConfig !== 'undefined') {
            _db = FirebaseConfig.db;
            _auth = FirebaseConfig.auth;
        }

        // Load username from localStorage
        _user = localStorage.getItem(USER_KEY) || null;

        // If no user, just load local deals and return
        if (!_user) {
            _cache = _loadLocal();
            _ready = true;
            return Promise.resolve();
        }

        // If no Firebase available, fall back to localStorage
        if (!_auth || !_db) {
            console.warn('Store: Firebase not available, using localStorage only');
            _cache = _loadLocal();
            _ready = true;
            return Promise.resolve();
        }

        // Sign in anonymously, then load from cloud
        return _auth.signInAnonymously()
            .then(function () {
                return _loadFromCloud();
            })
            .then(function (cloudDeals) {
                var localDeals = _loadLocal();

                if (cloudDeals.length > 0) {
                    // Cloud has data — use it as source of truth
                    _cache = cloudDeals;

                    // Also push any local-only deals to cloud (merge)
                    var cloudIds = {};
                    cloudDeals.forEach(function (d) { cloudIds[d.id] = true; });
                    var localOnly = localDeals.filter(function (d) { return !cloudIds[d.id]; });
                    if (localOnly.length > 0) {
                        localOnly.forEach(function (d) {
                            if (!d.owner_name) d.owner_name = _user;
                            _cache.unshift(d);
                        });
                        _migrateLocalToCloud(localOnly);
                    }
                } else if (localDeals.length > 0) {
                    // Cloud is empty but we have local data — migrate up
                    _cache = localDeals;
                    _migrateLocalToCloud(localDeals);
                } else {
                    // Both empty
                    _cache = [];
                }

                _persistLocal();
                _ready = true;
            })
            .catch(function (err) {
                console.warn('Store: cloud init failed, using localStorage', err);
                _cache = _loadLocal();
                _ready = true;
            });
    }

    // -----------------------------------------------------------------------
    // User
    // -----------------------------------------------------------------------

    function getUser() {
        return _user || localStorage.getItem(USER_KEY) || null;
    }

    function setUser(username) {
        _user = username;
        localStorage.setItem(USER_KEY, username);
    }

    function clearUser() {
        _user = null;
        _cache = [];
        localStorage.removeItem(USER_KEY);
    }

    // -----------------------------------------------------------------------
    // Deals — CRUD (synchronous reads from cache, async cloud writes)
    // -----------------------------------------------------------------------

    function getAllDeals() {
        return _cache.slice(); // return copy
    }

    function getActiveDeals() {
        return _cache.filter(function (d) { return d.status !== 'archived'; });
    }

    function getArchivedCount() {
        return _cache.filter(function (d) { return d.status === 'archived'; }).length;
    }

    function getDeal(dealId) {
        var idx = _findIndex(dealId);
        return idx >= 0 ? _cache[idx] : null;
    }

    function createDeal(data) {
        var deal = {
            id: _generateId(),
            owner_name: _user || '',
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
        _cache.unshift(deal);
        _persistLocal();
        _syncToCloud(deal);
        return deal;
    }

    function updateDeal(dealId, updates) {
        var idx = _findIndex(dealId);
        if (idx < 0) return null;

        for (var key in updates) {
            if (updates.hasOwnProperty(key)) {
                _cache[idx][key] = updates[key];
            }
        }
        _cache[idx].updated_at = new Date().toISOString();
        _persistLocal();
        _syncToCloud(_cache[idx]);
        return _cache[idx];
    }

    function deleteDeal(dealId) {
        var idx = _findIndex(dealId);
        if (idx < 0) return false;
        _cache.splice(idx, 1);
        _persistLocal();
        _deleteFromCloud(dealId);
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
        var idx = _findIndex(dealId);
        if (idx < 0) return null;

        var tasks = _cache[idx].tasks || [];
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id === taskId) {
                tasks[i].status = newStatus;
                break;
            }
        }
        _cache[idx].tasks = tasks;
        _cache[idx].updated_at = new Date().toISOString();
        _persistLocal();
        _syncToCloud(_cache[idx]);
        return _cache[idx];
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
    // Admin: Firestore queries (no owner_name filter)
    // -----------------------------------------------------------------------

    function adminGetAllDeals() {
        if (!_db) return Promise.resolve([]);

        var authPromise = _auth && !_auth.currentUser
            ? _auth.signInAnonymously()
            : Promise.resolve();

        return authPromise.then(function () {
            return _db.collection(COLLECTION).get().then(function (snapshot) {
                var deals = [];
                snapshot.forEach(function (doc) {
                    deals.push(doc.data());
                });
                deals.sort(function (a, b) {
                    return (b.created_at || '').localeCompare(a.created_at || '');
                });
                return deals;
            });
        });
    }

    function adminDeleteDeal(dealId) {
        if (!_db) return Promise.reject(new Error('No database connection'));
        return _db.collection(COLLECTION).doc(dealId).delete();
    }

    function adminGetDeal(dealId) {
        if (!_db) return Promise.resolve(null);
        return _db.collection(COLLECTION).doc(dealId).get()
            .then(function (doc) {
                return doc.exists ? doc.data() : null;
            });
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    return {
        init: init,
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
        setOverrides: setOverrides,
        adminGetAllDeals: adminGetAllDeals,
        adminDeleteDeal: adminDeleteDeal,
        adminGetDeal: adminGetDeal
    };
})();

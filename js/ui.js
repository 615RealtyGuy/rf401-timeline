/* RF401 Contract Timeline — UI Rendering Module
   Replaces Jinja2 templates with JS DOM rendering */

var UI = (function () {

    // -----------------------------------------------------------------------
    // Escaping helper
    // -----------------------------------------------------------------------

    function esc(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // -----------------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------------

    function renderNav(username) {
        var el = document.getElementById('nav-right');
        if (!el) return;
        el.innerHTML =
            '<a href="dashboard.html" class="nav-link">Deals</a>' +
            '<span class="nav-user">' + esc(username) + '</span>' +
            '<button type="button" class="nav-link nav-logout-btn" id="logout-btn">Logout</button>';
    }

    // -----------------------------------------------------------------------
    // Dashboard — Deal List
    // -----------------------------------------------------------------------

    function renderDealList(deals, showArchived) {
        var container = document.getElementById('deal-list');
        if (!container) return;

        if (deals.length === 0) {
            container.innerHTML =
                '<div class="empty-state">' +
                '  <div class="empty-icon">\uD83D\uDCCB</div>' +
                '  <h3>No deals yet</h3>' +
                '  <p>Create your first deal to get started with contract timeline extraction.</p>' +
                '</div>';
            return;
        }

        var html = '';
        deals.forEach(function (deal) {
            var taskCount = (deal.tasks || []).length;
            var eventCount = (deal.events || []).filter(function (e) { return e.event_type !== 'info'; }).length;
            var created = deal.created_at ? new Date(deal.created_at) : new Date();
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var dateStr = months[created.getMonth()] + ' ' + created.getDate() + ', ' + created.getFullYear();

            html += '<a href="deal.html?id=' + esc(deal.id) + '" class="deal-card-link">' +
                '<article class="card deal-card">' +
                '  <div class="deal-card-header">' +
                '    <h3 class="deal-card-title">' + esc(deal.name) + '</h3>' +
                '    <span class="status-pill status-' + esc(deal.status) + '">' + esc(deal.status) + '</span>' +
                '  </div>';
            if (deal.property_address) {
                html += '<p class="deal-card-address">' + esc(deal.property_address) + '</p>';
            }
            html += '  <div class="deal-card-meta">' +
                '    <span class="meta-item"><span class="meta-icon">\u2713</span> ' + taskCount + ' task' + (taskCount !== 1 ? 's' : '') + '</span>' +
                '    <span class="meta-item"><span class="meta-icon">\uD83D\uDCC5</span> ' + eventCount + ' event' + (eventCount !== 1 ? 's' : '') + '</span>' +
                '    <span class="meta-item meta-date">' + dateStr + '</span>' +
                '  </div>' +
                '</article></a>';
        });
        container.innerHTML = html;
    }

    function renderArchiveToggle(archivedCount, showArchived) {
        var el = document.getElementById('archive-toggle');
        if (!el) return;
        if (archivedCount === 0) {
            el.innerHTML = '';
            return;
        }
        if (showArchived) {
            el.innerHTML = '<div class="archive-toggle"><button type="button" class="btn-outline btn-sm" id="toggle-archive-btn">Hide Archived (' + archivedCount + ')</button></div>';
        } else {
            el.innerHTML = '<div class="archive-toggle"><button type="button" class="btn-outline btn-sm" id="toggle-archive-btn">Show Archived (' + archivedCount + ')</button></div>';
        }
    }

    // -----------------------------------------------------------------------
    // Deal Detail — Header
    // -----------------------------------------------------------------------

    function renderDealPage(deal) {
        var main = document.getElementById('deal-main');
        if (!main) return;

        // Update page title
        document.title = esc(deal.name) + ' \u2014 RF401 Timeline';

        var badDisplay = deal.binding_agreement_date
            ? Materializer.formatDateDisplay(deal.binding_agreement_date)
            : 'Not set';
        var badClass = deal.binding_agreement_date ? 'bad-value' : 'bad-value bad-not-set';
        var badInputVal = deal.binding_agreement_date || '';

        var html = '';
        // Breadcrumb
        html += '<nav class="breadcrumb"><a href="dashboard.html">Deals</a><span class="breadcrumb-sep">/</span><span>' + esc(deal.name) + '</span></nav>';

        // Deal Header Card
        html += '<article class="card deal-header-card">';
        html += '<div class="deal-header-top"><div>';
        html += '<h1 class="deal-title">' + esc(deal.name) + '</h1>';
        if (deal.property_address) {
            html += '<p class="deal-address">' + esc(deal.property_address) + '</p>';
        }
        html += '</div><span class="status-pill status-' + esc(deal.status) + '">' + esc(deal.status) + '</span></div>';

        // Meta
        html += '<div class="deal-header-meta">';
        if (deal.buyer_name) html += '<span class="meta-tag"><strong>Buyer:</strong> ' + esc(deal.buyer_name) + '</span>';
        if (deal.seller_name) html += '<span class="meta-tag"><strong>Seller:</strong> ' + esc(deal.seller_name) + '</span>';
        var created = deal.created_at ? new Date(deal.created_at) : new Date();
        html += '<span class="meta-tag"><strong>Created:</strong> ' + Materializer.formatDateDisplay(Materializer.formatDate(created)) + '</span>';
        html += '</div>';

        // BAD edit row
        html += '<div class="bad-edit-row">';
        html += '<strong>Binding Agreement Date:</strong> ';
        html += '<span id="bad-display" class="' + badClass + '">' + esc(badDisplay) + '</span> ';
        html += '<button type="button" class="bad-edit-btn" id="bad-edit-toggle" title="Edit Binding Agreement Date">\u270E</button>';
        html += '<div id="bad-edit-widget" class="bad-edit-widget" style="display:none;">';
        html += '<input type="date" id="bad-date-input" value="' + badInputVal + '">';
        html += '<button type="button" class="gold-btn bad-save-btn" id="bad-save-btn">Save</button>';
        html += '<button type="button" class="bad-cancel-btn" id="bad-cancel-btn">Cancel</button>';
        html += '</div></div>';

        // Actions
        html += '<div class="deal-actions-row">';
        if (deal.status !== 'archived') {
            html += '<button type="button" class="btn-outline btn-sm" id="archive-deal-btn">Archive Deal</button>';
        } else {
            html += '<button type="button" class="btn-outline btn-sm" id="unarchive-deal-btn">Restore Deal</button>';
        }
        html += '<button type="button" class="btn-outline btn-sm btn-danger-outline" id="delete-deal-btn">Delete Deal</button>';
        html += '</div></article>';

        // Tab Nav
        var timelineCount = (deal.events || []).filter(function (e) { return e.event_type !== 'info'; }).length;
        var infoCount = (deal.info_items || []).length;
        var taskCount = (deal.tasks || []).length;

        html += '<nav class="tab-nav" role="tablist" id="tab-nav">';
        html += _tabBtn('manual_entry', 'Manual Entry', 0);
        html += _tabBtn('timeline', 'Timeline', timelineCount);
        html += _tabBtn('calendar', 'Calendar', timelineCount);
        html += _tabBtn('deal_info', 'Deal Info', infoCount, 'tab-badge-info');
        html += _tabBtn('tasks', 'Tasks', taskCount);
        html += '</nav>';

        // Tab Content
        html += '<div id="tab-content" class="tab-content"></div>';

        main.innerHTML = html;
    }

    function _tabBtn(tabName, label, count, badgeClass) {
        var badge = '';
        if (count > 0) {
            var cls = badgeClass ? 'tab-badge ' + badgeClass : 'tab-badge';
            badge = '<span class="' + cls + '">' + count + '</span>';
        }
        return '<button class="tab-btn" role="tab" data-tab="' + tabName + '">' +
               label + badge + '</button>';
    }

    // -----------------------------------------------------------------------
    // Tab: Manual Entry
    // -----------------------------------------------------------------------

    function renderManualEntryTab(deal) {
        var html = '<div class="tab-section">';
        html += '<h3 class="section-title">Manual Contract Entry</h3>';
        html += '<p class="text-sm text-secondary" style="margin-top:-0.5rem; margin-bottom:1.25rem;">Enter contract dates and terms manually to generate a timeline.</p>';

        html += '<form id="manual-entry-form">';

        // Anchor Dates
        html += '<details class="manual-section" open><summary class="manual-section-title">Key Dates</summary>';
        html += '<div class="manual-section-body"><div class="grid">';
        CLAUSE_MAP.anchors.forEach(function (anchor) {
            var val = '';
            if (deal.manual_entry && deal.manual_entry.anchors) {
                deal.manual_entry.anchors.forEach(function (a) {
                    if (a.anchor_id === anchor.id && a.value) val = a.value;
                });
            }
            if (!val && anchor.id === 'binding_agreement_date' && deal.binding_agreement_date) {
                val = deal.binding_agreement_date;
            }
            html += '<label><span class="form-label">' + esc(anchor.label) + '</span>';
            html += '<input type="date" name="anchor_' + esc(anchor.id) + '" id="anchor-' + esc(anchor.id) + '" value="' + esc(val) + '"></label>';
        });
        html += '</div></div></details>';

        // Offset Deadlines
        var deadlineClauses = CLAUSE_MAP.clauses.filter(function (c) {
            return c.expected_type === 'deadline';
        });
        html += '<details class="manual-section" open><summary class="manual-section-title">Deadline Periods</summary>';
        html += '<div class="manual-section-body">';
        html += '<p class="text-sm text-secondary" style="margin-bottom:0.75rem;">Number of days for each deadline (calculated from Binding Agreement Date).</p>';
        html += '<div class="manual-offsets-grid">';
        deadlineClauses.forEach(function (clause) {
            var val = '';
            var kind = 'calendar';
            if (deal.manual_entry && deal.manual_entry.offsets) {
                deal.manual_entry.offsets.forEach(function (o) {
                    if (o.clause_id === clause.id) {
                        val = o.offset_value || '';
                        kind = o.offset_kind || 'calendar';
                    }
                });
            }
            html += '<div class="manual-offset-row">';
            html += '<label class="manual-offset-label">' + esc(clause.label);
            if (clause.section) html += ' <span class="deal-info-section-ref">&sect;' + esc(clause.section) + '</span>';
            html += '</label>';
            html += '<div class="manual-offset-inputs">';
            html += '<input type="number" min="0" max="365" name="offset_' + esc(clause.id) + '" id="offset-' + esc(clause.id) + '" placeholder="days" class="offset-number-input" value="' + esc(String(val)) + '">';
            html += '<select name="offset_kind_' + esc(clause.id) + '" class="offset-kind-select">';
            html += '<option value="calendar"' + (kind === 'calendar' ? ' selected' : '') + '>Calendar</option>';
            html += '<option value="business"' + (kind === 'business' ? ' selected' : '') + '>Business</option>';
            html += '</select></div></div>';
        });
        html += '</div></div></details>';

        // Financial Fields
        html += '<details class="manual-section"><summary class="manual-section-title">Financial Terms (Optional)</summary>';
        html += '<div class="manual-section-body"><div class="grid">';
        CLAUSE_MAP.financial_fields.forEach(function (field) {
            var val = '';
            if (deal.manual_entry && deal.manual_entry.financials) {
                deal.manual_entry.financials.forEach(function (f) {
                    if (f.field_id === field.id && f.value) val = f.value;
                });
            }
            html += '<label><span class="form-label">' + esc(field.label) + '</span>';
            html += '<input type="text" name="financial_' + esc(field.id) + '" id="financial-' + esc(field.id) + '" placeholder="e.g. 415000.00" value="' + esc(val) + '"></label>';
        });
        html += '</div></div></details>';

        // Text Fields
        var longFields = ['special_stipulations', 'personal_property_included', 'items_excluded', 'title_expenses'];
        html += '<details class="manual-section"><summary class="manual-section-title">Contract Terms (Optional)</summary>';
        html += '<div class="manual-section-body">';
        CLAUSE_MAP.text_fields.forEach(function (field) {
            var val = '';
            if (deal.manual_entry && deal.manual_entry.text_fields) {
                deal.manual_entry.text_fields.forEach(function (t) {
                    if (t.field_id === field.id && t.value) val = t.value;
                });
            }
            html += '<label style="display:block; margin-bottom:0.75rem;"><span class="form-label">' + esc(field.label);
            if (field.section) html += ' <span class="deal-info-section-ref">&sect;' + esc(field.section) + '</span>';
            html += '</span>';
            if (longFields.indexOf(field.id) >= 0) {
                html += '<textarea name="text_' + esc(field.id) + '" id="text-' + esc(field.id) + '" rows="3">' + esc(val) + '</textarea>';
            } else {
                html += '<input type="text" name="text_' + esc(field.id) + '" id="text-' + esc(field.id) + '" value="' + esc(val) + '">';
            }
            html += '</label>';
        });
        html += '</div></details>';

        html += '<button type="submit" class="gold-btn" id="manual-submit-btn" style="margin-top: 1rem;">Generate Timeline</button>';
        html += '</form></div>';

        return html;
    }

    // -----------------------------------------------------------------------
    // Tab: Timeline
    // -----------------------------------------------------------------------

    function renderTimelineTab(deal) {
        var events = (deal.events || []).filter(function (e) { return e.event_type !== 'info'; });
        // Sort by date (nulls last)
        events.sort(function (a, b) {
            if (!a.event_date && !b.event_date) return 0;
            if (!a.event_date) return 1;
            if (!b.event_date) return -1;
            return a.event_date.localeCompare(b.event_date);
        });

        var html = '<div class="tab-section">';
        html += '<div class="calendar-header"><h3 class="section-title" style="margin:0;">Timeline Events</h3>';
        if (events.length > 0) {
            html += '<div class="header-btn-group">';
            html += '<button type="button" class="btn-outline btn-sm" id="pdf-export-btn">\uD83D\uDCC4 Deal Card</button>';
            html += '<button type="button" class="btn-outline btn-sm ics-export-btn" id="ics-export-btn">\uD83D\uDCC5 Export .ics</button>';
            html += '<button type="button" class="btn-outline btn-sm gcal-all-btn" id="gcal-all-btn">';
            html += '<img src="https://www.gstatic.com/images/branding/product/1x/calendar_2020q4_24dp.png" alt="" class="gcal-icon"> Add to Google</button>';
            html += '</div>';
        }
        html += '</div>';

        if (events.length === 0) {
            html += '<div class="empty-state"><div class="empty-icon">\uD83D\uDCC5</div><h3>No timeline events</h3>';
            html += '<p>Use Manual Entry to enter contract dates and generate timeline events.</p></div>';
        } else {
            html += '<div class="timeline-table-wrap"><table class="timeline-table"><thead><tr>';
            html += '<th>Date</th><th>Event</th><th>Type</th><th>Actions</th></tr></thead><tbody>';

            events.forEach(function (event) {
                html += '<tr>';
                // Date
                html += '<td class="event-date">';
                if (event.event_date) {
                    html += esc(Materializer.formatDateDisplay(event.event_date));
                    var gcalUrl = Calendar.buildGCalURL(event, deal);
                    if (gcalUrl) {
                        html += ' <a href="' + esc(gcalUrl) + '" target="_blank" rel="noopener" class="gcal-link" data-gcal-url="' + esc(gcalUrl) + '">+ GCal</a>';
                    }
                } else {
                    html += '<span class="text-muted">TBD</span>';
                }
                html += '</td>';

                // Title
                html += '<td class="event-title">' + esc(event.title);
                // Offset edit button for deadline events with basis
                if (event.event_type === 'deadline' && event.basis) {
                    html += ' <span class="offset-edit-area">';
                    html += '<button type="button" class="offset-edit-btn" data-event-id="' + esc(event.id) + '" data-basis=\'' + esc(JSON.stringify(event.basis)) + '\' title="Edit offset days">\u270E</button>';
                    html += '<span class="offset-edit-widget" id="offset-widget-' + esc(event.id) + '" style="display:none;">';
                    html += '<input type="number" min="1" max="365" id="offset-input-' + esc(event.id) + '" class="offset-number-input">';
                    html += '<button type="button" class="gold-btn offset-save-btn" data-event-id="' + esc(event.id) + '">Save</button>';
                    html += '<button type="button" class="offset-cancel-btn" data-event-id="' + esc(event.id) + '">Cancel</button>';
                    html += '</span></span>';
                }
                html += '</td>';

                // Type badge
                html += '<td><span class="event-type-badge event-type-' + esc(event.event_type) + '">' + esc(event.event_type) + '</span></td>';

                // Actions (just GCal link)
                html += '<td>';
                if (event.event_date) {
                    var gUrl = Calendar.buildGCalURL(event, deal);
                    if (gUrl) {
                        html += '<a href="' + esc(gUrl) + '" target="_blank" rel="noopener" class="btn-outline btn-sm" style="font-size:0.7rem;padding:0.15rem 0.5rem;">GCal</a>';
                    }
                }
                html += '</td></tr>';
            });

            html += '</tbody></table></div>';
        }

        html += '</div>';
        return html;
    }

    // -----------------------------------------------------------------------
    // Tab: Calendar
    // -----------------------------------------------------------------------

    function renderCalendarTab(deal, year, month) {
        var now = new Date();
        if (!year) year = now.getFullYear();
        if (!month) month = now.getMonth() + 1;

        var prevMonth = month === 1 ? 12 : month - 1;
        var prevYear = month === 1 ? year - 1 : year;
        var nextMonth = month === 12 ? 1 : month + 1;
        var nextYear = month === 12 ? year + 1 : year;

        var eventsByDay = Calendar.buildEventsByDay(deal.events, year, month);
        var weeks = Calendar.monthCalendar(year, month);
        var monthName = Calendar.getMonthName(month);

        // Count TBD events
        var tbdCount = (deal.events || []).filter(function (e) {
            return !e.event_date && e.event_type !== 'info';
        }).length;

        var html = '<div class="tab-section">';

        // Header with export buttons
        html += '<div class="calendar-header"><h3 class="section-title">Calendar View</h3>';
        html += '<div class="header-btn-group">';
        html += '<button type="button" class="btn-outline btn-sm" id="pdf-export-btn-cal">\uD83D\uDCC4 Deal Card</button>';
        html += '<button type="button" class="btn-outline btn-sm ics-export-btn" id="ics-export-btn-cal">\uD83D\uDCC5 Export .ics</button>';
        html += '<button type="button" class="btn-outline btn-sm gcal-all-btn" id="gcal-all-btn-cal">';
        html += '<img src="https://www.gstatic.com/images/branding/product/1x/calendar_2020q4_24dp.png" alt="" class="gcal-icon"> Add to Google</button>';
        html += '</div></div>';

        // Nav
        html += '<div class="calendar-nav">';
        html += '<button class="btn-outline btn-sm" data-cal-nav="prev" data-year="' + prevYear + '" data-month="' + prevMonth + '">&larr; Prev</button>';
        html += '<span class="calendar-month-label">' + esc(monthName) + ' ' + year + '</span>';
        html += '<button class="btn-outline btn-sm" data-cal-nav="next" data-year="' + nextYear + '" data-month="' + nextMonth + '">Next &rarr;</button>';
        html += '</div>';

        // Grid
        html += '<div class="calendar-grid">';
        // Day headers
        ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(function (d) {
            html += '<div class="calendar-dow">' + d + '</div>';
        });

        // Day cells
        weeks.forEach(function (week) {
            week.forEach(function (day) {
                if (day === 0) {
                    html += '<div class="calendar-day calendar-day-empty"></div>';
                } else {
                    var isToday = (now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day);
                    var hasEvents = eventsByDay[day] && eventsByDay[day].length > 0;
                    var cls = 'calendar-day';
                    if (isToday) cls += ' calendar-day-today';
                    if (hasEvents) cls += ' calendar-day-has-events';

                    html += '<div class="' + cls + '">';
                    html += '<span class="calendar-day-number">' + day + '</span>';
                    if (hasEvents) {
                        html += '<div class="calendar-day-events">';
                        eventsByDay[day].forEach(function (evt) {
                            var title = evt.title.length > 22 ? evt.title.substring(0, 20) + '\u2026' : evt.title;
                            html += '<div class="calendar-event calendar-event-' + esc(evt.event_type) + '" title="' + esc(evt.title) + '">';
                            html += '<span class="calendar-event-dot"></span>';
                            html += '<span class="calendar-event-label">' + esc(title) + '</span>';
                            var gcUrl = Calendar.buildGCalURL(evt, deal);
                            if (gcUrl) {
                                html += '<a href="' + esc(gcUrl) + '" target="_blank" rel="noopener" class="gcal-link-cal" data-gcal-url="' + esc(gcUrl) + '">+</a>';
                            }
                            html += '</div>';
                        });
                        html += '</div>';
                    }
                    html += '</div>';
                }
            });
        });
        html += '</div>';

        if (tbdCount > 0) {
            html += '<div class="calendar-tbd-note"><span class="text-muted">' + tbdCount + ' event' + (tbdCount !== 1 ? 's' : '') + ' with no date (TBD) \u2014 not shown on calendar.</span></div>';
        }

        html += '</div>';
        return html;
    }

    // -----------------------------------------------------------------------
    // Tab: Deal Info
    // -----------------------------------------------------------------------

    function renderDealInfoTab(deal) {
        var items = deal.info_items || [];

        var html = '<div class="tab-section">';
        html += '<h3 class="section-title">Deal Information</h3>';
        html += '<p class="text-sm muted" style="margin-top:-0.5rem; margin-bottom:1.25rem;">Contract terms and financial details.</p>';

        if (items.length === 0) {
            html += '<div class="empty-state"><div class="empty-icon">\uD83D\uDCCB</div><h3>No deal info yet</h3>';
            html += '<p>Use Manual Entry to add contract terms and financial details.</p></div>';
        } else {
            html += '<div class="deal-info-section"><h4 class="deal-info-section-title">Contract Terms</h4>';
            html += '<div class="deal-info-grid">';
            items.forEach(function (item) {
                var isWide = item.value && item.value.length > 60;
                html += '<div class="deal-info-card' + (isWide ? ' deal-info-card-wide' : '') + '">';
                html += '<div class="deal-info-label">' + esc(item.label);
                if (item.section) html += '<span class="deal-info-section-ref">\u00A7' + esc(item.section) + '</span>';
                html += '</div>';
                html += '<div class="deal-info-value' + (isWide ? ' deal-info-value-long' : '') + '">' + esc(item.value || '\u2014') + '</div>';
                html += '</div>';
            });
            html += '</div></div>';
        }

        html += '</div>';
        return html;
    }

    // -----------------------------------------------------------------------
    // Tab: Tasks
    // -----------------------------------------------------------------------

    function renderTasksTab(deal) {
        var tasks = deal.tasks || [];

        var html = '<div class="tab-section">';
        html += '<h3 class="section-title">Task Checklist';
        if (tasks.length > 0) {
            html += '<span class="section-count">' + tasks.length + ' task' + (tasks.length !== 1 ? 's' : '') + '</span>';
        }
        html += '</h3>';

        if (tasks.length === 0) {
            html += '<div class="empty-state"><div class="empty-icon">\u2705</div><h3>No tasks yet</h3>';
            html += '<p>Tasks will appear after entering contract data via Manual Entry.</p></div>';
        } else {
            // Group by category
            var catOrder = ['inspection', 'financing', 'closing', 'repair', 'other'];
            var catIcons = { inspection: '\uD83D\uDD0D', financing: '\uD83D\uDCB0', closing: '\uD83C\uDFE0', repair: '\uD83D\uDD27', other: '\uD83D\uDCCC' };
            var byCategory = {};
            tasks.forEach(function (t) {
                var cat = t.category || 'other';
                if (!byCategory[cat]) byCategory[cat] = [];
                byCategory[cat].push(t);
            });

            catOrder.forEach(function (cat) {
                if (!byCategory[cat] || byCategory[cat].length === 0) return;
                var icon = catIcons[cat] || '\uD83D\uDCCC';
                var catTasks = byCategory[cat];

                html += '<div class="task-category">';
                html += '<h4 class="category-title"><span class="category-icon">' + icon + '</span> ' + cat.charAt(0).toUpperCase() + cat.slice(1);
                html += ' <span class="category-count">(' + catTasks.length + ')</span></h4>';
                html += '<div class="task-items">';

                catTasks.forEach(function (task) {
                    html += '<div class="task-item task-status-' + esc(task.status) + '" data-task-id="' + esc(task.id) + '">';
                    html += '<button class="task-toggle" data-task-id="' + esc(task.id) + '" data-status="' + esc(task.status) + '" title="Toggle status">';
                    if (task.status === 'done') {
                        html += '<span class="task-check done">\u2713</span>';
                    } else if (task.status === 'doing') {
                        html += '<span class="task-check doing">\u25D0</span>';
                    } else {
                        html += '<span class="task-check todo">\u25CB</span>';
                    }
                    html += '</button>';
                    html += '<div class="task-content"><div class="task-title">' + esc(task.title) + '</div>';
                    if (task.description) {
                        html += '<div class="task-desc">' + esc(task.description) + '</div>';
                    }
                    html += '<div class="task-meta">';
                    if (task.due_date) {
                        html += '<span class="task-due">\uD83D\uDCC5 ' + esc(Materializer.formatDateDisplay(task.due_date)) + '</span>';
                    }
                    html += '</div></div></div>';
                });

                html += '</div></div>';
            });
        }

        html += '</div>';
        return html;
    }

    // -----------------------------------------------------------------------
    // Toast notifications
    // -----------------------------------------------------------------------

    // Exposed globally as showToast (see bottom)

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    return {
        esc: esc,
        renderNav: renderNav,
        renderDealList: renderDealList,
        renderArchiveToggle: renderArchiveToggle,
        renderDealPage: renderDealPage,
        renderManualEntryTab: renderManualEntryTab,
        renderTimelineTab: renderTimelineTab,
        renderCalendarTab: renderCalendarTab,
        renderDealInfoTab: renderDealInfoTab,
        renderTasksTab: renderTasksTab
    };
})();

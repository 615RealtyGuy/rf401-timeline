/* RF401 Contract Timeline — Date Calculation Engine
   Ported from app/services/materializer.py */

var Materializer = (function () {

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function _generateId() {
        if (crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function _parseDate(str) {
        if (!str) return null;
        // Parse YYYY-MM-DD string as local date (not UTC)
        var parts = str.split('-');
        if (parts.length !== 3) return null;
        var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return isNaN(d.getTime()) ? null : d;
    }

    function _formatDate(date) {
        if (!date) return null;
        var y = date.getFullYear();
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    function _formatDateDisplay(dateStr) {
        if (!dateStr) return 'TBD';
        var d = _parseDate(dateStr);
        if (!d) return dateStr;
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function _getClauseMeta(clauseId) {
        if (!CLAUSE_MAP || !CLAUSE_MAP.clauses) return {};
        for (var i = 0; i < CLAUSE_MAP.clauses.length; i++) {
            if (CLAUSE_MAP.clauses[i].id === clauseId) return CLAUSE_MAP.clauses[i];
        }
        return {};
    }

    function _getAnchorMeta(anchorId) {
        if (!CLAUSE_MAP || !CLAUSE_MAP.anchors) return {};
        for (var i = 0; i < CLAUSE_MAP.anchors.length; i++) {
            if (CLAUSE_MAP.anchors[i].id === anchorId) return CLAUSE_MAP.anchors[i];
        }
        return {};
    }

    // -----------------------------------------------------------------------
    // Core date computation (port of _compute_deadline)
    // -----------------------------------------------------------------------

    function computeDeadline(bindingDate, offsetValue, direction, offsetKind) {
        if (!bindingDate || !offsetValue) return null;

        var days = offsetValue;
        if (offsetKind === 'business') {
            // Same approximation as Python: 5 business days ~ 7 calendar days
            days = Math.round(offsetValue * 7 / 5);
        }

        var result = new Date(bindingDate.getTime()); // clone
        if (direction === 'before') {
            result.setDate(result.getDate() - days);
        } else {
            // "after" is the default
            result.setDate(result.getDate() + days);
        }
        return result;
    }

    // -----------------------------------------------------------------------
    // Resolve anchor dates (port of _resolve_anchor_date)
    // -----------------------------------------------------------------------

    function _resolveAnchorDate(value, anchorId, anchors) {
        if (!value) return null;

        // Special: possession "at_closing" -> inherit closing_date
        if (value === 'at_closing') {
            for (var i = 0; i < anchors.length; i++) {
                if (anchors[i].anchor_id === 'closing_date' && anchors[i].value) {
                    return _parseDate(anchors[i].value);
                }
            }
            return null;
        }

        return _parseDate(value);
    }

    // -----------------------------------------------------------------------
    // Parse binding date from anchors
    // -----------------------------------------------------------------------

    function _parseBindingDate(anchors, badOverride) {
        if (badOverride) {
            var d = _parseDate(badOverride);
            if (d) return d;
        }
        if (!anchors) return null;
        for (var i = 0; i < anchors.length; i++) {
            if (anchors[i].anchor_id === 'binding_agreement_date' && anchors[i].value) {
                var d2 = _parseDate(anchors[i].value);
                if (d2) return d2;
            }
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // Apply overrides (port of _apply_overrides)
    // -----------------------------------------------------------------------

    function _applyOverrides(offsets, overrides) {
        if (!overrides || !overrides.offsets) return offsets;
        var offsetOverrides = overrides.offsets;

        return offsets.map(function (offset) {
            var clauseId = offset.clause_id;
            if (clauseId && offsetOverrides[clauseId]) {
                // Clone and apply override fields
                var patched = {};
                for (var k in offset) {
                    if (offset.hasOwnProperty(k)) patched[k] = offset[k];
                }
                var overrideFields = offsetOverrides[clauseId];
                for (var ok in overrideFields) {
                    if (overrideFields.hasOwnProperty(ok)) patched[ok] = overrideFields[ok];
                }
                return patched;
            }
            return offset;
        });
    }

    // -----------------------------------------------------------------------
    // Create anchor events (milestones)
    // -----------------------------------------------------------------------

    function _createAnchorEvents(anchors, bindingDate) {
        if (!anchors) return [];
        var events = [];

        for (var i = 0; i < anchors.length; i++) {
            var anchor = anchors[i];
            var eventDate = _resolveAnchorDate(anchor.value, anchor.anchor_id, anchors);

            // If BAD anchor has no value, use binding date override
            if (!eventDate && anchor.anchor_id === 'binding_agreement_date' && bindingDate) {
                eventDate = bindingDate;
            }

            var meta = _getAnchorMeta(anchor.anchor_id);
            var title = meta.label || anchor.anchor_id;
            if (anchor.value === 'at_closing') {
                title = title + ' (at Closing)';
            }

            events.push({
                id: _generateId(),
                title: title,
                event_date: _formatDate(eventDate),
                event_type: 'milestone',
                basis: null,
                source_quote: 'Manual entry'
            });
        }

        return events;
    }

    // -----------------------------------------------------------------------
    // Create offset events and tasks (deadlines)
    // -----------------------------------------------------------------------

    function _createOffsetEventsAndTasks(offsets, bindingDate) {
        var events = [];
        var tasks = [];

        for (var i = 0; i < offsets.length; i++) {
            var offset = offsets[i];
            var trigger = offset.trigger;
            var deadline = null;

            // Only compute from BAD if trigger is binding_agreement_date
            if (trigger && trigger === 'binding_agreement_date') {
                deadline = computeDeadline(
                    bindingDate,
                    offset.offset_value,
                    offset.direction,
                    offset.offset_kind
                );
            }

            var deadlineStr = _formatDate(deadline);
            var meta = _getClauseMeta(offset.clause_id);
            var label = meta.label || offset.clause_id || 'Unknown Deadline';

            // Build offset description
            var offsetDesc = '';
            if (offset.offset_value) {
                var kind = offset.offset_kind || 'calendar';
                var dir = offset.direction || 'after';
                var trig = offset.trigger || 'binding agreement date';
                offsetDesc = offset.offset_value + ' ' + kind + ' days ' + dir + ' ' + trig;
            }

            // Event
            events.push({
                id: _generateId(),
                title: label,
                event_date: deadlineStr,
                event_type: 'deadline',
                basis: {
                    clause_id: offset.clause_id,
                    offset_value: offset.offset_value,
                    offset_kind: offset.offset_kind,
                    direction: offset.direction,
                    trigger: offset.trigger || 'binding_agreement_date',
                    binding_date: _formatDate(bindingDate)
                },
                source_quote: 'Manual entry'
            });

            // Task
            var taskDesc = offsetDesc || null;
            if (meta.section) {
                var sectionNote = 'Section: ' + meta.section;
                taskDesc = taskDesc ? sectionNote + '. ' + taskDesc : sectionNote;
            }

            tasks.push({
                id: _generateId(),
                title: label,
                description: taskDesc,
                due_date: deadlineStr,
                status: 'todo',
                category: meta.category || 'other'
            });
        }

        return { events: events, tasks: tasks };
    }

    // -----------------------------------------------------------------------
    // Create info items from financials and text fields
    // -----------------------------------------------------------------------

    function _createFinancialInfoItems(financials) {
        if (!financials) return [];
        var items = [];
        for (var i = 0; i < financials.length; i++) {
            var fin = financials[i];
            if (!fin.value) continue;
            var meta = {};
            if (CLAUSE_MAP && CLAUSE_MAP.financial_fields) {
                for (var j = 0; j < CLAUSE_MAP.financial_fields.length; j++) {
                    if (CLAUSE_MAP.financial_fields[j].id === fin.field_id) {
                        meta = CLAUSE_MAP.financial_fields[j];
                        break;
                    }
                }
            }
            items.push({
                id: _generateId(),
                label: meta.label || fin.field_id,
                value: fin.value,
                field_id: fin.field_id,
                section: meta.section || null
            });
        }
        return items;
    }

    function _createTextFieldInfoItems(textFields) {
        if (!textFields) return [];
        var items = [];
        for (var i = 0; i < textFields.length; i++) {
            var tf = textFields[i];
            if (!tf.value) continue;
            var meta = {};
            if (CLAUSE_MAP && CLAUSE_MAP.text_fields) {
                for (var j = 0; j < CLAUSE_MAP.text_fields.length; j++) {
                    if (CLAUSE_MAP.text_fields[j].id === tf.field_id) {
                        meta = CLAUSE_MAP.text_fields[j];
                        break;
                    }
                }
            }
            items.push({
                id: _generateId(),
                label: meta.label || tf.field_id,
                value: tf.value,
                field_id: tf.field_id,
                section: meta.section || null
            });
        }
        return items;
    }

    // -----------------------------------------------------------------------
    // Main materialize function
    // -----------------------------------------------------------------------

    function materialize(deal) {
        var manualEntry = deal.manual_entry;
        if (!manualEntry) {
            return { events: [], tasks: [], infoItems: [] };
        }

        // Apply overrides to offsets
        var offsets = _applyOverrides(manualEntry.offsets || [], deal.overrides || {});

        // Parse binding date
        var bindingDate = _parseBindingDate(manualEntry.anchors, deal.binding_agreement_date);

        // Create anchor events (milestones)
        var anchorEvents = _createAnchorEvents(manualEntry.anchors, bindingDate);

        // Create offset events (deadlines) + tasks
        var result = _createOffsetEventsAndTasks(offsets, bindingDate);

        // Create info items from financials + text fields
        var infoItems = _createFinancialInfoItems(manualEntry.financials || [])
            .concat(_createTextFieldInfoItems(manualEntry.text_fields || []));

        var allEvents = anchorEvents.concat(result.events);

        return {
            events: allEvents,
            tasks: result.tasks,
            infoItems: infoItems
        };
    }

    /**
     * Re-materialize preserving existing task statuses.
     */
    function rematerialize(deal) {
        // Build status map from existing tasks
        var statusMap = {};
        (deal.tasks || []).forEach(function (t) {
            statusMap[t.title] = t.status;
        });

        var result = materialize(deal);

        // Restore user-set statuses
        result.tasks.forEach(function (t) {
            if (statusMap[t.title]) {
                t.status = statusMap[t.title];
            }
        });

        return result;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    return {
        materialize: materialize,
        rematerialize: rematerialize,
        computeDeadline: computeDeadline,
        formatDateDisplay: _formatDateDisplay,
        parseDate: _parseDate,
        formatDate: _formatDate
    };
})();

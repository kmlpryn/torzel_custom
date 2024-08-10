// Global variable to store cached linked Gate Passes
let linkedGatePassesCache = null;

frappe.ui.form.on('Purchase Order', {
    refresh: function (frm) {
        // Setting custom query for custom_gate_pass field with caching logic
        frm.set_query("custom_gate_pass", function () {
            // If cache is present, use it directly
            if (linkedGatePassesCache) {
                return {
                    "filters": [
                        ["Gate Pass", "docstatus", "=", 1],
                        ["Gate Pass", "supplier", "=", frm.doc.supplier],
                        ['name', 'not in', linkedGatePassesCache]
                    ]
                };
            }
            // If no cache, fetch from server and then set the query
            return getLinkedGatePasses(frm.doc.supplier).then(linkedGatePasses => {
                // Populate cache
                linkedGatePassesCache = linkedGatePasses;
                return {
                    "filters": [
                        ["Gate Pass", "docstatus", "=", 1],
                        ["Gate Pass", "supplier", "=", frm.doc.supplier],
                        ['name', 'not in', linkedGatePasses]
                    ]
                };
            });
        });
    },
    custom_gate_pass: function (frm) {
        if (frm.doc.custom_gate_pass) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Gate Pass",
                    name: frm.doc.custom_gate_pass,
                    fields: ["total_gw_qty"]
                },
                callback: function (data) {
                    if (data.message) {
                        frm.set_value("custom_total_gross_weight_quantity", data.message.total_gw_qty);
                    } else {
                        frappe.msgprint(__('Gate Pass not found'));
                    }
                },
                error: function (err) {
                    frappe.msgprint(__('An error occurred while fetching Gate Pass data.'));
                    console.error(err);
                }
            });
        }

    },
    supplier_name: function (frm) {
        // Invalidate cache when supplier changes
        linkedGatePassesCache = null;
        frm.set_value("custom_gate_pass", "");
        frm.set_value("custom_total_gross_weight_quantity", null);
    },
    validate: function (frm) {
        let total_po_qty = parseFloat(frm.doc.total_qty || 0);
        let total_gw_qty = parseFloat(frm.doc.custom_total_gross_weight_quantity || 0);

        if (total_po_qty > total_gw_qty) {
            frappe.msgprint({
                title: __('Validation Error'),
                indicator: 'red',
                message: __('Total PO Quantity should not be greater than Gate Pass accepted Quantity')
            });
            frappe.validated = false;
        }
    }
})

// Function for excluding already attached Gate Passes 
// using async to not block UI
// Function to fetch already linked Gate Passes for a supplier
function getLinkedGatePasses(supplier) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Purchase Order",
                filters: {
                    supplier: supplier,
                    docstatus: ["!=", 2]  // Exclude cancelled Purchase Orders
                },
                fields: ["custom_gate_pass"]
            },
            callback: function (data) {
                if (data.message) {
                    let linkedGatePasses = data.message.map(po => po.custom_gate_pass);
                    resolve(linkedGatePasses);
                } else {
                    resolve([]);
                }
            },
            error: function (err) {
                frappe.msgprint(__('Failed to fetch linked Gate Passes'));
                reject(err);
            }
        });
    });
}


// Global variable to store cached linked Gate Passes
let linkedGatePassesCache = null;

frappe.ui.form.on('Purchase Order', {
    refresh: function (frm) {
        frm.set_query("custom_gate_pass", function () {

            if (!frm.doc.supplier) {
                frappe.msgprint(__('Please select a supplier first.'));
                return false;
            }

            // Directly fetch and apply filters without caching for simplicity
            return {
                filters: [
                    ["Gate Pass", "docstatus", "=", 1],
                    ["Gate Pass", "supplier", "=", frm.doc.supplier],
                    ['name', 'not in', getLinkedGatePassesSync(frm.doc.supplier)]
                ]
            };
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

frappe.ui.form.on('Purchase Order Item', {
    custom_gross_weight: function (frm, cdt, cdn) {
        calculateQty(frm, cdt, cdn);
    },
    custom_tare_weight: function (frm, cdt, cdn) {
        calculateQty(frm, cdt, cdn);
    }
});

function calculateQty(frm, cdt, cdn) {
    let row = locals[cdt][cdn]; // Access the current child row

    let gross_weight = row.custom_gross_weight;
    let tare_weight = row.custom_tare_weight;

    if (gross_weight && tare_weight) {
        let net_weight = gross_weight - tare_weight;
        frappe.model.set_value(cdt, cdn, 'qty', net_weight); // Set the 'qty' field in the child table row
    } else {
        frappe.model.set_value(cdt, cdn, 'qty', '');
    }

    frm.refresh_field('items'); // Refresh the child table
}

// Function for excluding already attached Gate Passes 
// Function to fetch already linked Gate Passes for a supplier
// Synchronous function to fetch linked Gate Passes
function getLinkedGatePassesSync(supplier) {
    let linkedGatePasses = [];
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
        async: false, // Synchronous call to ensure filter is applied immediately
        callback: function (result) {
            if (result.message) {
                linkedGatePasses = result.message.map(po => po.custom_gate_pass).filter(po => !!po);
            } else {
                console.log("No linked Gate Passes found");
            }
        },
        error: function (error) {
            frappe.msgprint(__('Failed to fetch linked Gate Passes'));
            console.error("Error fetching linked Gate Passes: ", error);
        }
    });
    return linkedGatePasses;
}
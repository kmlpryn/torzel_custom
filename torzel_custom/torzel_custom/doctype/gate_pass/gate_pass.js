// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt

frappe.ui.form.on("Gate Pass", {
    gross_weight: function (frm) {
        updateTareWeight(frm);
        differenceQty(frm);
    },
    net_weight: function (frm) {
        updateTareWeight(frm);
    },
    total_bags: function (frm) {
        differenceBags(frm);
    },
    bag_no: function (frm) {
        differenceBags(frm);
    },
    total_gw_qty: function (frm) {
        differenceQty(frm);
    },
    validate: function (frm) {
        let gross_weight = frm.doc.gross_weight;
        let net_weight = frm.doc.net_weight;

        if (gross_weight < net_weight) {
            frappe.msgprint(__("Gross Weight cannot be less than Net Weight"));
            frappe.validated = false;
        }
    }
});

function differenceQty(frm) {
    let total_gw_qty = frm.doc.total_gw_qty;
    let gross_weight = frm.doc.gross_weight;

    if (gross_weight && total_gw_qty) {
        let diff_qty = gross_weight - total_gw_qty;
        frm.set_value('difference_gw', diff_qty);
    } else {
        frm.set_value('difference_gw', '');
    }

    frm.refresh_field('difference_gw');
}

function differenceBags(frm) {
    let bag_no = frm.doc.bag_no;
    let total_bags = frm.doc.total_bags;

    if (bag_no && total_bags) {
        let diff_bags = bag_no - total_bags;
        frm.set_value('difference_bags', diff_bags);
    } else {
        frm.set_value('difference_bags', '');
    }

    frm.refresh_field('difference_bags');
}

function updateTareWeight(frm) {
    let gross_weight = frm.doc.gross_weight;
    let net_weight = frm.doc.net_weight;

    if (gross_weight && net_weight) {
        let tare_weight = gross_weight - net_weight;
        frm.set_value('tare_weight', tare_weight);
    } else {
        frm.set_value('tare_weight', '');
    }

    frm.refresh_field('tare_weight');
}

frappe.ui.form.on('Gate Pass Item', {
    bags_no: function (frm) {
        calculateQty(frm);
    },
    gate_pass_item_table_remove: function (frm) {
        calculateQty(frm);
        calculateGrossQty(frm);
    },
    gross_qty: function (frm) {
        calculateGrossQty(frm);
    }
});

function calculateQty(frm) {
    console.log(frm)
    let totalBags = 0;

    (frm.doc.gate_pass_item_table || []).forEach((item) => {
        totalBags += item.bags_no || 0;
    });

    frm.set_value('total_bags', totalBags);
}

function calculateGrossQty(frm) {
    let totalGrossQty = 0;

    (frm.doc.gate_pass_item_table || []).forEach((item) => {
        totalGrossQty += item.gross_qty || 0;
    });

    frm.set_value('total_gw_qty', totalGrossQty);
}


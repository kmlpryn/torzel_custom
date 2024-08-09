// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt



frappe.ui.form.on('Sauda Item', {
    quantity: function (frm) {
        calculateTotalQty(frm);
    }
});

function calculateTotalQty(frm) {
    let totalQuanity = 0;

    (frm.doc.sauda_item_table || []).forEach((item) => {
        totalQuanity += item.quantity || 0;
    });

    frm.set_value('total_quantity', totalQuanity);
}



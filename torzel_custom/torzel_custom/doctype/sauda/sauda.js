// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt


frappe.ui.form.on('Sauda Item', {
    rate: function (frm, cdt, cdn) {
        calculateAmount(frm, cdt, cdn)
    },
    quantity: function (frm, cdt, cdn) {
        calculateTotalQty(frm);
        calculateAmount(frm, cdt, cdn)
    },
    amount: function (frm) {
        calculateTotalAmount(frm)
    }
});

function calculateTotalQty(frm) {
    let totalQuantity = 0;

    // Sum the quantity from each item in the sauda_item_table
    (frm.doc.sauda_item_table || []).forEach((item) => {
        totalQuantity += item.quantity || 0;
    });

    // Set the calculated total quantity in the total_quantity field
    frm.set_value('total_quantity', totalQuantity);
}

function calculateTotalAmount(frm) {
    let totalAmount = 0;

    // Sum the amount from each item in the sauda_item_table
    (frm.doc.sauda_item_table || []).forEach((item) => {
        totalAmount += item.amount || 0;
    });

    // Set the calculated total amount in the total_amount field
    frm.set_value('total_amount', totalAmount);
}

function calculateAmount(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    let result = (row.quantity || 0) * (row.rate || 0);

    frappe.model.set_value(cdt, cdn, 'amount', result);
}
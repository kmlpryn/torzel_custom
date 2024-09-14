// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt

frappe.ui.form.on("Gate Pass", {
    refresh: function (frm) {
        frm.set_query("sauda", function () {
            return {
                "filters": [
                    ["Sauda", "docstatus", "=", 1],
                    ["Sauda", "supplier", "=", frm.doc.supplier],
                    ["Sauda", "expiry_date", ">=", frappe.datetime.get_today()],  // Filter out expired Sauda
                ]
            };
        });

        if ("serial" in navigator) {
            setupSerialPort(frm);
        } else {
            frappe.msgprint({
                message: __("Please use Google Chrome browser"),
                title: __("Web Serial API is not supported."),
                indicator: "red",
            });
        }
    },
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

let lastPort = null;
let currentRow = null;

const setupSerialPort = (frm) => {
    // Connect/Disconnect Button
    let connectButton = frm.add_custom_button(__('Connect to Weight Machine'), async function () {
        if (lastPort && lastPort.readable) {
            // Disconnect
            try {
                await disconnectPort();
                connectButton.html(__('Connect to Weight Machine'));
                frappe.msgprint(__('Disconnected from the weight machine.'));
            } catch (err) {
                console.error('Failed to disconnect from the weight machine:', err);
                frappe.msgprint(__('Failed to disconnect from the weight machine.'));
            }
        } else {
            // Connect
            try {
                const port = await navigator.serial.requestPort();
                await connectToPort(port, frm);
                lastPort = port;
                connectButton.html(__('Disconnect from Weight Machine'));
            } catch (err) {
                console.error('Failed to connect to the weight machine:', err);
                frappe.msgprint(__('Failed to connect to the weight machine.'));
            }
        }
    });

    // Capture Weight Button
    frm.add_custom_button(__('Capture Weight'), function () {
        if (currentRow) {
            const grossQty = frappe.model.get_value(currentRow.doctype, currentRow.name, 'gross_qty');
            if (grossQty) {
                frappe.model.set_value(currentRow.doctype, currentRow.name, 'gross_qty', grossQty);
                frappe.msgprint(__('Weight captured and set in gross_qty: ') + grossQty + ' kg');
            } else {
                frappe.msgprint(__('No weight available to capture.'));
            }
        } else {
            frappe.msgprint(__('Please select a row in the Gate Pass Items table.'));
        }
    });
};

const connectToPort = async (port, frm) => {
    await port.open({ baudRate: 9600 });
    frappe.msgprint(__('Connected to the weight machine.'));
    console.log('Port opened:', port);
    startPreviewingWeight(port, frm);
};

const disconnectPort = async () => {
    if (lastPort) {
        await lastPort.close();
        lastPort = null;
        console.log("Port closed");
    }
};

const startPreviewingWeight = async (port, frm) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    try {
        // Continuously read data from the serial device
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                reader.releaseLock();
                break;
            }
            // value is a string.
            const valueArr = (value || "").split(" ");
            for (const val of valueArr) {
                if (!isNaN(+val)) {
                    const weight = val.trim();
                    if (currentRow) {
                        frappe.model.set_value(currentRow.doctype, currentRow.name, 'gross_qty', weight);
                        console.log('Weight preview set in gross_qty:', weight);
                    }
                    break;  // Break to prevent updating multiple values in one read
                }
            }
        }
    } catch (err) {
        console.error('Error reading from the serial device:', err);
        frappe.msgprint(__('Failed to preview weight from the machine.'));
    } finally {
        reader.releaseLock();
        await readableStreamClosed.catch(err => {
            console.error('Stream close failed:', err);
        });
    }
};

frappe.ui.form.on('Gate Pass Item', {
    bags_no: function (frm) {
        calculateQty(frm);
    },
    gate_pass_item_table_remove: function (frm) {
        calculateQty(frm);
        calculateGrossQty(frm);
    },
    gross_qty: function (frm, cdt, cdn) {
        calculateGrossQty(frm);
        currentRow = locals[cdt][cdn];
    }
});

function calculateQty(frm) {
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





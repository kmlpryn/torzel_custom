// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt

frappe.ui.form.on("Gate Pass", {
    refresh: function (frm) {
        // Setting custom query for sauda field 
        frm.set_query("sauda", function () {
            return {
                "filters": [
                    ["Sauda", "docstatus", "=", 1],
                    ["Sauda", "supplier", "=", frm.doc.supplier],
                ]
            };
        });
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

frappe.ui.form.on('Gate Pass Item', {
    refresh: function (frm) {
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

const setupSerialPort = (frm) => {
    let port = null;

    // Add the button to connect/disconnect from the weight machine
    const connectButton = frm.add_custom_button(__('Connect To A Weight Machine'), async function () {
        try {
            if (port) {
                // If already connected, disconnect the port
                await port.close();
                frappe.msgprint(__('Disconnected from the weight machine.'));
                frm.set_df_property('connect_button', 'label', 'Connect To A Weight Machine');
                port = null;
            } else {
                // Prompt user to select a serial port
                port = await navigator.serial.requestPort();
                await port.open({ baudRate: 9600 });
                frappe.msgprint(__('Connected to the weight machine.'));
                frm.set_df_property('connect_button', 'label', 'Disconnect From Weight Machine');
                previewWeightFromPort(port, frm);
            }
        } catch (err) {
            console.error('Failed to connect to the weight machine:', err);
            frappe.msgprint(__('Failed to connect to the weight machine.'));
        }
    });

    connectButton[0].df.fieldname = 'connect_button';

    // Add the button to capture the current weight
    frm.add_custom_button(__('Capture Weight'), function () {
        try {
            const grossWeight = frm.doc.gross_qty;
            if (grossWeight) {
                frappe.msgprint(__('Weight captured: ') + grossWeight + ' kg');
            } else {
                frappe.msgprint(__('No weight preview available to capture.'));
            }
        } catch (err) {
            console.error('Error capturing weight:', err);
            frappe.msgprint(__('Failed to capture weight from the preview.'));
        }
    });
};

const previewWeightFromPort = async (port, frm) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    try {
        // Continuously listen to data coming from the serial device and update the gross_weight field
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
                    frm.set_value('gross_weight', val.trim());
                    console.log('Weight preview:', val.trim());
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



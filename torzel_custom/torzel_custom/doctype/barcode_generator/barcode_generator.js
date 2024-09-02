frappe.ui.form.on("Barcode Generator", {
    refresh(frm) {
        if ("serial" in navigator) {
            setupSerialPort(frm);
        } else {
            frappe.msgprint({
                message: __("Please use Google Chrome browser"),
                title: __("Web Serial API is not supported."),
                indicator: "red",
            });
        }
    }
});

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
            const grossWeight = frm.doc.gross_weight;
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

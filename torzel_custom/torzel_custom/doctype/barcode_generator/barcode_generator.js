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
    let lastPort = null;

    // Connect/Disconnect Button
    let connectButton = frm.add_custom_button(__('Connect to Weight Machine'), async function () {
        if (lastPort && lastPort.readable) {
            // Disconnect
            try {
                await lastPort.close();
                lastPort = null;
                connectButton.html(__('Connect to Weight Machine'));
                frappe.msgprint(__('Disconnected from the weight machine.'));
                frm.set_value('gross_weight', '');
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
                startPreviewingWeight(port, frm);
            } catch (err) {
                console.error('Failed to connect to the weight machine:', err);
                frappe.msgprint(__('Failed to connect to the weight machine.'));
            }
        }
    });

    // Capture Weight Button
    frm.add_custom_button(__('Capture Weight'), function () {
        const grossWeight = frm.doc.gross_weight;
        if (grossWeight) {
            frappe.msgprint(__('Weight captured: ') + grossWeight + ' kg');
        } else {
            frappe.msgprint(__('No weight available to capture.'));
        }
    });
};

const connectToPort = async (port, frm) => {
    await port.open({ baudRate: 9600 });
    frappe.msgprint(__('Connected to the weight machine.'));
    console.log('Port opened:', port);
};

const startPreviewingWeight = async (port, frm) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    try {
        // Continuously read data from the serial device and update the gross_weight field
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

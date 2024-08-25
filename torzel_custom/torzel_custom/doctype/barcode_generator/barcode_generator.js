// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt
frappe.ui.form.on("Barcode Generator", {
    refresh(frm) {
        getWeightFromSerialPort(frm);
    }
});


const getWeightFromSerialPort = (frm) => {
    let lastPort = null; // Store the last connected port


    if ("serial" in navigator) {
        // The Web Serial API is supported.
        (async () => {
            try {
                let port = null;

                if (lastPort && !lastPort.readable.locked) {
                    port = lastPort;
                    frappe.msgprint(__('Reusing the last connected weight machine.'));
                }
                else {
                    frm.add_custom_button(__('Connect To A Weight Machine'), async function () {
                        try {
                            // Prompt user to select any serial port.
                            port = await navigator.serial.requestPort();
                            // Wait for the serial port to open.
                            await port.open({ baudRate: 9600 });
                            lastPort = port; // Save the connected port
                        } catch (err) {
                            console.error('Failed to connect to the weight machine:', err);
                            frappe.msgprint(__('Failed to connect to the weight machine.'));
                        }
                    });
                }

                // Button to capture weight
                frm.add_custom_button(__('Capture Weight'), async function () {
                    if (!port || !port.readable) {
                        frappe.msgprint(__('No connected weight machine found.'));
                        return;
                    }

                    if (port.readable.locked) {
                        frappe.msgprint(__('The port is currently locked. Please try again.'));
                        return;
                    }

                    try {
                        const textDecoder = new TextDecoderStream();
                        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
                        const reader = textDecoder.readable.getReader();

                        // Listen to data coming from the serial device.
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) {
                                reader.releaseLock();
                                break;
                            }
                            // value is a string.
                            console.log(value);
                            const valueArr = (value || "").split(" ");
                            if (valueArr.length > 0) {
                                valueArr.forEach((value) => {
                                    if (!isNaN(+value)) {
                                        frm.set_value('gross_weight', value.trim());
                                        frappe.msgprint(__('Weight captured: ') + value.trim() + ' kg');
                                        reader.cancel();
                                    }
                                })
                            }
                        }

                        await readableStreamClosed.catch((err) => {
                            console.error('Stream close failed:', err);
                        });

                    } catch (err) {
                        console.error('Error reading from the serial device:', err);
                        frappe.msgprint(__('Failed to capture weight from the machine.'));
                    }
                });

                // Button to connect to another machine
                frm.add_custom_button(__('Connect to another machine'), async function () {
                    if (port && port.readable.locked) {
                        frappe.msgprint(__('Please disconnect the current machine before connecting to a new one.'));
                        return;
                    }
                    try {
                        if (port) {
                            await port.close();
                            console.log("Port closed");
                            frappe.msgprint(__('Disconnected from the current weight machine.'));
                        }
                        port = await navigator.serial.requestPort();
                        await port.open({ baudRate: 9600 });
                        lastPort = port; // Save the new connected port
                        frappe.msgprint(__('Connected to a new weight machine.'));
                    } catch (err) {
                        console.error('Failed to connect to the new weight machine:', err);
                        frappe.msgprint(__('Failed to connect to the new weight machine.'));
                    }
                });
            } catch (err) {
                console.error('Error initializing serial connection:', err);
                frappe.msgprint(__('Failed to initialize the serial connection.'));
            }
        })();
    } else {
        frappe.msgprint({
            message: __("Please use Google Chrome browser"),
            title: __("Web Serial API is not supported."),
            indicator: "red",
        });
    }
}

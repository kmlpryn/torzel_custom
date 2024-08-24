// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt
frappe.ui.form.on("Barcode Generator", {
    refresh(frm) {
        // Remove any existing buttons with the same label (optional cleanup)
        frm.clear_custom_buttons();

        let lastPort = null; // Store the last connected port

        if ("serial" in navigator) {
            // The Web Serial API is supported.
            (async () => {
                try {
                    // Get all serial ports the user has previously granted the website access to.
                    const ports = await navigator.serial.getPorts();
                    console.log({ ports });

                    let port = null;

                    if (ports.length === 1) {
                        port = ports[0];
                        await port.open({ baudRate: 9600 });
                        lastPort = port;
                        frappe.msgprint(__('Connected to the last used weight machine.'));
                    } else if (lastPort && !lastPort.readable.locked) {
                        port = lastPort;
                        frappe.msgprint(__('Reusing the last connected weight machine.'));
                    } else {
                        frm.add_custom_button(__('Connect To Weight Machine'), async function () {
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

                        console.log("Is locked after open?", port.readable.locked);
                        const textDecoder = new TextDecoderStream();
                        const reader = port.readable.pipeThrough(textDecoder).getReader();

                        try {
                            // Listen to data coming from the serial device.
                            const { value, done } = await reader.read();
                            if (done) {
                                // Allow the serial port to be closed later.
                                reader.releaseLock();
                            } else {
                                // value is a string.
                                console.log(value);
                                // Set the captured weight in the weight field
                                frm.set_value('gross_weight', value.trim());
                                frappe.msgprint(__('Weight captured: ') + value.trim() + ' kg');
                            }
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
});

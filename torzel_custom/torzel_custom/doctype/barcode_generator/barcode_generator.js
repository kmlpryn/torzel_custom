// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt
frappe.ui.form.on("Barcode Generator", {
    refresh(frm) {

        // Remove any existing buttons with the same label (optional cleanup)
        frm.clear_custom_buttons();

        if ("serial" in navigator) {
            // The Web Serial API is supported.
            (async () => {
                // Get all serial ports the user has previously granted the website access to.
                const ports = await navigator.serial.getPorts();
                console.log({ ports })
                let port = null;

                if (ports.length) {
                    port = ports[0];

                } else {
                    frm.add_custom_button(__('Connect To Weight Machine'), async function () {
                        // Prompt user to select any serial port.
                        port = await navigator.serial.requestPort();
                        // Wait for the serial port to open.
                        await port.open({ baudRate: 9600 });
                    });
                }

                frm.add_custom_button(__('Capture Weight'), async function () {
                    const textDecoder = new TextDecoderStream();
                    const reader = textDecoder.readable.getReader();
                    // Listen to data coming from the serial device.
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) {
                            // Allow the serial port to be closed later.
                            reader.releaseLock();
                            break;
                        }
                        // value is a string.
                        console.log(value);
                        // Set the captured weight in the weight field
                        frm.set_value('gross_weight', value);
                        frappe.msgprint(__('Weight captured: ') + value + ' kg');
                    }
                });

                frm.add_custom_button(__('Connect to another machine'), async function () {
                    port = await navigator.serial.requestPort();
                });
            })()
        } else {
            frappe.msgprint({
                message: __("Please use google chrome browser"),
                title: __("Web serial api is not supported."),
                indicator: "red",
            });
        }
    }
});

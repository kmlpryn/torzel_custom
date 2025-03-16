let lastPort = null;
let isCapturing = false;

frappe.ui.form.on("Barcode Generator", {
  net_weight: function (frm) {
    calculate_length(frm);
    calculate_dispatched_weights(frm);
  },
  gross_weight: function (frm) {
    calculate_net_weight(frm);
    calculate_dispatched_weights(frm);
  },
  tare_weight: function (frm) {
    calculate_net_weight(frm);
    calculate_dispatched_weights(frm);
  },
  net_weight_diff: function (frm) {
    calculate_dispatched_weights(frm);
  },
  tare_weight_diff: function (frm) {
    calculate_dispatched_weights(frm);
  },
  refresh(frm) {
    if ("serial" in navigator) {
      setupSerialPort(frm);
      //setupTestMode(frm);
    } else {
      // Add a test mode button when Serial API is not available
      setupTestMode(frm);
    }

    // if (!frm.doc.brand) {
    //     return; // No filtering if brand is not set
    // }

    // frappe.call({
    //     method: "torzel_custom.torzel_custom.doctype.barcode_generator.barcode_generator.get_filtered_print_formats",
    //     args: { docname: frm.doc.name },
    //     callback: function (response) {
    //         if (response.message) {
    //             let filtered_print_formats = response.message;

    //             if (filtered_print_formats.length === 0) {
    //                 frappe.msgprint(`No print formats found for brand: ${frm.doc.brand}`);
    //                 return;
    //             }

    //             // Hook into the Print Dialog when it's opened
    //             frm.page.wrapper.on('click', '.btn-print', function () {
    //                 setTimeout(() => {
    //                     filter_print_dialog_options(filtered_print_formats);
    //                 }, 500);
    //             });

    //             console.log("Filtered Print Formats:", filtered_print_formats);
    //         }
    //     }
    // });
  }
});

// Function to override print format dropdown
function filter_print_dialog_options(filtered_print_formats) {
  // Get the dropdown element inside the print dialog
  let printFormatDropdown = $('select[data-fieldname="print_format"]');

  if (printFormatDropdown.length) {
    // Remove all options that are not in the filtered list
    printFormatDropdown.find('option').each(function () {
      let formatName = $(this).text().trim();
      if (!filtered_print_formats.includes(formatName)) {
        $(this).remove();
      }
    });

    // Automatically select the first available print format
    if (filtered_print_formats.length > 0) {
      printFormatDropdown.val(filtered_print_formats[0]).trigger('change');
    }
  }
}

const setupSerialPort = (frm) => {
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
    const grossWeight = frm.doc.weight_preview;
    if (grossWeight) {
      frm.set_value('gross_weight', grossWeight);
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
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        reader.releaseLock();
        break;
      }

      // Append new data to buffer
      buffer += value;

      // Try to extract weight from buffer
      const weight = extractWeight(buffer);
      if (weight !== null) {
        // Always update the preview
        frm.set_value('weight_preview', weight);

        // Only update gross_weight if NOT capturing
        // This means the weight will keep updating until user clicks "Capture"
        if (!isCapturing) {
          frm.set_value('gross_weight', weight);
        }
        console.log('Raw buffer:', buffer);
        console.log('Extracted weight:', weight);
      }

      // Clear buffer if it gets too long
      if (buffer.length > 200) {
        buffer = buffer.slice(-100);
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

function extractWeight(data) {
  // Clean the data: replace common separators and noise with spaces
  let cleanData = data.replace(/[^0-9.+\-kKgG\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split the cleaned data into tokens
  let tokens = cleanData.split(' ');
  let possibleWeights = [];

  for (let token of tokens) {
    // Remove any non-essential characters
    token = token.replace(/[kKgG]/g, '').trim();

    // Try to extract a valid number
    let number = parseFloat(token);

    // Validate the number
    if (!isNaN(number) &&
      number > 0 && // Weight should be positive
      number < 999999 && // Reasonable upper limit
      token.includes('.')) { // Must include decimal point

      // Standardize to 3 decimal places
      possibleWeights.push(number.toFixed(3));
    }
  }

  // Return the last valid weight found, if any
  return possibleWeights.length > 0 ? possibleWeights[possibleWeights.length - 1] : null;
}

async function calculate_length(frm) {
  // Ensure item_code is available
  if (!frm.doc.finished_product) {
    frappe.msgprint(__('Please select finished product.'));
    return;
  }

  // Fetch custom_factor_of_calculation from the Items Doctype
  let custom_factor = await fetch_custom_factor_of_calculation(frm.doc.finished_product);

  if (custom_factor !== null) {
    let net_weight = frm.doc.net_weight || 0;

    // Calculate the length
    let length = custom_factor * net_weight;

    // Set the calculated value to the length field
    frm.set_value('length', length);
  } else {
    frappe.msgprint(__('Unable to fetch custom factor for the selected item.'));
  }
}

const calculate_dispatched_weights = (frm) => {
  let tare_weight = parseFloat(frm.doc.tare_weight) || 0;
  let tare_weight_diff = parseFloat(frm.doc.tare_weight_diff) || 0;
  let net_weight = parseFloat(frm.doc.net_weight) || 0;
  let net_weight_diff = parseFloat(frm.doc.net_weight_diff) || 0;

  let dispatched_tare_weight = tare_weight + tare_weight_diff;
  let dispatched_net_weight = net_weight + net_weight_diff;

  frm.set_value('dispatched_tare_weight', dispatched_tare_weight);
  frm.set_value('dispatched_net_weight', dispatched_net_weight);

  // Dispatched Gross Weight = Dispatched Tare Weight + Dispatched Net Weight
  let dispatched_gross_weight = dispatched_tare_weight + dispatched_net_weight;
  frm.set_value('dispatched_gross_weight', dispatched_gross_weight);
};

const calculate_net_weight = (frm) => {
  let gross_weight = parseFloat(frm.doc.gross_weight) || 0;
  let tare_weight = parseFloat(frm.doc.tare_weight) || 0;

  if (gross_weight && tare_weight) {
    let net_weight = gross_weight - tare_weight;
    frm.set_value('net_weight', net_weight);
  } else {
    frm.set_value('net_weight', '');
  }
};

async function fetch_custom_factor_of_calculation(item_code) {
  try {
    // Fetch the custom_factor_of_calculation from the Items Doctype
    let response = await frappe.db.get_value('Item', { 'item_code': item_code }, 'custom_factor_of_calculation');

    if (response && response.message && response.message.custom_factor_of_calculation) {
      return response.message.custom_factor_of_calculation;
    } else {
      return null;
    }
  } catch (err) {
    console.error('Error fetching custom_factor_of_calculation:', err);
    return null;
  }
}

// Test mode setup
const setupTestMode = (frm) => {
  let simulationInterval;

  // Helper function to generate random weight formats
  const generateRandomWeightFormat = () => {
    const baseWeight = (Math.random() * 100).toFixed(3);
    const formats = [
      // Standard format
      `${baseWeight}`,
      // Leading zeros format
      `00${baseWeight}`,
      // K prefix format
      `02K +${baseWeight}`,
      // With noise characters
      `ff 82 ${baseWeight} aar`,
      // Multiple readings with noise
      `82 8a ${baseWeight} ff ff ${(parseFloat(baseWeight) + 0.01).toFixed(3)}`,
      // G suffix format
      `${baseWeight}G`,
      // With control characters
      `ca ca ${baseWeight} ff`,
      // Bracketed format
      `[${baseWeight}]`
    ];

    return formats[Math.floor(Math.random() * formats.length)];
  };

  frm.add_custom_button(__('Start Test Simulation'), function () {
    if (!simulationInterval) {
      // Start simulation
      simulationInterval = setInterval(() => {
        const simulatedWeight = generateRandomWeightFormat();
        console.log('Simulated raw data:', simulatedWeight);

        // Update preview using the same extraction logic as production
        const extractedWeight = extractWeight(simulatedWeight);
        frm.set_value('weight_preview', extractedWeight);
      }, 1000); // Update every second

      frappe.msgprint(__('Test simulation started. Random weights will be generated in various formats.'));
      $(this).html(__('Stop Test Simulation'));
    } else {
      // Stop simulation
      clearInterval(simulationInterval);
      simulationInterval = null;
      $(this).html(__('Start Test Simulation'));
      frappe.msgprint(__('Test simulation stopped.'));
    }
  });

  // Use the same capture logic as production
  frm.add_custom_button(__('Capture Weight'), function () {
    const grossWeight = frm.doc.weight_preview;
    if (grossWeight) {
      frm.set_value('gross_weight', grossWeight);
      frappe.msgprint(__('Weight captured: ') + grossWeight + ' kg');
    } else {
      frappe.msgprint(__('No weight available to capture.'));
    }
  });
};

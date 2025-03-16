// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt

let lastPort = null;
let currentRow = null;
let capturedRows = new Set();

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
      //setupTestMode(frm);
    } else {
      setupTestMode(frm);
    }

    capturedRows.clear();
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
  },
  supplier: function (frm) {
    // Clear the Sauda field when Supplier changes
    frm.set_value('sauda', null);
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

let isCapturing = false;

const setupSerialPort = (frm) => {
  // Connect/Disconnect Button
  let connectButton = frm.add_custom_button(__('Connect to Weight Machine'), async function () {
    if (lastPort && lastPort.readable) {
      try {
        await disconnectPort();
        connectButton.html(__('Connect to Weight Machine'));
        frappe.msgprint(__('Disconnected from the weight machine.'));
      } catch (err) {
        console.error('Failed to disconnect from the weight machine:', err);
        frappe.msgprint(__('Failed to disconnect from the weight machine.'));
      }
    } else {
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

  // Modified Capture Weight Button
  frm.add_custom_button(__('Capture Weight'), function () {
    if (!currentRow) {
      frappe.msgprint(__('Please select a row in the Gate Pass Items table.'));
      return;
    }

    const previewWeight = frm.doc.weight_preview;
    if (previewWeight) {
      frappe.model.set_value(currentRow.doctype, currentRow.name, 'gross_qty', previewWeight);
      frappe.msgprint(__('Weight captured for row #') + currentRow.idx + ': ' + previewWeight + ' kg');

      frappe.show_alert({
        message: __('Row #') + currentRow.idx + __(' weight captured'),
        indicator: 'green'
      }, 3);
    } else {
      frappe.msgprint(__('No weight available to capture.'));
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
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        reader.releaseLock();
        break;
      }

      buffer += value;

      const weight = extractWeight(buffer);
      if (weight !== null) {
        // Update the preview field
        frm.set_value('weight_preview', weight);
        console.log('Raw buffer:', buffer);
        console.log('Extracted weight:', weight);
      }

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

frappe.ui.form.on('Gate Pass Item', {
  bags_no: function (frm, cdt, cdn) {
    calculateQty(frm);
    currentRow = locals[cdt][cdn];
    frappe.model.set_value(currentRow.doctype, currentRow.name, 'gross_qty', 0);
  },
  gate_pass_item_table_remove: function (frm) {
    calculateQty(frm);
    calculateGrossQty(frm);
    // Clear captured state for removed rows
    capturedRows.clear();
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
    if (item.gross_qty) {
      totalGrossQty += parseFloat(item.gross_qty);
    }
  });

  frm.set_value('total_gw_qty', totalGrossQty.toFixed(3));
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
      simulationInterval = setInterval(() => {
        const simulatedWeight = generateRandomWeightFormat();
        console.log('Simulated raw data:', simulatedWeight);

        const extractedWeight = extractWeight(simulatedWeight);
        if (extractedWeight) {
          frm.set_value('weight_preview', extractedWeight);
        }
      }, 1000);

      frappe.msgprint(__('Test simulation started. Random weights will be generated in various formats.'));
      $(this).html(__('Stop Test Simulation'));
    } else {
      clearInterval(simulationInterval);
      simulationInterval = null;
      $(this).html(__('Start Test Simulation'));
      frappe.msgprint(__('Test simulation stopped.'));
    }
  });

  // Use same capture logic as production
  frm.add_custom_button(__('Capture Weight'), function () {
    if (!currentRow) {
      frappe.msgprint(__('Please select a row in the Gate Pass Items table.'));
      return;
    }

    const previewWeight = frm.doc.weight_preview;
    if (previewWeight) {
      frappe.model.set_value(currentRow.doctype, currentRow.name, 'gross_qty', previewWeight);
      frappe.msgprint(__('Weight captured for row #') + currentRow.idx + ': ' + previewWeight + ' kg');
    } else {
      frappe.msgprint(__('No weight available to capture.'));
    }
  });
};
let lastPort = null;
let isCapturing = false;

frappe.ui.form.on("Barcode Generator", {

  

  
  finished_product: async function(frm) {
     frm.remove_custom_button(__('Connect to Weight Machine')); 
     frm.remove_custom_button(__('Capture Net Weight')); 
     frm.remove_custom_button(__('Start Test Simulation')); 
     frm.remove_custom_button(__('Capture Gross Weight')); 

     const fields1 = [ 
      "raw_material" , "brand" , "finished_product_name" ,  "source_warehouse" ,
      "target_warehouse" , "weight_preview" ,  "net_weight" ,  "tare_weight" ,
      "gross_weight" , "net_weight_diff" , "tare_weight_diff" , "dispatched_net_weight" ,
      "dispatched_tare_weight" , "dispatched_gross_weight"
     ]  
    // fields1.forEach(f => frm.set_value(f, ""));


  let cgw = await fetch_custom_capture_gross_weight(frm.doc.finished_product);
  console.log(cgw);
  if (cgw === 1) {
    frm.set_df_property('net_weight', 'read_only', 1);
    frm.set_df_property('gross_weight' , 'read_only' , 0);
    frm.set_df_property('net_weight_diff' , 'read_only' , 1 );
    frm.set_df_property('tare_weight_diff' , 'read_only' , 0 );
    if ("serial" in navigator) {
      setupSerialPortgw(frm);
      //setupTestMode(frm);
    } else {
      // Add a test mode button when Serial API is not available
      setupTestModegw(frm);
    }


  } else if (cgw === 0) {
    frm.set_df_property('gross_weight', 'read_only' , 1 );
    frm.set_df_property('net_weight', 'read_only', 0);
    frm.set_df_property('net_weight_diff' , 'read_only' , 0 );
    frm.set_df_property('tare_weight_diff' , 'read_only' , 1 );
    if ("serial" in navigator) {
      setupSerialPort(frm);
      //setupTestMode(frm);
    } else {
      // Add a test mode button when Serial API is not available
      setupTestMode(frm);
    }

  }
},
   
  
  net_weight: async function (frm) {
     if (!frm.doc.finished_product) {
    frappe.msgprint(__('Please select finished product.'));
    frm.set_value('net_weight', '');
    return;
    }
    logcgw(frm);
    calculate_length(frm);
    let cgw = await fetch_custom_capture_gross_weight(frm.doc.finished_product);
    if(cgw === 0) {    
    calculate_gross_weight(frm);
    calculate_dispatched_weights(frm);
    } else if ( cgw === 1) {
      calculate_dispatched_weightsgw(frm);
    }

  },

  gross_weight: async function (frm) {
    let cgw = await fetch_custom_capture_gross_weight(frm.doc.finished_product);
    if( cgw === 1) {
    calculate_net_weight(frm);
    calculate_dispatched_weightsgw(frm);
    } else if ( cgw === 0 ) {
      calculate_dispatched_weights(frm);
    }
  },

  tare_weight: async function (frm) {
    logcgw(frm);
    
    let cgw = await fetch_custom_capture_gross_weight(frm.doc.finished_product);
    if( cgw === 1) {
      calculate_net_weight(frm);
    } else if ( cgw === 0 ) {
    calculate_gross_weight(frm);
    calculate_dispatched_weightsgw(frm);
  }
    
  },
  net_weight_diff: async function (frm) {
    logcgw(frm);
    let cgw = await fetch_custom_capture_gross_weight(frm.doc.finished_product);
    if (cgw === 0) {
    calculate_dispatched_weights(frm);
    } else if ( cgw === 1) {
      calculate_dispatched_weightsgw(frm);
    }

  },
  tare_weight_diff: async function (frm) {
    let cgw = await fetch_custom_capture_gross_weight(frm.doc.finished_product);
    if (cgw === 0) {
    calculate_dispatched_weights(frm);
    } else if ( cgw === 1) {
      calculate_dispatched_weightsgw(frm);
    }
  },


  // refresh(frm) {


  //   if ("serial" in navigator) {
  //     setupSerialPort(frm);
  //     //setupTestMode(frm);
  //   } else {
  //     // Add a test mode button when Serial API is not available
  //     setupTestMode(frm);
  //   }

  // }
});



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
        frm.set_value('weight_preview', '');
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

  // Modified Capture Weight Button to capture net weight instead
  frm.add_custom_button(__('Capture Net Weight'), function () {
    const previewWeight = frm.doc.weight_preview;
    if (previewWeight) {
      frm.set_value('net_weight', previewWeight);
      frappe.msgprint(__('Net weight captured: ') + previewWeight + ' kg');
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

      buffer += value;

      const weight = extractWeight(buffer);
      if (weight !== null) {
        // Only update the preview field
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




const calculate_dispatched_weightsgw = (frm) => {
  let tare_weight = parseFloat(frm.doc.tare_weight) || 0;
  let tare_weight_diff = parseFloat(frm.doc.tare_weight_diff) || 0;
  let net_weight = parseFloat(frm.doc.net_weight) || 0;
  let net_weight_diff = parseFloat(frm.doc.net_weight_diff) || 0;
  let gross_weight = parseFloat(frm.doc.gross_weight) || 0;


  let dispatched_tare_weight = tare_weight - tare_weight_diff;
  let dispatched_gross_weight = gross_weight;
  

  frm.set_value('dispatched_tare_weight', dispatched_tare_weight);
  frm.set_value('dispatched_gross_weight', dispatched_gross_weight);

  // Dispatched Gross Weight = Dispatched Tare Weight + Dispatched Net Weight
  let dispatched_net_weight = dispatched_gross_weight - dispatched_tare_weight
  frm.set_value('dispatched_net_weight', dispatched_net_weight);
};




// New function to calculate gross weight
const calculate_gross_weight = (frm) => {
  let net_weight = parseFloat(frm.doc.net_weight) || 0;
  let tare_weight = parseFloat(frm.doc.tare_weight) || 0;

  if (net_weight || tare_weight) {
    let gross_weight = net_weight + tare_weight;
    frm.set_value('gross_weight', gross_weight);
  } else {
    frm.set_value('gross_weight', '');
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

// Modify test mode to match new production behavior
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
        // console.log('Simulated raw data:', simulatedWeight);

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

  // Modified to capture net weight instead of gross weight
  frm.add_custom_button(__('Capture Net Weight'), function () {
    const previewWeight = frm.doc.weight_preview;
    if (previewWeight) {
      frm.set_value('net_weight', previewWeight);
      frappe.msgprint(__('Net weight captured: ') + previewWeight + ' kg');
    } else {
      frappe.msgprint(__('No weight available to capture.'));
    }
  });
};






async function fetch_custom_capture_gross_weight(item_code) {
  try {
    // Step 1: Fetch the Item Group from the Item
    const itemResponse = await frappe.db.get_value('Item', { 'item_code': item_code }, 'item_group');

    if (!itemResponse || !itemResponse.message || !itemResponse.message.item_group) {
      console.warn('Item group not found for item:', item_code);
      return null;
    }

    const item_group = itemResponse.message.item_group;

    // Step 2: Fetch the custom_capture_gross_weight field from the Item Group
    const groupResponse = await frappe.db.get_value('Item Group', { 'name': item_group }, 'custom_capture_gross_weight');

    if (groupResponse && groupResponse.message && groupResponse.message.custom_capture_gross_weight != null) {
      return groupResponse.message.custom_capture_gross_weight;
    } else {
      return null;
    }
  } catch (err) {
    console.error('Error fetching custom_capture_gross_weight:', err);
    return null;
  }
}








async function logcgw(frm) {
  // Ensure item_code is available
  if (!frm.doc.finished_product) {
    frappe.msgprint(__('Please select finished product.'));
    return;
  }

  // Fetch custom_factor_of_calculation from the Items Doctype
  let cgw = await fetch_custom_capture_gross_weight(frm.doc.finished_product);


  if (cgw !== null) {
    console.log(cgw)
  } else {
    frappe.msgprint(__('Unable to fetch custom cgw for the selected item.'));
  }
}














const setupSerialPortgw = (frm) => {
  // Connect/Disconnect Button
  let connectButton = frm.add_custom_button(__('Connect to Weight Machine'), async function () {
    if (lastPort && lastPort.readable) {
      // Disconnect
      try {
        await lastPort.close();
        lastPort = null;
        connectButton.html(__('Connect to Weight Machine'));
        frappe.msgprint(__('Disconnected from the weight machine.'));
        frm.set_value('weight_preview', '');
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

  // Simplified Capture Weight Button
  frm.add_custom_button(__('Capture Gross Weight'), function () {
    const previewWeight = frm.doc.weight_preview;
    if (previewWeight) {
      frm.set_value('gross_weight', previewWeight);
      frappe.msgprint(__('Weight captured: ') + previewWeight + ' kg');
    } else {
      frappe.msgprint(__('No weight available to capture.'));
    }
  });
};



const calculate_net_weight = (frm) => {
  let gross_weight = parseFloat(frm.doc.gross_weight) || 0;
  let tare_weight = parseFloat(frm.doc.tare_weight) || 0;

  // if (gross_weight && tare_weight) {
  //   let net_weight = gross_weight - tare_weight;
  //   frm.set_value('net_weight', net_weight);
  // } else {
  //   frm.set_value('net_weight', '');
  // }
  let net_weight = gross_weight - tare_weight;
  frm.set_value('net_weight', net_weight);


};


const setupTestModegw = (frm) => {
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
          // Only update preview weight
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
  frm.add_custom_button(__('Capture Gross Weight'), function () {
    const previewWeight = frm.doc.weight_preview;
    if (previewWeight) {
      frm.set_value('gross_weight', previewWeight);
      frappe.msgprint(__('Weight captured: ') + previewWeight + ' kg');
    } else {
      frappe.msgprint(__('No weight available to capture.'));
    }
  });
};
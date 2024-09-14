// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt

frappe.query_reports["Sauda Gate Pass Report"] = {
	"filters": [
		{
			"fieldname": "from_date",
			"label": "From Date",
			"fieldtype": "Date"
		},
		{
			"fieldname": "to_date",
			"label": "To Date",
			"fieldtype": "Date"
		}
	]
};

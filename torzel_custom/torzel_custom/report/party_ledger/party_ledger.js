// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt

frappe.query_reports["party ledger"] = {
	"filters": [
		{
			"fieldname": "party",
			"label": __("Customer"),
			"fieldtype": "Link",
			"options": "Customer",
			"reqd": 0
		},
		{
			"fieldname": "from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.month_start(),
			"reqd": 1
		},
		{
			"fieldname": "party",
			"label": __("Supplier"),
			"fieldtype": "Link",
			"options": "Supplier",
			"reqd": 0
		}

	]
};

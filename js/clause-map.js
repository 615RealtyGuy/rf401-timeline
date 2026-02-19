/* RF401 Clause Map — Tennessee Purchase & Sale Agreement definitions
   Auto-generated from clause_map.json v1.3 */

var CLAUSE_MAP = {
  version: "1.3",
  form: "RF401",
  description: "Tennessee Association of REALTORS Purchase and Sale Agreement",

  anchors: [
    {
      id: "binding_agreement_date",
      label: "Binding Agreement Date"
    },
    {
      id: "closing_date",
      label: "Closing Date"
    },
    {
      id: "possession_date",
      label: "Possession Date"
    }
  ],

  clauses: [
    {
      id: "inspection_period",
      section: "8(D)",
      label: "Inspection Period",
      trigger: "binding_agreement_date",
      direction: "after",
      expected_type: "deadline",
      category: "inspection"
    },
    {
      id: "inspection_resolution",
      section: "8(D)",
      label: "Inspection Resolution Period",
      trigger: "inspection_notice_delivered",
      direction: "after",
      expected_type: "deadline",
      category: "inspection"
    },
    {
      id: "earnest_money_deposit",
      section: "3",
      label: "Earnest Money Deposit Deadline",
      trigger: "binding_agreement_date",
      direction: "after",
      expected_type: "deadline",
      category: "financing"
    },
    {
      id: "loan_application",
      section: "2(A)",
      label: "Loan Application Deadline",
      trigger: "binding_agreement_date",
      direction: "after",
      expected_type: "deadline",
      category: "financing"
    },
    {
      id: "appraisal_ordered",
      section: "2(A)",
      label: "Appraisal Ordered / Hazard Insurance Secured",
      trigger: "binding_agreement_date",
      direction: "after",
      expected_type: "deadline",
      category: "financing"
    },
    {
      id: "offer_expiration",
      section: "22",
      label: "Offer Expiration",
      trigger: null,
      direction: null,
      expected_type: "explicit_date",
      category: "other"
    },
    {
      id: "closing",
      section: "4(A)",
      label: "Closing",
      trigger: null,
      expected_type: "anchor",
      category: "closing"
    },
    {
      id: "possession",
      section: "4(A)",
      label: "Possession",
      trigger: null,
      expected_type: "anchor",
      category: "closing"
    }
  ],

  financial_fields: [
    {
      id: "purchase_price",
      label: "Purchase Price"
    },
    {
      id: "earnest_money_amount",
      label: "Earnest Money Amount"
    }
  ],

  text_fields: [
    { id: "personal_property_included", label: "Personal Property Included", section: "1(B)" },
    { id: "items_excluded", label: "Items Excluded", section: "1(C)" },
    { id: "loan_type", label: "Loan Type", section: "2(A)" },
    { id: "appraisal_contingency", label: "Appraisal Contingency", section: "2(C)" },
    { id: "title_expenses", label: "Title Expenses", section: "2(D)(3)" },
    { id: "closing_agency_buyer", label: "Closing Agency (Buyer)", section: "2(D)(3)" },
    { id: "closing_agency_seller", label: "Closing Agency (Seller)", section: "2(D)(3)" },
    { id: "special_stipulations", label: "Special Stipulations", section: "21" }
  ]
};

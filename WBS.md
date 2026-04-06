# CPQ Express — Project Roadmap

**Project Manager:** Nikhil T
**Start Date:** June 4, 2026
**Total Estimated Effort:** 55.5 hours
**Platform:** Salesforce (Apex, LWC, Custom Objects)

---

## Overview

CPQ Express is a custom-built Configure, Price, Quote solution on Salesforce. The system enables Sales Reps to build and submit quotes, and Sales Managers to review, approve or reject them — with full pricing automation, role-based access control, an activity audit trail, and rich Lightning-based UI components.

---

## Project Phases at a Glance

| Phase | Area | Effort | Status |
|-------|------|--------|--------|
| 1 | Requirement Analysis & Org Setup | 3.4 hrs |
| 2 | Data Model & Custom Objects | 1.4 hrs |
| 3 | UI, Layouts & Lightning App | 5.0 hrs | 
| 4 | Permission Sets & Access Control | 2.2 hrs | 
| 5 | Core CPQ — Apex Service Layer | 16.1 hrs |
| 6 | Core CPQ — LWC Components | 17.0 hrs |
| 7 | Testing | 9.0 hrs |
| 8 | Products, Categories & Demo Data | 1.4 hrs |
| 9 | Extra / Optional Features (Post-Core) | 15.5 hrs |

---

## Phase 1 — Requirement Analysis & Org Setup

**Effort:** 3.4 hrs
**Objective:** Gather knowledge around the project according to the requirements, configure org-level settings, user roles, hierarchy and assign test users for the CPQ project.

### 1.1 Requirement Analysis *(2 hrs)*
| Task | Description | Effort | Status |
|------|-------------|--------|--------|
| 1.1.1 | Knowledge gathering for functional and non-functional requirements | 1 hr 
| 1.1.2 | Data Model & design | 1 hr |

### 1.2 Define Role Hierarchy *(0.6 hrs)*
| Task | Description | Effort | Status |
|------|-------------|--------|--------|
| 1.2.1 | Create Admin Role | 0.2 hrs | 
| 1.2.2 | Create Manager Role | 0.2 hrs | 
| 1.2.3 | Create Sales Rep Role | 0.2 hrs | 

### 1.3 Configure OWD & Sharing Settings *(0.6 hrs — depends on 1.2)*
| Task | Description | Effort |
|------|-------------|--------|
| 1.3.1 | Set OWD on Quote__c to Private | 0.2 hrs |
| 1.3.2 | Set OWD on QLI__c to Private | 0.2 hrs |
| 1.3.3 | Set OWD on Product__c to Public Read Only | 0.2 hrs |

### 1.4 Create Test Users *(0.2 hrs — depends on 1.2)*
| Task | Description | Effort |
|------|-------------|--------|
| 1.4.1 | Create Sales Rep test user | 0.1 hrs |
| 1.4.2 | Create Manager test user | 0.1 hrs |

**✅ Deliverables:** Role hierarchy in place, OWD configured, test users created, and baseline FLS applied.

---

## Phase 2 — Data Model & Custom Objects

**Effort:** 1.4 hrs
**Objective:** Create all custom objects, relationships, and required fields that form the CPQ Express data model.

| Task | Description | Effort | Status |
|------|-------------|--------|--------|
| 2.1 | Create Quote__c custom object | 0.2 hrs | 
| 2.2 | Create Quote_Line_Item__c (QLI) custom object | 0.2 hrs | 
| 2.3 | Create Product__c custom object | 0.2 hrs |
| 2.4 | Create Categories__c custom object | 0.1 hrs |
| 2.5 | Create Add_Ons__c custom object *(depends on 2.3)* | 0.2 hrs | — |
| 2.6 | Create Discount_Tier__c custom object *(depends on 2.3)* | 0.2 hrs | — |

### 2.7 Validation Rules *(0.3 hrs — depends on 2.1, 2.2)*
| Task | Description | Effort |
|------|-------------|--------|
| 2.7.1 | Quantity must be greater than zero on QLI | 0.1 hrs |
| 2.7.2 | Discount % must be between 0 and 100 on QLI | 0.1 hrs |
| 2.7.3 | Valid Until must be >= Today on Quote | 0.1 hrs |

**✅ Deliverables:** All custom objects, fields, roll-ups, formulas, and relationships visible and configured in Object Manager.

---

## Phase 3 — UI, Layouts & Lightning App

**Effort:** 5 hrs
**Objective:** Build record types, page layouts, Lightning App, and list views.
**Dependency:** Phase 2 must be complete.

### 3.1 Create Record Types on Quote__c *(2 hrs — depends on Phase 2)*
| Task | Record Type | Effort |
|------|-------------|--------|
| 3.1.1 | Draft | 0.5 hrs |
| 3.1.2 | Submitted | 0.5 hrs |
| 3.1.3 | Approved | 0.5 hrs |
| 3.1.4 | Rejected | 0.5 hrs |

### 3.2 Create Page Layouts per Record Type *(2 hrs — depends on 3.1)*
| Task | Layout | Effort |
|------|--------|--------|
| 3.2.1 | Draft layout — all fields editable, full QLI section | 0.5 hrs |
| 3.2.2 | Submitted / Approved / Rejected layout — read-only | 0.5 hrs |
| 3.2.3 | Manager layout — includes Cost & Margin fields | 0.5 hrs |
| 3.2.4 | QLI layout | 0.5 hrs |

### 3.3 Create Lightning App & List Views *(1 hr — depends on 3.2)*
| Task | Description | Effort | Status |
|------|-------------|--------|--------|
| 3.3.1 | Lightning App: CPQ Express | 0.2 hrs |
| 3.3.2 | List view: My Draft Quotes | 0.3 hrs |
| 3.3.3 | List view: Quotes Pending Approval | 0.3 hrs | 
| 3.3.4 | List view: All Quotes (Manager only) | 0.2 hrs | 

**✅ Deliverables:** CPQ Express app fully navigable with correct layouts per record type.

---

## Phase 4 — Permission Sets & Access Control

**Effort:** 2.2 hrs
**Objective:** Build 3 permission sets for different access levels and configure FLS to hide sensitive cost/margin data from Sales Reps.

### 4.1 PS1: CPQ Base Access *(1 hr — depends on Phase 2)*
| Task | Description | Effort |
|------|-------------|--------|
| 4.1.1 | App & Tab visibility | 0.2 hrs |
| 4.1.2 | Object permissions | 0.3 hrs |
| 4.1.3 | FLS on Quote | 0.3 hrs |
| 4.1.4 | FLS on QLI | 0.2 hrs |

### 4.2 PS2: CPQ Sales Rep *(0.5 hrs — depends on 4.1)*
| Task | Description | Effort |
|------|-------------|--------|
| 4.2.1 | Object permissions: Quote, QLI (Create, Read, Edit — Draft only) | 0.2 hrs |
| 4.2.2 | Record type access: Draft, Submitted only | 0.1 hrs |
| 4.2.3 | FLS: Cost & Margin fields HIDDEN (no read/edit) | 0.2 hrs |

### 4.3 PS3: CPQ Sales Manager *(0.5 hrs — depends on 4.1)*
| Task | Description | Effort |
|------|-------------|--------|
| 4.3.1 | Inherit PS1 (CPQ Base Access) | 0.1 hrs |
| 4.3.2 | Object permissions: All objects full CRUD | 0.2 hrs |
| 4.3.3 | FLS upgrade: Cost & Margin fields READ access | 0.2 hrs |

### 4.4 Assign & Verify Permission Sets *(0.2 hrs — depends on 4.2, 4.3)*
| Task | Description | Effort |
|------|-------------|--------|
| 4.4.1 | Assign & verify permission sets for Sales Rep | 0.1 hrs |
| 4.4.2 | Assign & verify permission sets for Manager | 0.1 hrs |

**✅ Deliverables:** Sales Rep cannot see cost/margin data; Manager has full visibility and bypass permission.

---

## Phase 5 — Core CPQ — Apex Service Layer

**Effort:** 16.1 hrs
**Objective:** Build the Apex trigger framework, pricing engine, service classes, and all business logic that powers the CPQ.

### 5.1 Trigger Framework Setup *(2 hrs — depends on Phase 2)*
| Task | Description | Effort |
|------|-------------|--------|
| 5.1.1 | Quote Trigger | 1 hr |
| 5.1.2 | QLI Trigger | 1 hr |

### 5.2 Pricing Engine Apex Class *(2 hrs — depends on 5.1)*
| Task | Description | Effort |
|------|-------------|--------|
| 5.2.1 | Logic for Total, Discounts, QLI Items etc. | 2 hrs |

### 5.3 Category-Based Auto Discount *(1 hr — depends on 5.2)*
| Task | Description | Effort |
|------|-------------|--------|
| 5.3.2 | Class to apply category and quantity tier based discounts | 1 hr |

### 5.4 Add-On Management Apex *(2 hrs — depends on 5.1)*
| Task | Description | Effort |
|------|-------------|--------|
| 5.4.1 | Class to handle product-based Add-Ons | 2 hrs |

### 5.5 Quote Activity History Tracking *(2.1 hrs — depends on 5.1)*
| Task | Description | Effort |
|------|-------------|--------|
| 5.5.1 | Create Quote_Activity__c custom object for log entries | 0.1 hrs |
| 5.5.2 | Trigger: log field changes on Quote (Status, Margin, Discount) | 1 hr |
| 5.5.3 | Trigger: log approval events (submitted, approved, rejected) | 1 hr |

### 5.6 Quote Service Apex Class *(2 hrs — depends on 5.1)*
| Task | Description | Effort |
|------|-------------|--------|
| 5.6.1 | Clone Quote with all QLIs | 1 hr |
| 5.6.2 | Lock quote and submit approval process | 0.5 hrs |
| 5.6.3 | Withdraw submission and revert to Draft | 0.5 hrs |

### 5.7 Manager Approval Process — Margin Threshold *(3 hrs — depends on 4.3)*
| Task | Description | Effort |
|------|-------------|--------|
| 5.7.1 | Approval Process: trigger when Margin % < threshold | 0.5 hrs |
| 5.7.2 | Approval step: route to Manager role, quote locks on submit | 0.5 hrs |
| 5.7.3 | Approval: Update Status to Approved, notify rep via email alert | 1 hr |
| 5.7.4 | Rejection: Update Status to Rejected, notify rep with comments | 1 hr |

### 5.8 PDF Rendering Service *(2 hrs — depends on 5.7)*

**✅ Deliverables:** Pricing, discounts, approval and activity logic fully functional end-to-end.

---

## Phase 6 — Core CPQ — LWC Components

**Effort:** 17 hrs
**Objective:** Build all LWC components for the quote editor, product selector, dashboards, approvals, phase management, and activity timeline.

### 6.1 quoteLineEditor LWC — Core CPQ UI *(5 hrs — depends on 5.2, 5.6)*
| Task | Description | Effort |
|------|-------------|--------|
| 6.1.1 | Inline editable data table of QLI records | 1.5 hrs |
| 6.1.2 | Add / remove / reorder line items | 1 hr |
| 6.1.3 | Read-only mode enforcement when Quote Status ≠ Draft | 0.5 hrs |
| 6.1.4 | Real-time discount & Net Total recalculation on change | 0.5 hrs |
| 6.1.5 | Display add-on lines as child rows under parent | 1 hr |
| 6.1.6 | Hide Unit Cost / Total Line Cost / Margin % from Sales Rep | 0.5 hrs |

### 6.2 productSelector LWC — Product Picker *(2.5 hrs — depends on 2.3, 2.4)*
| Task | Description | Effort |
|------|-------------|--------|
| 6.2.1 | Search products by name, code, category, type | 1.5 hrs |
| 6.2.2 | Filter by Active = true only | 0.2 hrs |
| 6.2.3 | On select: insert QLI and trigger add-on suggestion | 0.5 hrs |
| 6.2.4 | Display price, billing unit, category in picker row | 0.3 hrs |

### 6.3 quoteSummaryCard LWC — Quote Header *(1 hr — depends on 5.2, 5.7)*
| Task | Description | Effort |
|------|-------------|--------|
| 6.3.1 | Total Amount, Status badge, Valid Until | 0.4 hrs |
| 6.3.2 | Show Margin % only for Manager (permission check) | 0.3 hrs |
| 6.3.3 | Approval state indicator (badge / warning banner) | 0.3 hrs |

### 6.4 approvalActionBar LWC — Context-Aware Actions *(1.5 hrs — depends on 5.6, 5.7)*
| Task | Description | Effort |
|------|-------------|--------|
| 6.4.1 | Submit for Approval button (visible to Rep in Draft) | 0.5 hrs |
| 6.4.2 | Recall button (visible to Rep when Submitted) | 0.5 hrs |
| 6.4.3 | Approve / Reject buttons (visible to Manager only) | 0.5 hrs |

### 6.5 quoteActivityTimeline LWC *(2 hrs — depends on 5.5)*
| Task | Description | Effort |
|------|-------------|--------|
| 6.5.1 | Vertical timeline of Quote_Activity__c records | 1 hr |
| 6.5.2 | Display: user avatar, event type, timestamp, changed values | 0.5 hrs |
| 6.5.3 | Highlight approval events | 0.5 hrs |

### 6.6 managerDashboard LWC — Manager App Page *(3 hrs — depends on 4.3, 5.2)*
| Task | Description | Effort |
|------|-------------|--------|
| 6.6.1 | Bar chart: Quote pipeline by stage (Apex SOQL data) | 1 hr |
| 6.6.2 | Margin % distribution across quotes | 1 hr |
| 6.6.3 | Pending Approvals list with approve/reject quick-action | 0.5 hrs |
| 6.6.4 | Create Lightning App page and assign to Manager PS | 0.5 hrs |

### 6.7 salesRepDashboard LWC — Sales Rep App Page *(2 hrs — depends on 4.2)*
| Task | Description | Effort |
|------|-------------|--------|
| 6.7.1 | My Quotes by status chart | 0.5 hrs |
| 6.7.2 | Recent Activity feed from Quote_Activity__c | 0.5 hrs |
| 6.7.3 | Pending items / action items widget | 0.5 hrs |
| 6.7.4 | Quick-create Quote button | 0.5 hrs |

**✅ Deliverables:** Quote editing, discounts, approvals, dashboards working end-to-end for both user roles.

---

## Phase 7 — Testing

**Effort:** 9 hrs
**Objective:** Execute UAT for both user personas and achieve required test coverage.
**Dependency:** Phases 5 & 6 must be complete.

| Task | Description | Effort |
|------|-------------|--------|
| 7.1.1 | Apex Unit Testing | 3 hrs |
| 7.1.2 | LWC Unit Testing | 4 hrs |
| 7.2 | UAT: Sales Rep Scenarios | 1 hr |
| 7.3 | UAT: Manager Scenarios | 1 hr |

**✅ Deliverables:** Required code coverage achieved. All UAT scenarios pass for both roles.

---

## Phase 8 — Products, Categories & Demo Data

**Effort:** 1.4 hrs
**Objective:** Create product catalog, categories, discount tiers, add-ons, and complete demo test data.
**Dependency:** Phase 7 (testing) must be complete.

| Task | Description | Effort |
|------|-------------|--------|
| 8.1 | Create Category records | 0.3 hrs |
| 8.2 | Create Product records | 0.5 hrs |
| 8.3 | Create Discount Tier records | 0.3 hrs |
| 8.4 | Create Add-On records | 0.3 hrs |

**✅ Deliverables:** Full product catalog, discount tiers, add-ons, and demo quotes ready for demonstrations.

---

## Phase 9 — Extra / Optional Features (Post-Core)

**Effort:** 15.5 hrs
**Objective:** Additional features to be scoped and built AFTER core CPQ is stable and signed off. These are optional and not on the critical path.

> ⚠️ **Note:** Phase 9 work should only begin after Phase 8 sign-off.

### 9.1 CSV Upload for Product Catalog *(2 hrs)*
| Task | Description | Effort |
|------|-------------|--------|
| 9.1.1 | LWC: file upload component (lightning-file-upload) | 0.5 hrs |
| 9.1.2 | Apex: ContentVersion CSV parser → Product__c upsert | 0.5 hrs |
| 9.1.3 | Handle errors: duplicate product codes, missing required fields | 0.5 hrs |
| 9.1.4 | Test class for CSV import Apex | 0.5 hrs |

### 9.2 Category Mapper Interface *(2.5 hrs — for CSV Import)*
| Task | Description | Effort |
|------|-------------|--------|
| 9.2.1 | LWC: column-to-category drag-and-match UI shown during import | 1 hr |
| 9.2.2 | Match CSV category values to existing Categories__c records | 0.5 hrs |
| 9.2.3 | Option to create new Category if no match found | 0.5 hrs |
| 9.2.4 | Preview mapped data before committing import | 0.5 hrs |

### 9.3 Phase Based Quoting *(3 hrs)*
| Task | Description | Effort |
|------|-------------|--------|
| 9.3.1 | Phase Templates Creation and application | 1 hr |
| 9.3.2 | Update QLI with phase reference | 0.5 hrs |
| 9.3.3 | phaseManager LWC Phase-Based Segregation | 1 hr |
| 9.3.4 | Update Order field across phases | 0.5 hrs |

### 9.4 AI-Based Management Features *(8 hrs)*
| Task | Description | Effort |
|------|-------------|--------|
| 9.4.1 | Define AI feature scope (Einstein vs external API) | 1 hr |
| 9.4.2 | AI-assisted quote recommendations (product suggestions) | 2 hrs |
| 9.4.3 | Smart discount suggestions based on historical win rate | 2.5 hrs |
| 9.4.4 | Predictive approval flagging (flag before rep submits) | 2.5 hrs |

**✅ Deliverables:** CSV import handles errors gracefully. AI features scoped and baselined. Optional features fully tested and integrated.

---

## Dependency Chain Summary

```
Phase 1 (Org Setup)
    └── Phase 2 (Data Model)
            ├── Phase 3 (UI & Layouts)
            │       └── Phase 4 (Permission Sets)
            │               └── Phase 5 (Apex Layer)
            │                       └── Phase 6 (LWC Components)
            │                               └── Phase 7 (Testing)
            │                                       └── Phase 8 (Demo Data)
            │                                               └── Phase 9 (Optional)
            └── Phase 5 (Apex Layer) ─┘
```

---

## Effort Summary

| Phase | Area | Core / Optional | Hours |
|-------|------|-----------------|-------|
| 1 | Requirement Analysis & Org Setup | Core | 3.4 |
| 2 | Data Model & Custom Objects | Core | 1.4 |
| 3 | UI, Layouts & Lightning App | Core | 5.0 |
| 4 | Permission Sets & Access Control | Core | 2.2 |
| 5 | Core CPQ — Apex Service Layer | Core | 16.1 |
| 6 | Core CPQ — LWC Components | Core | 17.0 |
| 7 | Testing | Core | 9.0 |
| 8 | Products, Categories & Demo Data | Core | 1.4 |
| **Core Total** | | | **55.5** |
| 9 | Extra / Optional Features | Optional | 15.5 |
| **Grand Total (with optional)** | | | **71.0** |

---

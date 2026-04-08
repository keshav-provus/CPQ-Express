# Project Knowledge Transfer: CPQ-Express

This document provides a comprehensive overview of the **CPQ-Express** project, a lightweight Configure, Price, Quote (CPQ) solution built on the Salesforce platform. It is designed to provide context for AI models or developers joining the project.

---

## 🔗 Repository Context
- **Git URL:** [https://github.com/keshav-provus/CPQ-Express.git](https://github.com/keshav-provus/CPQ-Express.git)
- **Primary Branch:** `main`
- **Project Type:** Salesforce DX (SFDX)

---

## 🎯 Project Mission
CPQ-Express aims to provide a streamlined, high-performance quoting experience within Salesforce. It replaces complex, heavy-duty CPQ engines with a focused set of features:
- Rapid product selection and quote line editing.
- Automated pricing, costing, and margin calculation.
- Tiered and category-based discounting logic.
- Managed approval workflows based on margin thresholds.
- Rich, interactive dashboards for both Sales Reps and Managers.

---

## 🛠 Technology Stack
- **Platform:** Salesforce (Core)
- **Backend:** Apex (Triggers, Service Classes, Controllers)
- **Frontend:** Lightning Web Components (LWC), JavaScript (ES6+), SLDS (Salesforce Lightning Design System)
- **Data Model:** Custom Objects with Master-Detail and Lookup relationships.
- **Tools:** SFDX CLI, VS Code, Prettier (for code formatting).

---

## 📊 Core Data Model (Schema)
The application relies on several key custom objects:

1.  **Quote (`Quote__c`):** The parent record (Master-Detail to Opportunity). Tracks status (Draft, Submitted, Approved, Rejected), total amounts, and margins.
2.  **Quote Line Item (`Quote_Line_Item__c`):** Junction between Quote and Product. Stores quantity, unit price, unit cost, discount, and phase.
3.  **Product (`Product__c`):** Custom product catalog (different from standard Salesforce Products). Stores base price, cost, and category.
4.  **Category (`Categories__c`):** Groups products and defines default discount levels.
5.  **Add-on (`Add_ons__c`):** Recommends supplementary products based on a selected parent product.
6.  **Discount Tier (`Discount_Tier__c`):** Volume-based discounting rules.
7.  **Quote Phase (`Quote_Phase__c`):** Groups line items into logical project phases.
8.  **Quote Activity (`Quote_Activity__c`):** Audit trail for all major changes and approval events.

---

## 🏗 Architectural Patterns
The project follows a strict **Controller-Service-DAO** (Data Access Object) pattern in Apex:
- **Controllers:** Handle LWC wire/imperative calls (e.g., `QuoteController.cls`).
- **Services:** Contain heavy business logic and orchestration (e.g., `QuoteLineItemService.cls`).
- **DAOs:** Handle all SOQL queries and DML operations to ensure separation of concerns and testability (e.g., `ProductDAO.cls`).

---

## 🧩 Key Functional Modules

### 1. Quote Line Editor (LWC)
- **Component:** `cpqQuoteLineEditor`
- **Function:** A high-fidelity, inline-editable table for managing quote lines. Supports real-time recalculations and phase-based grouping.

### 2. Product Selection Wizard
- **Component:** `cpqAddItemsWizard` / `productSelectorPopup`
- **Function:** Allows users to search, filter, and add products from the catalog. Includes logic for "Add-on" recommendations.

### 3. Pricing & Discounting Engine
- **Logic Location:** `QuoteLineItemService.cls`, `PricingEngine.cls` (if exists) or Trigger logic.
- **Function:** Automatically fetches the latest prices/costs and applies category-based or volume-based discounts during the addition/update of lines.

### 4. Approval Workflow
- **Logic:** Trigger-based or Approval Process.
- **Function:** Quotes with margins below a specific threshold (e.g., 20%) are automatically routed to a Sales Manager for approval.

### 5. Management Dashboards
- **Components:** `cpqManagerDashboard`, `cpqQuoteAnalyticsWrapper`, `quotesByStatusChart`.
- **Function:** Provides visual insights into the quote pipeline, margin health, and team performance.

---

## 📂 Project Structure
```text
CPQ-Express/
├── force-app/main/default/
│   ├── classes/            # Apex Controllers, Services, DAOs
│   ├── lwc/                # UI Components (Project Core)
│   ├── objects/            # Custom Object Definitions
│   ├── layouts/            # Page Layouts
│   ├── permissionsets/     # Access Control (Admin, Manager, Rep)
│   └── aura/               # (Minimal) Wrapper components if needed
├── config/                 # Scratch Org Definitions
├── scripts/                # Data setup and testing scripts
├── Schema.md               # Detailed Data Model Documentation
└── WBS.md                  # Project Roadmap & Task Breakdown
```

---

## 🛠 Technical Reference: Apex & LWC

### 1. Apex Backend Architecture
The backend is structured into three distinct layers to ensure scalability, security, and testability.

#### A. Controllers (`@AuraEnabled` Layer)
These classes serve as the entry point for frontend components. They handle input validation and exception management.
- **`QuoteController.cls`**: Centralizes quote lifecycle operations.
    - `createQuoteRecord(Id oppId)`: Creates a new quote linked to an opportunity.
    - `addLineItemsFromProducts(Id quoteId, String lineItemsJson)`: Bulk adds products to a quote.
    - `getQuoteLines(Id quoteId)`: Fetches all lines for the editor.
    - `updateQuoteLines(String lineItemsJson)`: Updates quantity/discount for existing lines.
    - `deleteQuoteLine(Id qliId)`: Removes a specific line item.
    - `submitQuote(Id quoteId)`: Moves a quote from Draft to Submitted status.
- **`DashboardController.cls`**: Provides all aggregate data for charts and metric components.
    - `getMyQuoteStats()`: Returns a status-vs-count map for the user's personal dashboard.
    - `getManagerDashboardPackage()`: Optimized method returning a consolidated object of KPIs, stats, and recent quotes for the manager view.
    - `getQuotesByStatus()`: Returns status distribution data for bar/pie charts.
    - `getTopReps()`: Returns ranked user data for the leaderboard.
    - `getWeeklyPipeline()`: Returns time-series data for the last 7 days of quote volume.
- **`ProductController.cls`**: Manages catalog searches.
    - `getActiveProducts()`: Fetches all products currently active for sale.
    - `searchProducts(String searchTerm)`: Filters products by name or code.
- **`OpportunityController.cls`**: Bridges the gap between Opps and Quotes.
    - `getOpportunitiesNeedingQuotes()`: Lists opportunities without any linked quotes.

#### B. Service Layer (Business Logic)
Contains the "meat" of the application logic, independent of the UI.
- **`QuoteLineItemService.cls`**: Orchestrates pricing, discounting, and QLI creation. It handles complex JSON parsing from the LWC and ensures values are correctly mapped to the Product catalog.
- **`DashboardService.cls`**: Performs heavy-duty SOQL/Aggregate queries to provide business intelligence. It calculates margins, identifies top-selling products, and builds geographic marker data.
- **`QuoteService.cls`**: Manages high-level quote operations like cloning and locking.
- **`ProductService.cls`**: Handles product-specific rules and catalog management.

#### C. DAO Layer (Data Access Objects)
Encapsulates all SOQL and DML to make the code mockable for unit tests.
- `QuoteDAO.cls`, `QuoteLineItemDAO.cls`, `ProductDAO.cls`, `OpportunityDAO.cls`.

---

### 2. LWC Component Portfolio
The frontend is built with high-fidelity, interactive components using SLDS and custom CSS for a premium "Antigravity" look.

#### Quote Editing & Configuration
| Component | Objective | Apex Integration |
| :--- | :--- | :--- |
| **`cpqQuoteLineEditor`** | Main grid for editing quote items. Supports real-time recalculations. | `QuoteController.updateQuoteLines`, `deleteQuoteLine` |
| **`cpqAddItemsWizard`** | A slide-in panel for picking products from categories or searching the catalog. | `ProductController.getActiveProducts`, `QuoteController.addLineItemsFromProducts` |
| **`cpqQuoteRecordPage`** | The structural container for the Quote detail view. | `QuoteController.getQuoteLines` |
| **`cpqQuoteSummary`** | Top card showing Key Quote metrics (Total, Margin, Status Badge). | `QuoteController.getQuoteLines` (inherited or directly queried) |
| **`cpqQuoteActions`** | Action-bar for lifecycle buttons: Submit for Approval, Clone, Export. | `QuoteController.submitQuote` |
| **`productSelectorPopup`** | Modal-based version of the product picker with advanced filtering. | `ProductController.getActiveProducts` |

#### Dashboards & Analytics (Manager View)
| Component | Objective | Apex Integration |
| :--- | :--- | :--- |
| **`cpqManagerKPIs`** | Displays "Big Number" metrics: Total Pipeline, Avg Margin, Products. | `DashboardController.getManagerKPIs` |
| **`cpqWeeklyPipelineChart`**| Visual trend of quote generation over the last 7 days. | `DashboardController.getWeeklyPipeline` |
| **`cpqPendingQuotes`** | List of submitted quotes requiring manager review/approval. | `DashboardController.getQuotesNeedingApproval` |
| **`cpqTopProducts`** | Leaderboard of top-selling products by quantity. | `DashboardController.getTopProducts` |
| **`cpqQuoteMap`** | GIS map showing the geographic location of active deals. | `DashboardController.getQuoteMapLocations` |
| **`cpqResourceTimeline`** | Occupancy chart for resource-based products (roles/people). | `DashboardController.getResourceUsageTimeline` |

#### Personal Performance (Sales Rep View)
| Component | Objective | Apex Integration |
| :--- | :--- | :--- |
| **`myQuotesSummary`** | Personal stats overview (My Drafts, My Approvals). | `DashboardController.getMyQuoteStats` |
| **`recentActivity`** | Timeline of recent changes and events for the user. | `DashboardController.getMyRecentActivity` |
| **`oppsNeedingQuotes`**| Helper list to identify high-value Opps without quotes. | `OpportunityController.getOpportunitiesNeedingQuotes` |

---

## 🚀 Common Workflows for Developers

### Setting Up a Development Org
1.  **Authorize Hub:** `sf org login web -d -a myHub`
2.  **Create Scratch Org:** `sf org create scratch -f config/project-scratch-def.json -a cpq-dev`
3.  **Push Source:** `sf project deploy start`
4.  **Assign Permissions:** `sf org assign permset -n CPQ_Admin`
5.  **Import Demo Data:** (Use scripts in `/scripts/apex/` or Data Import)

### Core Deployment
Deployment to sandboxes or production should be handled via SFDX project deploy, ensuring all metadata from `force-app` is included.

---

## 📝 Known Context & Implementation Details
- **Field Level Security (FLS):** Cost and Margin fields are strictly hidden from Sales Reps using Permission Sets.
- **Validation Rules:** Quantity must be > 0, Discount % must be 0-100, and Quote "Valid Until" must be in the future.
- **Trigger Framework:** Logic is delegated to Service classes to keep triggers slim.

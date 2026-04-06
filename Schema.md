## Custom Objects

#### 1. Quote Object → Custom Quote object

1. Quote Number* (Auto Number)
2. Opportunity* (Master-Detail)
3. Account (Lookup)
4. Quote Type* (Picklist)
5. Status* (Picklist)
6. Valid Until (Date)
7. Total Amount (Roll-Up Summary)
8. Total Cost (Roll-Up Summary) [HIDDEN]
9. Margin (Formula{Percent}) [HIDDEN]

#### 2. QLI → Custom Quote Line Item Object

1. Line Number (Auto Number)
2. Quote (Master-Detail)
3. Product (Lookup)
4. Parent Line (Lookup-self)
5. Quantity (Number)
6. Unit Price (Currency)
7. Discount % (Precent)
8. Net Total (Currency)
9. Unit Cost (Currency) [HIDDEN]
10. Total Line Cost (Currency) [HIDDEN]
11. Margin % (Formula %) [HIDDEN]

#### 3. Categories__c → Categories of products

1. Category Name* (Text)
2. Default Discount (Percentage)

#### 4. Product__c → Various Products available

1. Product Code* (ID)
2. Name* (Text)
3. Product Type* (Picklist) [HW, SW, RR]
4. Category* (Lookup) [Development, Testing, Operating System]
5. Price* (Currency)
6. Cost (Currency) [HIDDEN]
7. Billing Unit (Picklist)
8. Description (Text)
9. Active (boolean)

#### 5. Add-ons → Add-ons available

1. ID (Auto Number) 
2. Parent Product (Master-Detail) [ On which product Add-On should be added]
3. Add-On Product (Lookup) [Which product to add as an Add-On]
4. Required (boolean)

#### 6. Discount Tier → Enables volume based discounts

1. Name (Text)
2. Product (Master-Detail)
3. Lower Bound (Number)
4. Upper Bound (Number)
5. Discount % (Percentage)

#### 7. Phase Template → Pre-Stored templates with phases for a specific project type

1. Phase Name* (Text)
2. Project Type* (Pickilst)
3. Order* (Number)

#### 8. Quote Phase → Phase wise summary for a specific quote

1. Phase Name* (text)
2. Quote* (Master-Detail)
3. Order* (Number)
4. Phase Total (Roll-Up summary)
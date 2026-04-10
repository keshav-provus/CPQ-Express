const fs = require('fs');

const generateHTML = (title, typeLabel, idLabel, objectApiName) => `<template>
<main class="flex-1 p-8 bg-surface">
<!-- Resource Info Header -->
<header class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
<div>
<nav class="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
<span>${title}</span>
<span class="material-symbols-outlined text-[14px]">chevron_right</span>
<span class="text-primary">${typeLabel}</span>
</nav>
<h1 class="text-3xl font-extrabold font-headline text-on-surface tracking-tight"><template if:true={item}>{item.Name__c}</template></h1>
<p class="text-on-surface-variant mt-1 text-sm"><template if:true={item}>{item.Name} &nbsp;·&nbsp; {item.Billing_Unit__c}</template></p>
</div>
<div class="flex gap-4">
<div class="bg-surface-container-lowest p-4 px-6 rounded-xl shadow-sm border border-outline-variant/10 flex flex-col min-w-[140px]">
<span class="text-[10px] font-bold text-outline-variant uppercase tracking-widest mb-1">Billing rate</span>
<span class="text-xl font-bold font-headline text-on-surface"><template if:true={item}><lightning-formatted-number value={item.Price__c} format-style="currency" currency-code={currencyCode}></lightning-formatted-number></template></span>
</div>
<div class="bg-surface-container-lowest p-4 px-6 rounded-xl shadow-sm border border-outline-variant/10 flex flex-col min-w-[140px]">
<span class="text-[10px] font-bold text-outline-variant uppercase tracking-widest mb-1">Cost</span>
<span class="text-xl font-bold font-headline text-on-surface"><template if:true={item}><lightning-formatted-number value={item.Cost__c} format-style="currency" currency-code={currencyCode}></lightning-formatted-number></template></span>
</div>
<div class="bg-surface-container-lowest p-4 px-6 rounded-xl shadow-sm border border-outline-variant/10 flex flex-col min-w-[140px]">
<span class="text-[10px] font-bold text-outline-variant uppercase tracking-widest mb-1">Billing Unit</span>
<span class="text-xl font-bold font-headline text-on-surface"><template if:true={item}>{item.Billing_Unit__c}</template></span>
</div>
</div>
</header>
<!-- Metric Grid -->
<section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
<!-- Card 1 -->
<div class="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
<div class="flex justify-between items-start mb-4">
<div class="p-2 bg-primary/10 rounded-lg">
<span class="material-symbols-outlined text-primary" data-icon="payments">payments</span>
</div>
<span class="text-tertiary text-xs font-bold bg-tertiary-fixed/30 px-2 py-1 rounded-full">+12.4%</span>
</div>
<p class="text-on-surface-variant text-sm font-medium">Total Revenue</p>
<h2 class="text-2xl font-extrabold font-headline text-on-surface mt-1">{formattedKpiRevenue}</h2>
</div>
<!-- Card 2 -->
<div class="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
<div class="flex justify-between items-start mb-4">
<div class="p-2 bg-secondary-container rounded-lg">
<span class="material-symbols-outlined text-primary" data-icon="description">description</span>
</div>
</div>
<p class="text-on-surface-variant text-sm font-medium">Active Quotes</p>
<h2 class="text-2xl font-extrabold font-headline text-on-surface mt-1">{kpiActiveQuotes}</h2>
</div>
<!-- Card 3 -->
<div class="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
<div class="flex justify-between items-start mb-4">
<div class="p-2 bg-tertiary-fixed/30 rounded-lg">
<span class="material-symbols-outlined text-tertiary" data-icon="speed">speed</span>
</div>
</div>
<p class="text-on-surface-variant text-sm font-medium">Peak Utilisation</p>
<h2 class="text-2xl font-extrabold font-headline text-on-surface mt-1">{kpiPeakUsage}</h2>
</div>
<!-- Card 4 -->
<div class="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
<div class="flex justify-between items-start mb-4">
<div class="p-2 bg-surface-container-high rounded-lg">
<span class="material-symbols-outlined text-on-surface-variant" data-icon="timer">timer</span>
</div>
</div>
<p class="text-on-surface-variant text-sm font-medium">Avg Duration</p>
<h2 class="text-2xl font-extrabold font-headline text-on-surface mt-1">{kpiDuration}</h2>
</div>
</section>
<!-- Main Content Split -->
<div class="grid grid-cols-1 xl:grid-cols-12 gap-8">
<!-- Chart Section -->
<section class="xl:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-6">
<div class="flex justify-between items-center mb-8">
<div>
<h3 class="text-lg font-bold font-headline text-on-surface">Resource Utilisation Timeline</h3>
<p class="text-xs text-on-surface-variant font-medium">Projected allocation for FY26</p>
</div>
<div class="flex gap-2">
<button class="px-3 py-1.5 bg-surface-container-low text-xs font-semibold rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">Daily</button>
<button class="px-3 py-1.5 bg-primary text-xs font-semibold rounded-lg text-white">Monthly</button>
</div>
</div>

<div class="filter-row mb-4 flex items-center">
  <span style="font-size:11px;color:var(--color-on-surface-variant);margin-right:8px;">Filter by account:</span>
  <div class="search-container flex items-center border border-outline-variant/30 rounded-lg bg-surface-container-lowest px-2 py-1 flex-1 relative">
      <div class="slds-form-element" style="flex:1;">
          <div class="slds-form-element__control">
              <div class="slds-combobox_container">
                  <div class={dropdownClasses} aria-expanded={isDropdownOpen} aria-haspopup="listbox" role="combobox">
                      <div class="slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right" role="none">
                          <input 
                              class="account-search-input w-full bg-transparent border-none text-sm outline-none shadow-none focus:ring-0 focus:outline-none" 
                              type="search" 
                              placeholder="Search account..." 
                              value={searchTerm} 
                              oninput={handleSearchChange}
                              onclick={handleSearchClick}
                              onblur={handleSearchBlur}
                              autocomplete="off" />
                      </div>
                      <div class="slds-dropdown slds-dropdown_length-5 slds-dropdown_fluid absolute z-50 bg-white shadow-lg rounded mt-1 border border-outline-variant/20 max-h-48 overflow-y-auto" role="listbox" style="transform:none;top:100%;left:0;right:0;">
                          <ul class="slds-listbox slds-listbox_vertical list-none m-0 p-0" role="presentation">
                              <template for:each={filteredAccountOptions} for:item="acc">
                                  <li key={acc} role="presentation" class="slds-listbox__item hover:bg-surface-container-low cursor-pointer px-3 py-2 text-sm text-on-surface" onmousedown={handleAccountSelect} data-val={acc}>
                                      <div class="slds-media slds-listbox__option slds-listbox__option_plain slds-media_small" role="option">
                                          <span class="slds-media__body">
                                              <span class="slds-truncate" title={acc}>{acc}</span>
                                          </span>
                                      </div>
                                  </li>
                              </template>
                              <template if:false={filteredAccountOptions.length}>
                                  <li role="presentation" class="slds-listbox__item px-3 py-2 text-sm text-outline">
                                      <div class="slds-media slds-listbox__option slds-listbox__option_plain slds-media_small" role="option">
                                          <span class="slds-media__body">
                                              <span class="slds-truncate" title="No results">No matching accounts</span>
                                          </span>
                                      </div>
                                  </li>
                              </template>
                          </ul>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      <button 
          onclick={handleSearchSubmit} 
          class="done-btn ml-2 bg-primary text-white text-xs px-3 py-1 rounded hover:bg-primary-container transition-colors">
          Done
      </button>
  </div>
</div>

<div class="timeline-wrap" lwc:dom="manual"></div>
<div class="legend-row mt-4 flex flex-wrap gap-4 text-xs font-medium text-on-surface-variant cursor-pointer" lwc:dom="manual"></div>

</section>

<!-- Configuration/Table Section -->
<section class="xl:col-span-4 flex flex-col gap-6">
<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-6 overflow-hidden flex flex-col h-full">
<div class="flex justify-between items-center mb-6">
<h3 class="text-lg font-bold font-headline text-on-surface">Discount Tiers</h3>
<button class="text-primary text-xs font-bold hover:underline flex items-center gap-1">
<span class="material-symbols-outlined text-sm" data-icon="add_circle">add_circle</span>
                                ADD DISCOUNT TIER
                            </button>
</div>

<!-- Tiers list delegated to component, embedded -->
<div class="tiers-body custom-scrollbar flex-1 mb-4" style="min-height:200px;">
<c-cpq-product-discount-tiers record-id={recordId} object-api-name="${objectApiName}"></c-cpq-product-discount-tiers>
</div>

<!-- Summary Panel -->
<template if:true={item}>
<div class="mt-auto pt-6 border-t border-outline-variant/30">
<div class="bg-surface-container p-5 rounded-xl">
<div class="flex items-center gap-2 mb-4">
<span class="material-symbols-outlined text-primary text-sm" data-icon="settings_input_component">settings_input_component</span>
<h4 class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">TUNE CONFIGURATION SUMMARY</h4>
</div>
<div class="space-y-3">
<div class="flex justify-between items-center">
<span class="text-xs font-medium text-on-surface-variant">Name</span>
<span class="text-xs font-bold text-on-surface">{item.Name__c}</span>
</div>
<div class="flex justify-between items-center">
<span class="text-xs font-medium text-on-surface-variant">Billing Unit</span>
<span class="text-xs font-bold text-on-surface">{item.Billing_Unit__c}</span>
</div>
<div class="flex justify-between items-center">
<span class="text-xs font-medium text-on-surface-variant">${idLabel}</span>
<span class="text-xs font-bold text-on-surface">{item.Name}</span>
</div>
</div>
<button class="w-full mt-5 bg-white border border-outline-variant/50 text-on-surface text-xs font-bold py-2.5 rounded-lg shadow-sm hover:bg-surface-container-lowest transition-all">
                                    APPLY ALL CHANGES
                                </button>
</div>
</div>
</template>
</div>
</section>
</div>
<div class="tooltip-box absolute z-50 bg-inverse-surface text-inverse-on-surface text-xs rounded-lg p-3 shadow-lg pointer-events-none" style="display:none;" lwc:dom="manual"></div>

</main>
</template>`;

fs.writeFileSync('force-app/main/default/lwc/cpqResourceRoleRecordPage/cpqResourceRoleRecordPage.html', generateHTML('Resource Roles', 'Resource Role', 'Role ID', 'Resource_Role__c'));
fs.writeFileSync('force-app/main/default/lwc/cpqAddOnRecordPage/cpqAddOnRecordPage.html', generateHTML('Add-ons', 'Add-on', 'Add-on ID', 'Add_On__c'));

console.log("HTML templates updated successfully!");

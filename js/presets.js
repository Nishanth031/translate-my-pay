/*
 * Translate-My-Pay — judge demo scenarios and quick-action catalogues.
 * Each preset builds a fresh plan; toInput() turns a plan into engine input.
 */
(function (root) {
  'use strict';

  var baseIncomes = function () {
    return [
      { id: 'in-allowance', label: 'Family Allowance', amount: '3500', kind: 'Allowance' },
      { id: 'in-stipend', label: 'Campus Stipend', amount: '1500', kind: 'Stipend' }
    ];
  };
  var baseBills = function () {
    return [
      { id: 'bill-rent', label: 'Hostel / Rent', amount: '2000', active: true },
      { id: 'bill-phone', label: 'Phone & Data', amount: '400', active: true },
      { id: 'bill-mess', label: 'Electricity / Mess', amount: '600', active: true }
    ];
  };

  var PRESETS = [
    {
      id: 'baseline', n: 1, title: 'Baseline Student', detail: '₹5,000 In · ₹3,000 Vault · 5 days = ₹400/day',
      build: function () { return { incomes: baseIncomes(), bills: baseBills(), priorDaysSpent: 0, todaySpends: [], daysLeft: 5 }; }
    },
    {
      id: 'chaos', n: 2, title: 'Chaos Overspend', detail: '₹1,000 spent on Day 1 → ₹250/day',
      build: function () {
        return { incomes: baseIncomes(), bills: baseBills(), priorDaysSpent: 0, todaySpends: [{ id: 'sp-sneakers', label: 'Impulse buy — sneakers', amount: 1000 }], daysLeft: 5 };
      }
    },
    {
      id: 'bridge', n: 3, title: 'Bridge Mode Shortfall', detail: 'Fun Money ₹0 → calm gray recovery',
      build: function () {
        return { incomes: baseIncomes(), bills: baseBills(), priorDaysSpent: 1200, todaySpends: [{ id: 'sp-charger', label: 'Laptop charger replacement', amount: 1000 }], daysLeft: 4 };
      }
    },
    {
      id: 'gig', n: 4, title: 'Gig Payout Arrival', detail: '+₹2,400 freelance design gig',
      build: function () {
        return {
          incomes: baseIncomes().concat([{ id: 'in-gig', label: 'Freelance Design Gig', amount: '2400', kind: 'Gig' }]),
          bills: baseBills(), priorDaysSpent: 0, todaySpends: [], daysLeft: 5
        };
      }
    }
  ];

  var QUICK_INCOME = [
    { label: 'Freelance Design Gig', amount: 2400, kind: 'Gig' },
    { label: 'Campus Stipend Top-up', amount: 1500, kind: 'Stipend' },
    { label: 'Tutoring Session', amount: 500, kind: 'Gig' },
    { label: 'Pocket Money from Family', amount: 1000, kind: 'Allowance' }
  ];

  var CHAOS_ITEMS = [
    { label: 'Chai & snacks', amount: 150 },
    { label: 'Weekend trip with friends', amount: 1800 },
    { label: 'Phone screen repair', amount: 2500 }
  ];

  var SIM_CHIPS = [
    { item: 'Movie & Popcorn', price: 350 },
    { item: 'Concert Ticket', price: 800 },
    { item: 'Bluetooth Earbuds', price: 1200 },
    { item: 'Phone Repair', price: 2200 }
  ];

  function toInput(plan) {
    var spentToday = (plan.todaySpends || []).reduce(function (t, s) { return t + (Number(s.amount) || 0); }, 0);
    return { incomes: plan.incomes, bills: plan.bills, priorDaysSpent: plan.priorDaysSpent, spentToday: spentToday, daysLeft: plan.daysLeft };
  }

  var api = { PRESETS: PRESETS, QUICK_INCOME: QUICK_INCOME, CHAOS_ITEMS: CHAOS_ITEMS, SIM_CHIPS: SIM_CHIPS, baseIncomes: baseIncomes, baseBills: baseBills, toInput: toInput };
  root.TMPPresets = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

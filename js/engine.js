/*
 * Translate-My-Pay — deterministic money engine.
 *
 * The single source of truth. "Show Your Work", "Auto-Rebalance" and
 * "Can I Afford This?" all call computeEngine(); nothing else does math.
 * Plain ES5 so it runs untouched in the browser and in Node tests.
 */
(function (root) {
  'use strict';

  function toAmount(value) {
    var n = Number(value);
    return isFinite(n) && n > 0 ? n : 0;
  }
  function sumAmounts(list) {
    return (list || []).reduce(function (total, item) { return total + toAmount(item && item.amount); }, 0);
  }
  function clampDays(days) {
    var n = Math.round(Number(days));
    if (!isFinite(n)) n = 1;
    return Math.min(30, Math.max(1, n));
  }

  function computeEngine(input, options) {
    var plannedPurchase = toAmount(options && options.plannedPurchase);
    var activeBills = (input.bills || []).filter(function (b) { return b.active !== false; });
    var daysLeft = clampDays(input.daysLeft);
    var priorDaysSpent = toAmount(input.priorDaysSpent);
    var spentToday = toAmount(input.spentToday);

    var totalMoneyIn = sumAmounts(input.incomes);
    var vaultReserved = sumAmounts(activeBills);
    var totalFlexiblePool = totalMoneyIn - vaultReserved;
    // Fun Money available at the start of today (a simulated purchase is committed up front).
    var startOfDayFlexible = totalFlexiblePool - priorDaysSpent - plannedPurchase;
    var initialDailyAllotment = Math.max(0, startOfDayFlexible) / daysLeft;
    var remainingFlexible = startOfDayFlexible - spentToday;
    var daysAfterToday = daysLeft - 1;

    var isOverspend = spentToday > initialDailyAllotment;
    var todayOverspend = isOverspend ? spentToday - initialDailyAllotment : 0;
    // Within pace: safeToSpendToday = (pool − prior) / daysLeft − spentToday
    var safeToSpendToday = isOverspend ? 0 : initialDailyAllotment - spentToday;
    // Overspend: the deficit is absorbed by what's left, spread over the days after today.
    var rebalancedDaily = daysAfterToday > 0 ? Math.max(0, remainingFlexible) / daysAfterToday : 0;
    var dailyFromTomorrow = isOverspend ? rebalancedDaily : initialDailyAllotment;
    var headlineDaily = isOverspend ? rebalancedDaily : initialDailyAllotment;

    var isBridge = remainingFlexible <= 0;
    var shortfall = isBridge ? 0 - remainingFlexible : 0;
    var vaultFullyFunded = totalMoneyIn >= vaultReserved;

    var baselineDaily = initialDailyAllotment;
    var paceRatio = baselineDaily > 0 ? headlineDaily / baselineDaily : 0;
    var weather = isBridge ? 'bridge' : paceRatio >= 0.75 ? 'green' : paceRatio >= 0.25 ? 'yellow' : 'red';

    var trajectory = [];
    for (var i = 0; i < daysLeft; i++) trajectory.push(i === 0 ? initialDailyAllotment : dailyFromTomorrow);

    return {
      totalMoneyIn: totalMoneyIn,
      vaultReserved: vaultReserved,
      billCount: activeBills.length,
      totalFlexiblePool: totalFlexiblePool,
      priorDaysSpent: priorDaysSpent,
      plannedPurchase: plannedPurchase,
      spentToday: spentToday,
      daysLeft: daysLeft,
      daysAfterToday: daysAfterToday,
      startOfDayFlexible: startOfDayFlexible,
      initialDailyAllotment: initialDailyAllotment,
      remainingFlexible: remainingFlexible,
      isOverspend: isOverspend,
      todayOverspend: todayOverspend,
      safeToSpendToday: safeToSpendToday,
      rebalancedDaily: rebalancedDaily,
      dailyFromTomorrow: dailyFromTomorrow,
      headlineDaily: headlineDaily,
      isBridge: isBridge,
      shortfall: shortfall,
      vaultFullyFunded: vaultFullyFunded,
      vaultGap: vaultFullyFunded ? 0 : vaultReserved - totalMoneyIn,
      baselineDaily: baselineDaily,
      paceRatio: paceRatio,
      weather: weather,
      trajectory: trajectory
    };
  }

  // "Can I Afford This?" — runs the same engine twice: as-is, and with the purchase committed.
  function simulatePurchase(input, price) {
    var p = toAmount(price);
    var before = computeEngine(input);
    var after = computeEngine(input, { plannedPurchase: p });
    var funMoneyLeft = Math.max(0, before.remainingFlexible);
    var vaultBreach = p > funMoneyLeft ? p - funMoneyLeft : 0;
    var dropRatio = before.headlineDaily > 0 ? after.headlineDaily / before.headlineDaily : 0;
    var verdict;
    if (p === 0) verdict = 'idle';
    else if (before.isBridge) verdict = 'bridge';
    else if (vaultBreach > 0) verdict = 'breach';
    else verdict = dropRatio >= 0.75 ? 'safe' : dropRatio >= 0.25 ? 'caution' : 'tight';
    return {
      price: p,
      before: before,
      after: after,
      funMoneyLeft: funMoneyLeft,
      vaultBreach: vaultBreach,
      dropRatio: dropRatio,
      verdict: verdict,
      daysAffected: after.isOverspend ? after.daysAfterToday : after.daysLeft
    };
  }

  var api = { computeEngine: computeEngine, simulatePurchase: simulatePurchase, toAmount: toAmount, sumAmounts: sumAmounts };
  root.TMPEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

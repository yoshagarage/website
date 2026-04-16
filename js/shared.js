/* ===== VISITOR COUNTER ===== */
(function() {
  var counter = document.getElementById('vc');
  if (!counter) return;

  var counterWrapper = counter.parentElement;
  var currentValue = Math.floor(Math.random() * 6000) + 4000;
  var boostTimer = null;
  var boostStartedAt = 0;
  var activePointerId = null;
  var prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function renderCounter() {
    counter.textContent = currentValue.toLocaleString('en-AU');
  }

  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getBoostAmount(elapsedMs) {
    if (elapsedMs < 1000) {
      return getRandomInt(1, 5);
    }

    if (elapsedMs < 3000) {
      return getRandomInt(10, 100);
    }

    return getRandomInt(100, 500);
  }

  function stopBoost() {
    if (boostTimer) {
      window.clearTimeout(boostTimer);
    }

    boostTimer = null;
    boostStartedAt = 0;
    activePointerId = null;
  }

  function scheduleBoostTick() {
    boostTimer = window.setTimeout(function() {
      currentValue += getBoostAmount(Date.now() - boostStartedAt);
      renderCounter();
      scheduleBoostTick();
    }, 500);
  }

  function startBoost(pointerId) {
    if (boostTimer || prefersReducedMotion) return;

    boostStartedAt = Date.now();
    activePointerId = typeof pointerId === 'number' ? pointerId : null;
    scheduleBoostTick();
  }

  renderCounter();

  if (!counterWrapper || prefersReducedMotion) {
    return;
  }

  counterWrapper.addEventListener('pointerenter', function(event) {
    if (event.pointerType === 'mouse') {
      startBoost();
    }
  });

  counterWrapper.addEventListener('pointerleave', function(event) {
    if (event.pointerType === 'mouse') {
      stopBoost();
    }
  });

  counterWrapper.addEventListener('pointerdown', function(event) {
    if (event.pointerType === 'mouse') return;

    activePointerId = event.pointerId;

    if (typeof counterWrapper.setPointerCapture === 'function') {
      try {
        counterWrapper.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore capture failures and fall back to local events.
      }
    }

    startBoost(event.pointerId);
  });

  counterWrapper.addEventListener('pointerup', function(event) {
    if (activePointerId !== null && event.pointerId !== activePointerId) return;
    stopBoost();
  });

  counterWrapper.addEventListener('pointercancel', function(event) {
    if (activePointerId !== null && event.pointerId !== activePointerId) return;
    stopBoost();
  });

  counterWrapper.addEventListener('lostpointercapture', function() {
    stopBoost();
  });
})();

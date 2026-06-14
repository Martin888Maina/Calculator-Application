// Core calculator engine for standard mode. Handles digit and decimal entry,
// the four basic operators, equals, the unary helpers (square root, square,
// reciprocal), sign toggle, percentage, clearing, and backspace. Operators
// use immediate execution: each new operator applies to the running result,
// which is how a basic desktop calculator behaves (precedence-aware
// evaluation arrives with scientific mode in a later phase).

(function () {
  'use strict';

  // Operator metadata: the glyph shown on the expression line and the
  // function that performs the calculation. Minus, multiply, and divide use
  // the typographic characters that match the on-screen keys.
  var OPERATORS = {
    add: { symbol: '+', apply: function (a, b) { return a + b; } },
    subtract: { symbol: '−', apply: function (a, b) { return a - b; } },
    multiply: { symbol: '×', apply: function (a, b) { return a * b; } },
    divide: { symbol: '÷', apply: function (a, b) { return a / b; } }
  };

  var resultEl = document.getElementById('result');
  var expressionEl = document.getElementById('expression');
  var memoryIndicatorEl = document.getElementById('memoryIndicator');
  var historyEl = document.getElementById('history');
  var historyListEl = document.getElementById('historyList');
  var clearHistoryEl = document.getElementById('clearHistory');

  var modeToggleEl = document.querySelector('.mode-toggle');

  // localStorage keys for the values that persist across sessions.
  var STORAGE_MEMORY = 'calculator.memory';
  var STORAGE_HISTORY = 'calculator.history';
  var STORAGE_MODE = 'calculator.mode';
  var HISTORY_LIMIT = 50;
  var MODES = ['standard', 'scientific', 'programmer'];

  // current:   operand shown on the result line, kept as a string so digit
  //            entry is simple.
  // previous:  stored left-hand operand once an operator is chosen.
  // operator:  pending operator key, or null when none is active.
  // overwrite: when true the next digit replaces the display instead of
  //            appending to it. True at start, after an operator, and after
  //            equals.
  // errored:   set when a calculation fails; the next key press clears the
  //            message and starts fresh.
  var current = '0';
  var previous = null;
  var operator = null;
  var overwrite = true;
  var errored = false;

  // memory:  single stored value behind the M-keys.
  // history: most-recent-first list of { expr, result } records.
  // mode:    active keypad ("standard", "scientific", or "programmer").
  var memory = 0;
  var history = [];
  var mode = 'standard';

  // --- Entry -------------------------------------------------------

  function inputDigit(digit) {
    if (overwrite) {
      current = digit;
      overwrite = false;
    } else if (current === '0') {
      // Avoid leading zeros such as "007".
      current = digit;
    } else {
      current += digit;
    }
    render();
  }

  function inputDecimal() {
    if (overwrite) {
      current = '0.';
      overwrite = false;
    } else if (current.indexOf('.') === -1) {
      // Single-decimal guard: ignore extra decimal points.
      current += '.';
    }
    render();
  }

  function toggleSign() {
    if (current === '0') {
      return;
    }
    current = current.charAt(0) === '-' ? current.slice(1) : '-' + current;
    render();
  }

  function deleteLast() {
    if (overwrite) {
      return;
    }
    if (current.length <= 1 || (current.length === 2 && current.charAt(0) === '-')) {
      current = '0';
      overwrite = true;
    } else {
      current = current.slice(0, -1);
    }
    render();
  }

  function clearAll() {
    current = '0';
    previous = null;
    operator = null;
    overwrite = true;
    errored = false;
    expressionEl.textContent = '';
    render();
  }

  // --- Operators ---------------------------------------------------

  function chooseOperator(nextOperator) {
    // If an operator is already pending and a fresh operand has been typed,
    // evaluate that step first so its result carries into the next one.
    if (operator !== null && !overwrite) {
      var right = parseFloat(current);
      if (operator === 'divide' && right === 0) {
        setError('Cannot divide by zero');
        return;
      }
      var chained = OPERATORS[operator].apply(previous, right);
      if (!isFinite(chained)) {
        setError('Out of range');
        return;
      }
      previous = chained;
      current = formatNumber(previous);
    } else {
      previous = parseFloat(current);
    }

    operator = nextOperator;
    overwrite = true;
    expressionEl.textContent =
      formatDisplay(formatNumber(previous)) + ' ' + OPERATORS[operator].symbol;
    resultEl.textContent = formatDisplay(current);
  }

  function evaluate() {
    // A complete "a op b" expression is required; ignore equals otherwise.
    if (operator === null || overwrite) {
      return;
    }

    var left = previous;
    var right = parseFloat(current);
    if (operator === 'divide' && right === 0) {
      setError('Cannot divide by zero');
      return;
    }

    var result = OPERATORS[operator].apply(left, right);
    if (!isFinite(result)) {
      setError('Out of range');
      return;
    }

    var exprText =
      formatDisplay(formatNumber(left)) + ' ' + OPERATORS[operator].symbol + ' ' +
      formatDisplay(formatNumber(right));
    expressionEl.textContent = exprText + ' =';

    current = formatNumber(result);
    previous = null;
    operator = null;
    overwrite = true;
    render();
    addHistory(exprText, current);
  }

  function applyPercent() {
    var value = parseFloat(current);
    // With a pending operator, percent is taken relative to the stored
    // left-hand operand (e.g. "200 + 10%" yields 200 + 20). Otherwise it is
    // a plain divide-by-one-hundred.
    var result = (operator !== null && previous !== null)
      ? previous * (value / 100)
      : value / 100;
    current = formatNumber(result);
    overwrite = false;
    render();
  }

  // Square root, square, and reciprocal apply immediately to the current
  // value and show the operation on the expression line.
  function applyUnary(action) {
    var value = parseFloat(current);
    var shown = formatDisplay(formatNumber(value));
    var result;
    var label;

    if (action === 'sqrt') {
      if (value < 0) {
        setError('Invalid input');
        return;
      }
      result = Math.sqrt(value);
      label = '√(' + shown + ')';
    } else if (action === 'square') {
      result = value * value;
      label = shown + '²';
    } else {
      if (value === 0) {
        setError('Cannot divide by zero');
        return;
      }
      result = 1 / value;
      label = '1/(' + shown + ')';
    }

    if (!isFinite(result)) {
      setError('Out of range');
      return;
    }

    current = formatNumber(result);
    overwrite = true;
    expressionEl.textContent = label;
    render();
  }

  // --- Helpers -----------------------------------------------------

  // Show a friendly message and reset the working state so the next key
  // press starts a clean calculation rather than crashing.
  function setError(message) {
    current = '0';
    previous = null;
    operator = null;
    overwrite = true;
    errored = true;
    expressionEl.textContent = '';
    resultEl.textContent = message;
  }

  // Round away binary floating-point noise (for example 0.1 + 0.2) while
  // leaving ordinary values untouched, then return a plain numeric string.
  function formatNumber(value) {
    if (!isFinite(value)) {
      return String(value);
    }
    var rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
    return String(rounded);
  }

  // Add thousands separators to the integer part for readability. This is a
  // display-only transform; the stored operand string is never grouped.
  function formatDisplay(numStr) {
    if (numStr.indexOf('e') !== -1 || numStr.indexOf('E') !== -1 ||
        numStr === 'Infinity' || numStr === '-Infinity' || numStr === 'NaN') {
      return numStr;
    }
    var negative = numStr.charAt(0) === '-';
    var body = negative ? numStr.slice(1) : numStr;
    var parts = body.split('.');
    var grouped = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = parts.length > 1 ? grouped + '.' + parts[1] : grouped;
    return (negative ? '-' : '') + out;
  }

  function render() {
    resultEl.textContent = formatDisplay(current);
  }

  // --- Memory ------------------------------------------------------

  function memoryStore() {
    memory = roundValue(parseFloat(current) || 0);
    overwrite = true;
    saveMemory();
    updateMemoryIndicator();
  }

  function memoryAdd() {
    memory = roundValue(memory + (parseFloat(current) || 0));
    overwrite = true;
    saveMemory();
    updateMemoryIndicator();
  }

  function memorySubtract() {
    memory = roundValue(memory - (parseFloat(current) || 0));
    overwrite = true;
    saveMemory();
    updateMemoryIndicator();
  }

  function memoryRecall() {
    current = formatNumber(memory);
    overwrite = true;
    render();
  }

  function memoryClear() {
    memory = 0;
    saveMemory();
    updateMemoryIndicator();
  }

  // The badge is only meaningful when something is stored.
  function updateMemoryIndicator() {
    if (memory !== 0) {
      memoryIndicatorEl.removeAttribute('hidden');
    } else {
      memoryIndicatorEl.setAttribute('hidden', '');
    }
  }

  function roundValue(value) {
    return parseFloat(formatNumber(value));
  }

  // --- History -----------------------------------------------------

  function addHistory(expr, rawResult) {
    history.unshift({ expr: expr, result: rawResult });
    if (history.length > HISTORY_LIMIT) {
      history.length = HISTORY_LIMIT;
    }
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    historyListEl.textContent = '';

    if (history.length === 0) {
      historyEl.setAttribute('hidden', '');
      return;
    }
    historyEl.removeAttribute('hidden');

    for (var i = 0; i < history.length; i++) {
      var entry = history[i];

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'history__entry';
      button.dataset.result = entry.result;

      var expr = document.createElement('span');
      expr.className = 'history__expr';
      expr.textContent = entry.expr + ' =';

      var value = document.createElement('span');
      value.className = 'history__value';
      value.textContent = formatDisplay(entry.result);

      button.appendChild(expr);
      button.appendChild(value);

      var item = document.createElement('li');
      item.className = 'history__item';
      item.appendChild(button);
      historyListEl.appendChild(item);
    }
  }

  function clearHistory() {
    history = [];
    saveHistory();
    renderHistory();
  }

  // Load a stored result back onto the display for reuse in a new
  // calculation.
  function recallResult(rawResult) {
    current = rawResult;
    previous = null;
    operator = null;
    overwrite = true;
    errored = false;
    expressionEl.textContent = '';
    render();
  }

  // --- Mode switching ----------------------------------------------

  // Show the panel for the chosen mode, mark its toggle button active, and
  // remember the choice. Standard mode keeps the existing keypad and logic;
  // the other panels are filled in by later phases.
  function setMode(nextMode) {
    if (MODES.indexOf(nextMode) === -1) {
      nextMode = 'standard';
    }
    mode = nextMode;

    var buttons = modeToggleEl.querySelectorAll('.mode-toggle__btn');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-selected', buttons[i].dataset.mode === mode ? 'true' : 'false');
    }

    var panels = document.querySelectorAll('[data-mode-panel]');
    for (var j = 0; j < panels.length; j++) {
      panels[j].hidden = panels[j].dataset.modePanel !== mode;
    }

    saveMode();
  }

  // --- Persistence -------------------------------------------------
  // localStorage can be unavailable (private browsing, blocked storage), so
  // every access is guarded and silently falls back to in-memory state.

  function loadState() {
    try {
      var storedMemory = window.localStorage.getItem(STORAGE_MEMORY);
      if (storedMemory !== null) {
        memory = parseFloat(storedMemory) || 0;
      }
      var storedHistory = window.localStorage.getItem(STORAGE_HISTORY);
      if (storedHistory !== null) {
        var parsed = JSON.parse(storedHistory);
        if (Array.isArray(parsed)) {
          history = parsed;
        }
      }
      var storedMode = window.localStorage.getItem(STORAGE_MODE);
      if (MODES.indexOf(storedMode) !== -1) {
        mode = storedMode;
      }
    } catch (error) {
      memory = 0;
      history = [];
      mode = 'standard';
    }
    updateMemoryIndicator();
    renderHistory();
    setMode(mode);
  }

  function saveMemory() {
    try {
      window.localStorage.setItem(STORAGE_MEMORY, String(memory));
    } catch (error) {
      /* Storage unavailable; keep the value in memory only. */
    }
  }

  function saveHistory() {
    try {
      window.localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
    } catch (error) {
      /* Storage unavailable; keep the list in memory only. */
    }
  }

  function saveMode() {
    try {
      window.localStorage.setItem(STORAGE_MODE, mode);
    } catch (error) {
      /* Storage unavailable; keep the choice in memory only. */
    }
  }

  // --- Events ------------------------------------------------------

  var ACTIONS = {
    decimal: inputDecimal,
    negate: toggleSign,
    percent: applyPercent,
    clear: clearAll,
    delete: deleteLast,
    equals: evaluate,
    sqrt: function () { applyUnary('sqrt'); },
    square: function () { applyUnary('square'); },
    reciprocal: function () { applyUnary('reciprocal'); },
    'memory-clear': memoryClear,
    'memory-recall': memoryRecall,
    'memory-add': memoryAdd,
    'memory-subtract': memorySubtract,
    'memory-store': memoryStore
  };

  // Dispatch a single button press based on its data role.
  function handlePress(button) {
    // Clear a previous error before processing anything except an explicit
    // all-clear, which already resets everything.
    if (errored && button.dataset.action !== 'clear') {
      errored = false;
      expressionEl.textContent = '';
      render();
    }

    if (button.dataset.digit !== undefined) {
      inputDigit(button.dataset.digit);
    } else if (button.dataset.operator !== undefined) {
      chooseOperator(button.dataset.operator);
    } else if (button.dataset.action && ACTIONS[button.dataset.action]) {
      ACTIONS[button.dataset.action]();
    }
  }

  // One delegated listener per control group. The memory bar and keypad both
  // route through the same dispatch.
  function delegate(container) {
    container.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (button && container.contains(button)) {
        handlePress(button);
      }
    });
  }

  delegate(document.querySelector('.memory-bar'));
  delegate(document.querySelector('.keypad'));

  // Tapping a history entry reuses its result; the clear button empties the
  // list.
  historyListEl.addEventListener('click', function (event) {
    var entry = event.target.closest('.history__entry');
    if (entry) {
      recallResult(entry.dataset.result);
    }
  });

  clearHistoryEl.addEventListener('click', clearHistory);

  // Mode selector.
  modeToggleEl.addEventListener('click', function (event) {
    var button = event.target.closest('.mode-toggle__btn');
    if (button) {
      setMode(button.dataset.mode);
    }
  });

  // --- Keyboard ----------------------------------------------------

  // Map a keyboard event to the on-screen button it should activate. Both
  // "Enter" and "=" trigger equals; "Escape" clears everything.
  function buttonForKey(event) {
    var key = event.key;
    if (key >= '0' && key <= '9') {
      return document.querySelector('[data-digit="' + key + '"]');
    }
    switch (key) {
      case '.': return document.querySelector('[data-action="decimal"]');
      case '+': return document.querySelector('[data-operator="add"]');
      case '-': return document.querySelector('[data-operator="subtract"]');
      case '*': return document.querySelector('[data-operator="multiply"]');
      case '/': return document.querySelector('[data-operator="divide"]');
      case '%': return document.querySelector('[data-action="percent"]');
      case '=':
      case 'Enter': return document.querySelector('[data-action="equals"]');
      case 'Backspace': return document.querySelector('[data-action="delete"]');
      case 'Escape': return document.querySelector('[data-action="clear"]');
      default: return null;
    }
  }

  // Briefly mirror a key press on its on-screen button so typing feels
  // connected to the keypad.
  function flash(button) {
    button.classList.add('is-active');
    window.setTimeout(function () {
      button.classList.remove('is-active');
    }, 120);
  }

  document.addEventListener('keydown', function (event) {
    // Leave browser and system shortcuts (copy, refresh, and so on) alone.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    var button = buttonForKey(event);
    if (!button) {
      return;
    }

    // Stop the key's default behaviour (such as Backspace navigating back or
    // Enter re-activating a focused button) and drive the keypad instead.
    event.preventDefault();
    flash(button);
    button.click();
  });

  // --- Init --------------------------------------------------------

  loadState();
  render();
})();

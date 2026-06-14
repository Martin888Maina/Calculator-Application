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

    expressionEl.textContent =
      formatDisplay(formatNumber(left)) + ' ' + OPERATORS[operator].symbol + ' ' +
      formatDisplay(formatNumber(right)) + ' =';

    current = formatNumber(result);
    previous = null;
    operator = null;
    overwrite = true;
    render();
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
    reciprocal: function () { applyUnary('reciprocal'); }
  };

  // One delegated listener for the whole keypad. The pressed button's data
  // role decides which handler runs.
  document.querySelector('.keypad').addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button) {
      return;
    }

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

  render();
})();

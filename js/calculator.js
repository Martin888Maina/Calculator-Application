// Core calculator engine for standard mode. Handles digit entry, the four
// basic operators, and equals. Operators use immediate execution: each new
// operator applies to the running result, which is how a basic desktop
// calculator behaves (precedence-aware evaluation arrives with scientific
// mode in a later phase).

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
  var current = '0';
  var previous = null;
  var operator = null;
  var overwrite = true;

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

  function chooseOperator(nextOperator) {
    // If an operator is already pending and a fresh operand has been typed,
    // evaluate that step first so its result carries into the next one.
    if (operator !== null && !overwrite) {
      previous = OPERATORS[operator].apply(previous, parseFloat(current));
      current = formatNumber(previous);
    } else {
      previous = parseFloat(current);
    }

    operator = nextOperator;
    overwrite = true;
    expressionEl.textContent = formatNumber(previous) + ' ' + OPERATORS[operator].symbol;
    resultEl.textContent = current;
  }

  function evaluate() {
    // A complete "a op b" expression is required; ignore equals otherwise.
    if (operator === null || overwrite) {
      return;
    }

    var left = previous;
    var right = parseFloat(current);
    var result = OPERATORS[operator].apply(left, right);

    expressionEl.textContent =
      formatNumber(left) + ' ' + OPERATORS[operator].symbol + ' ' +
      formatNumber(right) + ' =';

    current = formatNumber(result);
    previous = null;
    operator = null;
    overwrite = true;
    resultEl.textContent = current;
  }

  // Round away binary floating-point noise (for example 0.1 + 0.2) while
  // leaving ordinary values untouched, then return a plain display string.
  function formatNumber(value) {
    if (!isFinite(value)) {
      return String(value);
    }
    var rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
    return String(rounded);
  }

  function render() {
    resultEl.textContent = current;
  }

  // One delegated listener for the whole keypad. The pressed button's data
  // role decides which handler runs.
  document.querySelector('.keypad').addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button) {
      return;
    }

    if (button.dataset.digit !== undefined) {
      inputDigit(button.dataset.digit);
    } else if (button.dataset.operator !== undefined) {
      chooseOperator(button.dataset.operator);
    } else if (button.dataset.action === 'equals') {
      evaluate();
    }
  });

  render();
})();

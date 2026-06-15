// Core calculator engine for standard mode. Handles digit and decimal entry,
// the four basic operators, equals, the unary helpers (square root, square,
// reciprocal), sign toggle, percentage, clearing, and backspace. Operators
// use immediate execution: each new operator applies to the running result,
// which is how a basic desktop calculator behaves (precedence-aware
// evaluation is handled separately by scientific mode).

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
  var calculatorEl = document.querySelector('.calculator');
  var sciControlsEl = document.getElementById('sciControls');
  var angleToggleEl = document.getElementById('angleToggle');
  var sciNotationToggleEl = document.getElementById('sciNotationToggle');
  var progBasesEl = document.getElementById('progBases');

  // localStorage keys for the values that persist across sessions.
  var STORAGE_MEMORY = 'calculator.memory';
  var STORAGE_HISTORY = 'calculator.history';
  var STORAGE_MODE = 'calculator.mode';
  var STORAGE_ANGLE = 'calculator.angle';
  var STORAGE_SCINOTATION = 'calculator.sciNotation';
  var STORAGE_PROGBASE = 'calculator.progBase';
  var HISTORY_LIMIT = 50;
  var MODES = ['standard', 'scientific', 'programmer'];
  var PROG_BASES = [2, 8, 10, 16];

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

  // Scientific mode builds a full expression string instead of executing
  // immediately.
  // sciInput:    the expression shown on the display, using glyphs.
  // ans:         the last scientific result, recalled by the ANS key.
  // sciDone:     true right after equals, so the next entry starts fresh.
  // sciErrored:  true after a malformed expression; cleared on next input.
  var sciInput = '';
  var ans = 0;
  var sciDone = false;
  var sciErrored = false;

  // angleMode:   "DEG" or "RAD"; affects the trigonometric functions.
  // sciNotation: when true, results display in exponential form.
  var angleMode = 'DEG';
  var sciNotation = false;

  // Programmer mode works on integers across four bases with immediate
  // execution, similar to standard mode but with bitwise operators.
  // progValue:    digits of the current value in the active base.
  // progBase:     active base (2, 8, 10, or 16).
  // progPrevious: stored left operand (decimal), or null.
  // progOperator: pending bitwise operator name, or null.
  var progValue = '0';
  var progBase = 10;
  var progPrevious = null;
  var progOperator = null;
  var progOverwrite = true;
  var progErrored = false;

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

  // --- Scientific mode ---------------------------------------------

  function renderSci() {
    resultEl.textContent = sciInput === '' ? '0' : sciInput;
  }

  // Keys that operate on the value to their left, so that pressing them just
  // after a result continues from that result rather than starting over.
  function continuesFromResult(text) {
    return text === '+' || text === '−' || text === '×' || text === '÷' ||
      text === '^' || text === '^3' || text === 'mod' || text === '!';
  }

  // Append a literal (digit, operator, function, parenthesis, or decimal
  // point) to the scientific expression. After a result, an operator-style key
  // continues from that result while anything else begins a new expression.
  function sciAppend(text) {
    if (sciDone) {
      if (continuesFromResult(text)) {
        sciInput = formatNumber(ans);
      } else {
        sciInput = '';
        expressionEl.textContent = '';
      }
      sciDone = false;
    }
    sciInput += text;
    renderSci();
  }

  // Insert the previous answer. A negative value is wrapped in parentheses so
  // it composes correctly inside the surrounding expression.
  function sciAnswer() {
    if (sciDone) {
      sciInput = '';
      expressionEl.textContent = '';
      sciDone = false;
    }
    var token = formatNumber(ans);
    sciInput += ans < 0 ? '(' + token + ')' : token;
    renderSci();
  }

  function sciDelete() {
    if (sciDone) {
      sciDone = false;
      expressionEl.textContent = '';
    }
    sciInput = sciInput.slice(0, -1);
    renderSci();
  }

  function sciClear() {
    sciInput = '';
    sciDone = false;
    sciErrored = false;
    expressionEl.textContent = '';
    resultEl.textContent = '0';
  }

  function sciEvaluate() {
    if (sciInput === '') {
      return;
    }

    var result;
    try {
      var env = CalculatorScientific.getEnvironment(angleMode);
      result = CalculatorParser.evaluate(sciInput, env);
    } catch (error) {
      setSciError(error.message);
      return;
    }

    var resultStr = formatNumber(result);
    expressionEl.textContent = sciInput + ' =';
    addHistory(sciInput, resultStr);

    ans = result;
    sciInput = resultStr;
    sciDone = true;
    resultEl.textContent = formatSci(result);
  }

  function setSciError(message) {
    sciInput = '';
    sciDone = false;
    sciErrored = true;
    expressionEl.textContent = '';
    resultEl.textContent = message;
  }

  // Format a result for the scientific display, honouring the notation
  // toggle. Off uses the grouped decimal form; on uses exponential form.
  function formatSci(value) {
    if (!isFinite(value)) {
      return String(value);
    }
    return sciNotation ? value.toExponential() : formatDisplay(formatNumber(value));
  }

  // --- Scientific toggles ------------------------------------------

  function toggleAngleMode() {
    angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG';
    updateAngleUI();
    saveAngle();
  }

  function updateAngleUI() {
    angleToggleEl.textContent = angleMode;
  }

  function toggleSciNotation() {
    sciNotation = !sciNotation;
    updateSciNotationUI();
    saveSciNotation();
    // Reformat the currently shown result so the change is visible at once.
    if (mode === 'scientific' && sciDone) {
      resultEl.textContent = formatSci(ans);
    }
  }

  function updateSciNotationUI() {
    sciNotationToggleEl.setAttribute('aria-pressed', sciNotation ? 'true' : 'false');
  }

  // --- Programmer mode ---------------------------------------------

  var OP_LABELS = { and: 'AND', or: 'OR', xor: 'XOR', shl: '<<', shr: '>>' };

  function progDigit(ch) {
    if (progOverwrite || progValue === '0') {
      progValue = ch;
      progOverwrite = false;
    } else {
      progValue += ch;
    }
    renderProg();
  }

  function progChooseOperator(opName) {
    var value = CalculatorProgrammer.fromBase(progValue, progBase);
    if (isNaN(value)) {
      setProgError('Invalid input');
      return;
    }

    // Chain a pending operator before starting the next one.
    if (progOperator !== null && !progOverwrite) {
      progPrevious = CalculatorProgrammer.bitwise[progOperator](progPrevious, value);
    } else {
      progPrevious = value;
    }

    progOperator = opName;
    progOverwrite = true;
    progValue = CalculatorProgrammer.toBase(progPrevious, progBase);
    expressionEl.textContent = progValue + ' ' + OP_LABELS[opName];
    renderProg();
  }

  function progEvaluate() {
    if (progOperator === null || progOverwrite) {
      return;
    }
    var value = CalculatorProgrammer.fromBase(progValue, progBase);
    if (isNaN(value)) {
      setProgError('Invalid input');
      return;
    }

    var result = CalculatorProgrammer.bitwise[progOperator](progPrevious, value);
    expressionEl.textContent =
      CalculatorProgrammer.toBase(progPrevious, progBase) + ' ' + OP_LABELS[progOperator] + ' ' +
      CalculatorProgrammer.toBase(value, progBase) + ' =';

    progValue = CalculatorProgrammer.toBase(result, progBase);
    progPrevious = null;
    progOperator = null;
    progOverwrite = true;
    renderProg();
  }

  // NOT is a unary operator applied immediately to the current value.
  function progNot() {
    var value = CalculatorProgrammer.fromBase(progValue, progBase);
    if (isNaN(value)) {
      setProgError('Invalid input');
      return;
    }
    expressionEl.textContent = 'NOT ' + CalculatorProgrammer.toBase(value, progBase);
    progValue = CalculatorProgrammer.toBase(CalculatorProgrammer.bitwise.not(value), progBase);
    progOverwrite = true;
    renderProg();
  }

  function progClear() {
    progValue = '0';
    progPrevious = null;
    progOperator = null;
    progOverwrite = true;
    progErrored = false;
    expressionEl.textContent = '';
    renderProg();
  }

  function progDelete() {
    if (progOverwrite) {
      return;
    }
    if (progValue.length <= 1 || (progValue.length === 2 && progValue.charAt(0) === '-')) {
      progValue = '0';
      progOverwrite = true;
    } else {
      progValue = progValue.slice(0, -1);
    }
    renderProg();
  }

  // Switch the active base, reinterpreting the current value so its numeric
  // amount is preserved.
  function setActiveBase(base) {
    var value = CalculatorProgrammer.fromBase(progValue, progBase);
    if (isNaN(value)) {
      value = 0;
    }
    progBase = base;
    progValue = CalculatorProgrammer.toBase(value, base);
    updateProgKeys();
    renderProg();
    saveProgBase();
  }

  // Show the value in every base and reflect the active base in the keypad
  // and the readout panel.
  function renderProg() {
    resultEl.textContent = progValue;

    var value = CalculatorProgrammer.fromBase(progValue, progBase);
    var valid = !isNaN(value);
    for (var i = 0; i < PROG_BASES.length; i++) {
      var base = PROG_BASES[i];
      var cell = progBasesEl.querySelector('[data-base-value="' + base + '"]');
      cell.textContent = valid ? CalculatorProgrammer.toBase(value, base) : '-';
    }

    var rows = progBasesEl.querySelectorAll('.prog-base');
    for (var j = 0; j < rows.length; j++) {
      rows[j].setAttribute('aria-pressed',
        parseInt(rows[j].dataset.base, 10) === progBase ? 'true' : 'false');
    }
  }

  // Enable only the digit keys that are valid in the active base.
  function updateProgKeys() {
    var keys = programmerPanel.querySelectorAll('[data-prog-digit]');
    for (var i = 0; i < keys.length; i++) {
      keys[i].disabled = !CalculatorProgrammer.isValidDigit(keys[i].dataset.progDigit, progBase);
    }
  }

  function setProgError(message) {
    progValue = '0';
    progPrevious = null;
    progOperator = null;
    progOverwrite = true;
    progErrored = true;
    expressionEl.textContent = '';
    resultEl.textContent = message;
    for (var i = 0; i < PROG_BASES.length; i++) {
      progBasesEl.querySelector('[data-base-value="' + PROG_BASES[i] + '"]').textContent = '-';
    }
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
  // calculation, targeting whichever mode is active.
  function recallResult(rawResult) {
    expressionEl.textContent = '';
    if (mode === 'scientific') {
      sciInput = rawResult;
      sciDone = false;
      sciErrored = false;
      renderSci();
      return;
    }
    current = rawResult;
    previous = null;
    operator = null;
    overwrite = true;
    errored = false;
    render();
  }

  // --- Mode switching ----------------------------------------------

  // Show the panel for the chosen mode, mark its toggle button active, and
  // remember the choice. Each mode keeps its own working state and dispatch.
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

    // Per-mode chrome: scientific toggles, the programmer base readout, and
    // the wider card layout used by both of those modes.
    sciControlsEl.hidden = mode !== 'scientific';
    progBasesEl.hidden = mode !== 'programmer';
    calculatorEl.classList.toggle('calculator--sci', mode === 'scientific');
    calculatorEl.classList.toggle('calculator--prog', mode === 'programmer');

    // Show the display value that belongs to the mode being entered. Each
    // mode keeps its own working state.
    expressionEl.textContent = '';
    if (mode === 'scientific') {
      renderSci();
    } else if (mode === 'programmer') {
      updateProgKeys();
      renderProg();
    } else {
      render();
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
      var storedAngle = window.localStorage.getItem(STORAGE_ANGLE);
      if (storedAngle === 'DEG' || storedAngle === 'RAD') {
        angleMode = storedAngle;
      }
      sciNotation = window.localStorage.getItem(STORAGE_SCINOTATION) === 'true';
      var storedBase = parseInt(window.localStorage.getItem(STORAGE_PROGBASE), 10);
      if (PROG_BASES.indexOf(storedBase) !== -1) {
        progBase = storedBase;
      }
    } catch (error) {
      memory = 0;
      history = [];
      mode = 'standard';
      angleMode = 'DEG';
      sciNotation = false;
      progBase = 10;
    }
    updateMemoryIndicator();
    renderHistory();
    updateAngleUI();
    updateSciNotationUI();
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

  function saveAngle() {
    try {
      window.localStorage.setItem(STORAGE_ANGLE, angleMode);
    } catch (error) {
      /* Storage unavailable; keep the choice in memory only. */
    }
  }

  function saveSciNotation() {
    try {
      window.localStorage.setItem(STORAGE_SCINOTATION, sciNotation ? 'true' : 'false');
    } catch (error) {
      /* Storage unavailable; keep the choice in memory only. */
    }
  }

  function saveProgBase() {
    try {
      window.localStorage.setItem(STORAGE_PROGBASE, String(progBase));
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

  // Scientific dispatch: appendable keys carry data-input, control keys carry
  // data-action.
  var SCI_ACTIONS = {
    clear: sciClear,
    delete: sciDelete,
    equals: sciEvaluate,
    ans: sciAnswer
  };

  function handleSci(button) {
    // Clear a previous error before processing anything except all-clear.
    if (sciErrored && button.dataset.action !== 'clear') {
      sciErrored = false;
      sciInput = '';
      expressionEl.textContent = '';
      renderSci();
    }

    if (button.dataset.input !== undefined) {
      sciAppend(button.dataset.input);
    } else if (button.dataset.action && SCI_ACTIONS[button.dataset.action]) {
      SCI_ACTIONS[button.dataset.action]();
    }
  }

  // One delegated listener per control group, each routing to the dispatch
  // for its mode.
  function delegate(container, handler) {
    container.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (button && container.contains(button)) {
        handler(button);
      }
    });
  }

  // Programmer dispatch: digit keys carry data-prog-digit, operators
  // data-prog-op, and control keys data-prog-action.
  var PROG_ACTIONS = {
    clear: progClear,
    delete: progDelete,
    equals: progEvaluate,
    not: progNot
  };

  function handleProg(button) {
    if (progErrored && button.dataset.progAction !== 'clear') {
      progErrored = false;
      progValue = '0';
      progOverwrite = true;
      expressionEl.textContent = '';
      renderProg();
    }

    if (button.dataset.progDigit !== undefined) {
      progDigit(button.dataset.progDigit);
    } else if (button.dataset.progOp !== undefined) {
      progChooseOperator(button.dataset.progOp);
    } else if (button.dataset.progAction && PROG_ACTIONS[button.dataset.progAction]) {
      PROG_ACTIONS[button.dataset.progAction]();
    }
  }

  var standardPanel = document.querySelector('[data-mode-panel="standard"]');
  var scientificPanel = document.querySelector('[data-mode-panel="scientific"]');
  var programmerPanel = document.querySelector('[data-mode-panel="programmer"]');

  delegate(document.querySelector('.memory-bar'), handlePress);
  delegate(standardPanel, handlePress);
  delegate(scientificPanel, handleSci);
  delegate(programmerPanel, handleProg);

  // Selecting a base row switches the active base.
  progBasesEl.addEventListener('click', function (event) {
    var row = event.target.closest('.prog-base');
    if (row) {
      setActiveBase(parseInt(row.dataset.base, 10));
    }
  });

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

  // Scientific toggles.
  angleToggleEl.addEventListener('click', toggleAngleMode);
  sciNotationToggleEl.addEventListener('click', toggleSciNotation);

  // --- Keyboard ----------------------------------------------------

  // Map a keyboard event to the standard on-screen button it should activate.
  // Both "Enter" and "=" trigger equals; "Escape" clears everything.
  function buttonForKey(event) {
    var key = event.key;
    if (key >= '0' && key <= '9') {
      return standardPanel.querySelector('[data-digit="' + key + '"]');
    }
    switch (key) {
      case '.': return standardPanel.querySelector('[data-action="decimal"]');
      case '+': return standardPanel.querySelector('[data-operator="add"]');
      case '-': return standardPanel.querySelector('[data-operator="subtract"]');
      case '*': return standardPanel.querySelector('[data-operator="multiply"]');
      case '/': return standardPanel.querySelector('[data-operator="divide"]');
      case '%': return standardPanel.querySelector('[data-action="percent"]');
      case '=':
      case 'Enter': return standardPanel.querySelector('[data-action="equals"]');
      case 'Backspace': return standardPanel.querySelector('[data-action="delete"]');
      case 'Escape': return standardPanel.querySelector('[data-action="clear"]');
      default: return null;
    }
  }

  // Map a keyboard event to the matching scientific key, including
  // parentheses and the typographic operator glyphs.
  function sciButtonForKey(event) {
    var key = event.key;
    if (key >= '0' && key <= '9') {
      return scientificPanel.querySelector('[data-input="' + key + '"]');
    }
    switch (key) {
      case '.': return scientificPanel.querySelector('[data-input="."]');
      case '+': return scientificPanel.querySelector('[data-input="+"]');
      case '-': return scientificPanel.querySelector('[data-input="−"]');
      case '*': return scientificPanel.querySelector('[data-input="×"]');
      case '/': return scientificPanel.querySelector('[data-input="÷"]');
      case '(': return scientificPanel.querySelector('[data-input="("]');
      case ')': return scientificPanel.querySelector('[data-input=")"]');
      case '^': return scientificPanel.querySelector('[data-input="^"]');
      case '!': return scientificPanel.querySelector('[data-input="!"]');
      case ',': return scientificPanel.querySelector('[data-input=","]');
      case '=':
      case 'Enter': return scientificPanel.querySelector('[data-action="equals"]');
      case 'Backspace': return scientificPanel.querySelector('[data-action="delete"]');
      case 'Escape': return scientificPanel.querySelector('[data-action="clear"]');
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

    // Programmer mode is driven by its on-screen, base-aware keys and does
    // not take physical keyboard input here.
    if (mode === 'programmer') {
      return;
    }

    var button = mode === 'scientific' ? sciButtonForKey(event) : buttonForKey(event);
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

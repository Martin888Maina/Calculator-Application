// Scientific function library. Provides the constants and named functions
// that the parser evaluates in scientific mode. Trigonometric functions
// respect the active angle mode ("DEG" or "RAD"), which is why the
// environment is rebuilt per evaluation rather than shared.

(function (global) {
  'use strict';

  function toRadians(value, angleMode) {
    return angleMode === 'DEG' ? value * Math.PI / 180 : value;
  }

  function fromRadians(value, angleMode) {
    return angleMode === 'DEG' ? value * 180 / Math.PI : value;
  }

  function squareRoot(x) {
    if (x < 0) {
      throw new Error('Invalid input');
    }
    return Math.sqrt(x);
  }

  // Real nth root. Negative radicands are only valid for odd integer roots.
  function nthRoot(x, n) {
    if (n === 0) {
      throw new Error('Invalid input');
    }
    if (x < 0) {
      if (Math.floor(n) === n && Math.abs(n % 2) === 1) {
        return -Math.pow(-x, 1 / n);
      }
      throw new Error('Invalid input');
    }
    return Math.pow(x, 1 / n);
  }

  // Build the evaluation environment for the parser, capturing the current
  // angle mode in the trigonometric closures.
  function getEnvironment(angleMode) {
    return {
      constants: {
        pi: Math.PI,
        e: Math.E
      },
      functions: {
        sin: function (x) { return Math.sin(toRadians(x, angleMode)); },
        cos: function (x) { return Math.cos(toRadians(x, angleMode)); },
        tan: function (x) { return Math.tan(toRadians(x, angleMode)); },
        asin: function (x) { return fromRadians(Math.asin(x), angleMode); },
        acos: function (x) { return fromRadians(Math.acos(x), angleMode); },
        atan: function (x) { return fromRadians(Math.atan(x), angleMode); },
        sinh: function (x) { return Math.sinh(x); },
        cosh: function (x) { return Math.cosh(x); },
        tanh: function (x) { return Math.tanh(x); },
        ln: function (x) { return Math.log(x); },
        log: function (x) { return Math.log10(x); },
        logb: function (x, base) { return Math.log(x) / Math.log(base); },
        sqrt: squareRoot,
        cbrt: function (x) { return Math.cbrt(x); },
        nthroot: nthRoot,
        abs: function (x) { return Math.abs(x); }
      }
    };
  }

  global.CalculatorScientific = { getEnvironment: getEnvironment };
})(window);

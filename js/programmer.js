// Programmer-mode helpers: base conversion and bitwise operations. Bitwise
// operators use JavaScript's 32-bit integer semantics, which suits the
// integer-only domain of this mode.

(function (global) {
  'use strict';

  var DIGITS = '0123456789ABCDEF';

  // True when the character is a usable digit in the given base (for example
  // A-F are only valid in base 16).
  function isValidDigit(ch, base) {
    var index = DIGITS.indexOf(ch.toUpperCase());
    return index !== -1 && index < base;
  }

  // Represent a decimal integer in the requested base, uppercased. Negative
  // values keep a leading minus sign.
  function toBase(value, base) {
    if (!isFinite(value)) {
      return String(value);
    }
    return Math.trunc(value).toString(base).toUpperCase();
  }

  // Parse a string of base-N digits back to a decimal integer. Empty input
  // (or a lone minus sign) reads as zero.
  function fromBase(str, base) {
    if (str === '' || str === '-') {
      return 0;
    }
    return parseInt(str, base);
  }

  var bitwise = {
    and: function (a, b) { return a & b; },
    or: function (a, b) { return a | b; },
    xor: function (a, b) { return a ^ b; },
    shl: function (a, b) { return a << b; },
    shr: function (a, b) { return a >> b; },
    not: function (a) { return ~a; }
  };

  global.CalculatorProgrammer = {
    isValidDigit: isValidDigit,
    toBase: toBase,
    fromBase: fromBase,
    bitwise: bitwise
  };
})(window);

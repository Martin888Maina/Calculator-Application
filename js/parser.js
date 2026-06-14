// Precedence-aware expression evaluator used by scientific mode. It supports
// the four basic operators, parentheses, and unary plus/minus with standard
// precedence: parentheses first, then multiplication and division, then
// addition and subtraction. A recursive-descent parser keeps the grammar
// explicit and easy to extend; later phases add named functions and
// constants to the tokenizer.
//
// The single entry point is CalculatorParser.evaluate(expression), which
// returns a number or throws an Error with a short, user-facing message when
// the expression is malformed.

(function (global) {
  'use strict';

  // Break the input into number, operator, and parenthesis tokens.
  function tokenize(input) {
    var tokens = [];
    var i = 0;

    while (i < input.length) {
      var ch = input.charAt(i);

      if (ch === ' ') {
        i++;
        continue;
      }

      if ((ch >= '0' && ch <= '9') || ch === '.') {
        var num = '';
        while (i < input.length) {
          var c = input.charAt(i);
          if ((c >= '0' && c <= '9') || c === '.') {
            num += c;
            i++;
          } else {
            break;
          }
        }
        if (num === '.' || (num.match(/\./g) || []).length > 1) {
          throw new Error('Invalid number');
        }
        tokens.push({ type: 'number', value: parseFloat(num) });
        continue;
      }

      if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }

      if (ch === '(' || ch === ')') {
        tokens.push({ type: 'paren', value: ch });
        i++;
        continue;
      }

      throw new Error('Invalid expression');
    }

    return tokens;
  }

  // expression := term (('+' | '-') term)*
  function parseExpression(state) {
    var value = parseTerm(state);
    while (peekOp(state, '+') || peekOp(state, '-')) {
      var op = next(state).value;
      var right = parseTerm(state);
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  // term := factor (('*' | '/') factor)*
  function parseTerm(state) {
    var value = parseFactor(state);
    while (peekOp(state, '*') || peekOp(state, '/')) {
      var op = next(state).value;
      var right = parseFactor(state);
      if (op === '/') {
        if (right === 0) {
          throw new Error('Cannot divide by zero');
        }
        value = value / right;
      } else {
        value = value * right;
      }
    }
    return value;
  }

  // factor := ('+' | '-') factor | '(' expression ')' | number
  function parseFactor(state) {
    var token = peek(state);
    if (!token) {
      throw new Error('Invalid expression');
    }

    if (token.type === 'op' && (token.value === '-' || token.value === '+')) {
      next(state);
      var operand = parseFactor(state);
      return token.value === '-' ? -operand : operand;
    }

    if (token.type === 'paren' && token.value === '(') {
      next(state);
      var inner = parseExpression(state);
      var closing = next(state);
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new Error('Unbalanced parentheses');
      }
      return inner;
    }

    if (token.type === 'number') {
      next(state);
      return token.value;
    }

    throw new Error('Invalid expression');
  }

  function peek(state) {
    return state.tokens[state.pos] || null;
  }

  function next(state) {
    return state.tokens[state.pos++];
  }

  function peekOp(state, value) {
    var token = peek(state);
    return token !== null && token.type === 'op' && token.value === value;
  }

  function evaluate(expression) {
    // Normalise the display glyphs for multiply, divide, and minus to their
    // ASCII equivalents before tokenising.
    var normalized = String(expression)
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-');

    var tokens = tokenize(normalized);
    if (tokens.length === 0) {
      throw new Error('Invalid expression');
    }

    var state = { tokens: tokens, pos: 0 };
    var result = parseExpression(state);

    // Any leftover tokens mean the expression was not fully consumed, for
    // example a missing operator or an unbalanced opening parenthesis.
    if (state.pos !== tokens.length) {
      throw new Error('Invalid expression');
    }
    if (!isFinite(result)) {
      throw new Error('Out of range');
    }
    return result;
  }

  global.CalculatorParser = { evaluate: evaluate };
})(window);

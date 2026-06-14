// Precedence-aware expression evaluator used by scientific mode. A
// recursive-descent parser keeps the grammar explicit. Precedence, from
// lowest to highest:
//
//   expression : + -
//   term       : * / mod
//   factor     : unary + -
//   power      : ^            (right associative)
//   postfix    : !            (factorial)
//   primary    : numbers, constants, function calls, parentheses
//
// Named functions and constants are supplied by the caller through an
// environment object, so the parser itself stays free of any particular
// function library. The single entry point is
// CalculatorParser.evaluate(expression, environment); it returns a number or
// throws an Error with a short, user-facing message for malformed input.

(function (global) {
  'use strict';

  // Factorial is evaluated by the parser as the postfix "!" operator.
  function factorial(n) {
    if (n < 0 || Math.floor(n) !== n) {
      throw new Error('Invalid input');
    }
    if (n > 170) {
      // 171! exceeds the largest representable double.
      throw new Error('Out of range');
    }
    var result = 1;
    for (var i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }

  // Break the input into number, operator, parenthesis, comma, factorial, and
  // identifier tokens. Identifiers cover function names, constants, and the
  // word operator "mod".
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

      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
        var name = '';
        while (i < input.length) {
          var ic = input.charAt(i);
          if ((ic >= 'a' && ic <= 'z') || (ic >= 'A' && ic <= 'Z')) {
            name += ic;
            i++;
          } else {
            break;
          }
        }
        tokens.push({ type: 'ident', value: name });
        continue;
      }

      if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }

      if (ch === '(' || ch === ')') {
        tokens.push({ type: 'paren', value: ch });
        i++;
        continue;
      }

      if (ch === ',') {
        tokens.push({ type: 'comma' });
        i++;
        continue;
      }

      if (ch === '!') {
        tokens.push({ type: 'fact' });
        i++;
        continue;
      }

      throw new Error('Invalid expression');
    }

    return tokens;
  }

  function parseExpression(state) {
    var value = parseTerm(state);
    while (peekOp(state, '+') || peekOp(state, '-')) {
      var op = next(state).value;
      var right = parseTerm(state);
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  function parseTerm(state) {
    var value = parseFactor(state);
    for (;;) {
      if (peekOp(state, '*')) {
        next(state);
        value = value * parseFactor(state);
      } else if (peekOp(state, '/')) {
        next(state);
        var divisor = parseFactor(state);
        if (divisor === 0) {
          throw new Error('Cannot divide by zero');
        }
        value = value / divisor;
      } else if (peekIdent(state, 'mod')) {
        next(state);
        value = value % parseFactor(state);
      } else {
        break;
      }
    }
    return value;
  }

  // Unary plus and minus, applied above power so that -2^2 evaluates to -(2^2).
  function parseFactor(state) {
    var token = peek(state);
    if (token && token.type === 'op' && (token.value === '-' || token.value === '+')) {
      next(state);
      var operand = parseFactor(state);
      return token.value === '-' ? -operand : operand;
    }
    return parsePower(state);
  }

  // Right-associative exponentiation; the exponent is parsed as a factor so
  // that 2^-3 and 2^3^2 behave as expected.
  function parsePower(state) {
    var base = parsePostfix(state);
    if (peekOp(state, '^')) {
      next(state);
      var exponent = parseFactor(state);
      return Math.pow(base, exponent);
    }
    return base;
  }

  function parsePostfix(state) {
    var value = parsePrimary(state);
    while (peek(state) && peek(state).type === 'fact') {
      next(state);
      value = factorial(value);
    }
    return value;
  }

  function parsePrimary(state) {
    var token = peek(state);
    if (!token) {
      throw new Error('Invalid expression');
    }

    if (token.type === 'number') {
      next(state);
      return token.value;
    }

    if (token.type === 'paren' && token.value === '(') {
      next(state);
      var inner = parseExpression(state);
      expectClose(state);
      return inner;
    }

    if (token.type === 'ident') {
      next(state);
      var name = token.value;

      // A following "(" marks a function call with one or more arguments.
      if (peek(state) && peek(state).type === 'paren' && peek(state).value === '(') {
        next(state);
        var args = [parseExpression(state)];
        while (peek(state) && peek(state).type === 'comma') {
          next(state);
          args.push(parseExpression(state));
        }
        expectClose(state);

        var fn = state.env.functions[name];
        if (typeof fn !== 'function') {
          throw new Error('Invalid expression');
        }
        return fn.apply(null, args);
      }

      // Otherwise the identifier must name a constant.
      if (Object.prototype.hasOwnProperty.call(state.env.constants, name)) {
        return state.env.constants[name];
      }
      throw new Error('Invalid expression');
    }

    throw new Error('Invalid expression');
  }

  function expectClose(state) {
    var token = next(state);
    if (!token || token.type !== 'paren' || token.value !== ')') {
      throw new Error('Unbalanced parentheses');
    }
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

  function peekIdent(state, value) {
    var token = peek(state);
    return token !== null && token.type === 'ident' && token.value === value;
  }

  function evaluate(expression, environment) {
    var env = environment || { constants: {}, functions: {} };

    // Normalise display glyphs to the ASCII the tokenizer expects.
    var normalized = String(expression)
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')
      .replace(/∛/g, 'cbrt');

    var tokens = tokenize(normalized);
    if (tokens.length === 0) {
      throw new Error('Invalid expression');
    }

    var state = { tokens: tokens, pos: 0, env: env };
    var result = parseExpression(state);

    // Leftover tokens mean the expression was not fully consumed.
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

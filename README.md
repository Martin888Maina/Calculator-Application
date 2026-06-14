# Calculator

A clean, modern, fully client-side calculator web application. It runs entirely in the
browser with no backend, no database, and no build step. The interface uses a refined
monochrome (black and white) design and offers three modes: Standard, Scientific, and
Programmer.

Live: https://calculator.martinmaina.dev

## Features

### Standard
- Basic arithmetic: addition, subtraction, multiplication, division
- Decimal entry with a single-decimal guard
- Sign toggle, percentage, all-clear, and backspace
- Square root, square, and reciprocal
- Graceful error handling (for example divide-by-zero) with clean recovery
- Thousands separators on large results for readability

### Scientific
- Precedence-aware expression evaluation with parentheses and unary minus
- Trigonometric functions and their inverses, with a degrees/radians toggle
- Hyperbolic functions
- Logarithms (base ten, natural, and arbitrary base) and exponentials
- Powers, roots (square, cube, and nth root), factorial, modulo, and absolute value
- Built-in constants (pi and e) and an answer-recall (ANS) key
- Scientific-notation display toggle

### Programmer
- Live conversion between decimal, binary, octal, and hexadecimal, all shown at once
- Selectable active base; hexadecimal digit keys enable only in hexadecimal
- Bitwise operations: AND, OR, XOR, NOT, left shift, and right shift

### Shared
- Calculation history that persists across sessions; tap an entry to reuse its result
- Memory keys (MC, MR, M+, M-, MS) with an on-display indicator
- Full keyboard support
- Responsive layout for desktop and mobile
- Accessible: ARIA labels, visible focus states, and live result announcements
- Mode, history, memory, and preferences are saved in the browser via localStorage

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `0`-`9`, `.` | Digits and decimal point |
| `+` `-` `*` `/` | Operators |
| `(` `)` | Parentheses (scientific mode) |
| `^` `!` `,` | Power, factorial, argument separator (scientific mode) |
| `Enter` or `=` | Evaluate |
| `Backspace` | Delete last entry |
| `Escape` | Clear all |
| `%` | Percentage (standard mode) |

## Tech Stack

- HTML5
- CSS3 (custom properties, grid, flexbox)
- Vanilla JavaScript (ES5-compatible, no frameworks, no bundler)

## Getting Started

No installation or build step is required. Clone the repository and open the page:

```bash
git clone https://github.com/Martin888Maina/Calculator-Application.git
cd Calculator-Application
```

Then open `index.html` in any modern browser. For local serving you can also run any
static file server, for example:

```bash
python3 -m http.server 8000
```

and visit `http://localhost:8000`.

## Project Structure

```
.
├── index.html          Markup and structure
├── css/
│   └── styles.css      Styling and dark theme
├── js/
│   ├── calculator.js   App entry: mode switching, display, shared state, standard engine
│   ├── parser.js       Precedence-aware expression parser
│   ├── scientific.js   Scientific functions and constants
│   └── programmer.js   Base conversion and bitwise operations
└── assets/
    └── favicon.svg     Application icon
```

## Browser Support

Works in current versions of Chrome, Firefox, Edge, and Safari. History, memory, and
preferences require `localStorage`; when it is unavailable (such as in some private
browsing modes) the calculator still works but does not persist between sessions.

## License

Released under the MIT License. See [LICENSE.txt](LICENSE.txt) for details.

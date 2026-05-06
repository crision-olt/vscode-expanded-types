# Expanded Types

**Deep-expand TypeScript types directly in hover tooltips.**

Instead of seeing an opaque type alias like `ApiResponse<User>`, Expanded Types recursively resolves it to show you
every property, nested type, union member, and function signature — all in the hover popup, without leaving your editor.

---

## Features

### Full type expansion on hover

When enabled, hovering over any identifier replaces the standard TypeScript tooltip with a fully-resolved version of its type.

**Before:**

```typescript
ApiResponse<User>
```

**After:**

```typescript
{
  data: {
    id: number;
    name: string;
    email?: string;
  };
  status: number;
  error: string | null;
}
```

### What gets expanded

| Type | Example output |
| --- | --- |
| Object types | `{ id: number; name: string }` |
| Nested objects | Full recursion up to `maxDepth` |
| Union types | `string \| number \| null` |
| Intersection types | Merged into a single `{ … }` shape |
| Tuple types | `[string, number, boolean]` |
| Array types | `User[]`, `(string \| number)[]` |
| Readonly arrays | `readonly string[]` |
| Optional properties | `name?: string` |
| Function signatures | `(id: number, opts?: Options) => Promise<User>` |
| String literals | `"GET" \| "POST" \| "PUT"` |
| Number literals | `200 \| 404 \| 500` |
| Utility types | `Omit<User, "password">` → `{ id: number; name: string }` |
| Built-in types | `Date`, `Map<K, V>`, `Promise<T>` kept as-is |

Nullish members (`null`, `undefined`) are sorted to the end of unions for readability.
Recursive types are detected and displayed as the original type name to prevent infinite expansion.

### Status bar toggle

A status bar item in the bottom-right corner shows the current state and toggles expansion with a single click:

| State | Label | Meaning |
|-------|-------|---------|
| OFF | `⊤ TS: Normal` | Standard TypeScript hover |
| ON | `👁 TS: Expanded` | Expanded type hover active |
| Error | `⚠ TS: Not connected` | TypeScript server not reachable |

### Copy expanded type

The **Expanded Types: Copy Expanded Type at Cursor** command copies the expanded type text to your clipboard — useful for pasting into documentation, issue reports, or type annotations.

### Original JSDoc preserved

By default, the original JSDoc comment is shown above the expanded block. This can be disabled with the `keepOriginalDocs` setting.

---

## Requirements

- Visual Studio Code **1.85.0** or later
- TypeScript support — provided by either:
  - The built-in **TypeScript and JavaScript Language Features** extension (`vscode.typescript-language-features`)
  - The **TypeScript Nightly** extension (`ms-vscode.vscode-typescript-next`)

No additional dependencies or build tools required.

---

## Installation

### From the Marketplace

1. Open VS Code
2. Press `Ctrl+P` / `Cmd+P`
3. Run `ext install crision-olt.expanded-types`

Or search **"Expanded Types"** in the Extensions view (`Ctrl+Shift+X`).

### From a VSIX file

```bash
code --install-extension expanded-types-<version>.vsix
```

---

## Getting Started

1. Open any TypeScript (`.ts`, `.tsx`) or JavaScript (`.js`, `.jsx`) file.
2. Click the `⊤ TS: Normal` item in the status bar, or press `Ctrl+Alt+E`.
3. The label changes to `👁 TS: Expanded`.
4. Hover over any variable, parameter, or type alias — you'll see the fully expanded type.
5. Press `Ctrl+Alt+E` again (or click the status bar) to return to normal hover.

> **Tip:** The enabled/disabled state is saved globally and restored on next startup.

---

## Configuration

All settings live under the `expandedTypes` namespace and can be configured in your User or Workspace settings (`settings.json`).

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `expandedTypes.enabled` | `boolean` | `false` | Whether type expansion is active. Persisted across reloads. |
| `expandedTypes.maxDepth` | `number` | `5` | Maximum recursion depth when expanding nested types. Range: 1–20. |
| `expandedTypes.keepOriginalDocs` | `boolean` | `true` | Show the original JSDoc comment above the expanded type block. |

### Example `settings.json`

```jsonc
{
  // Turn on expansion by default
  "expandedTypes.enabled": true,

  // Expand up to 8 levels deep (useful for deeply nested generics)
  "expandedTypes.maxDepth": 8,

  // Hide original JSDoc — show only the expanded type
  "expandedTypes.keepOriginalDocs": false
}
```

### `maxDepth` guidance

| Value | Use case |
|-------|----------|
| `1–2` | Only expand the top-level shape; aliases for deeply nested types stay opaque |
| `5` *(default)* | Good balance for most codebases |
| `8–10` | Deep generics and layered domain models |
| `20` | Maximum — may produce very long tooltips on complex types |

When the depth limit is reached, the tooltip shows `{ … }` for objects, `[ … ]` for tuples, rather than expanding further.

---

## Commands

Access these from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | ID | Description |
|---------|----|-------------|
| Expanded Types: Toggle | `expandedTypes.toggle` | Enable or disable type expansion |
| Expanded Types: Copy Expanded Type at Cursor | `expandedTypes.copyAtCursor` | Copy the expanded type at the cursor to the clipboard |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+E` | Toggle type expansion on/off |

You can rebind this in **File → Preferences → Keyboard Shortcuts** by searching for `expandedTypes.toggle`.

---

## How It Works

Expanded Types uses the [TypeScript Language Service Plugin API](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin) to intercept hover requests at the TypeScript server level.

1. The VS Code extension registers a tsserver plugin (`expanded-types-plugin`) via `typescriptServerPlugins` in its manifest.
2. When enabled, the plugin overrides `getQuickInfoAtPosition` in the TypeScript language service.
3. For each hover request, the plugin walks the TypeScript type graph using the type checker and recursively resolves all properties, union members, and signatures.
4. The resolved type string is injected into the hover response as a Markdown code block.
5. The extension communicates configuration changes (enabled state, maxDepth, keepOriginalDocs) to the plugin in real time via the TypeScript extension API — no restart needed.

---

## Troubleshooting

### The status bar shows `⚠ TS: Not connected`

This means the extension could not reach the TypeScript server API. Try:

- Opening a `.ts` or `.tsx` file (the extension activates on TypeScript/JavaScript files only)
- Clicking the status bar or pressing `Ctrl+Alt+E` to toggle — this retries the connection
- Reloading the VS Code window (`Ctrl+Shift+P` → **Developer: Reload Window**)

### Hover looks the same after enabling

- Make sure a TypeScript file is active (not a JSON, Markdown, etc. file)
- Check the **Expanded Types** output channel (`Ctrl+Shift+P` → **View: Toggle Output** → select **Expanded Types**) for diagnostic messages
- Try reloading the window once after first install — the tsserver plugin loads on server start

### The expanded type is very long

Reduce `expandedTypes.maxDepth` in your settings. A value of `3` or `4` keeps output compact for most types.

---

## Known Limitations

- **Function overloads**: Only the first call signature is expanded.
- **Mapped types with complex key remapping**: May fall back to `checker.typeToString()` output.
- **Very large types**: Deep expansion of types with dozens of properties and high `maxDepth` can produce long tooltips. VS Code truncates hovers beyond a certain size.
- **JavaScript files**: Expansion works but is limited by how much type information the TypeScript checker infers from plain JS.

---

## Contributing

Bug reports and pull requests are welcome at [github.com/crision-olt/vscode-expanded-types](https://github.com/crision-olt/vscode-expanded-types).

```bash
# Clone and install
git clone https://github.com/crision-olt/vscode-expanded-types.git
cd vscode-expanded-types
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode (rebuilds on save)
npm run watch
```

To test the extension locally, press `F5` in VS Code to open an Extension Development Host.

---

## License

MIT

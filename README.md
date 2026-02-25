# JSON Composer

A modern drag-and-drop JSON transformation tool that dynamically restructures data based on token sequence order.

Built with React, TypeScript, and a drag-and-drop architecture, this application allows users to parse a JSON file, generate tokenized paths, and compose structured outputs by rearranging tokens in real time.

---

## 🚀 Features

### 🔹 JSON Input
- Paste JSON directly or upload a `.json` file
- Automatic validation with clear error feedback
- Load Sample JSON option for testing
- Recursive token extraction from nested objects and arrays

### 🔹 Token Library
- Auto-generated tokens representing JSON paths (e.g., `user.name`, `orders[].id`)
- Support for nested objects and array paths using generalized `[]` notation
- Searchable token list
- Click to view token details
- Draggable tokens for composition

### 🔹 Sequence Builder (Core Feature)
- Drag tokens into the sequence area
- Reorder tokens dynamically
- Remove tokens from sequence
- The order of tokens directly determines the output

> Rearranging tokens instantly updates the result — the sequence is the logic.

### 🔹 Multiple Output Modes

**1. Text Mode**
- Concatenates token values in sequence order
- Supports custom separators
- Handles multiple matches with configurable joiner

**2. JSON Array Mode**
- Each token becomes an ordered element in a JSON array
- Supports nested arrays when token resolves multiple matches

**3. JSON Object Mode**
- Editable output keys
- Preserves insertion order
- Maps tokens to structured key-value output

### 🔹 Live Result Panel
- Real-time output preview
- Pretty-printed JSON
- Copy to clipboard
- Download as `.json` or `.txt`

### 🔹 Persistence
- Saves sequence and mode settings in localStorage
- Restores state on reload

---

## 🧠 How It Works

### Step 1: Parse JSON
The application recursively traverses the JSON input and extracts primitive leaf nodes (string, number, boolean, null).  
Array structures are normalized using generalized `[]` notation.

### Step 2: Generate Tokens
Each primitive leaf becomes a token representing a JSON path:

Example:

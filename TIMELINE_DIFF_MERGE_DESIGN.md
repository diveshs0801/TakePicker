# Timeline Diff and Three-Way Merge in Rust/WASM (Phase 3, hard problem #10)

Addresses: hard problem #10 (version control for video), part of #2 (collaboration), and the "language-flexible: TypeScript, Go, Rust, Python" line in the Backend JD. Rust is used because there is a real reason: one correct core compiled to WebAssembly runs identically in the browser and in the API.

Scope statement for the README: a diff and three-way merge for a **timeline description** (clips, trims, order), like a small Git for edit lists. It is **not a CRDT** and does not provide live collaboration.

Only start this after the agent layer, upload, and (if targeting Fullstack) the player are done.

---

## 1. The question the project answers

> Can two independent edits to the same timeline (for example the agent's and the user's) be merged automatically when they do not conflict, and reported precisely when they do, and can we prove the merge is correct?

---

## 2. Why this matters in the product

The agent from Phase 2A edits a timeline while the user may also be editing it. In the base design a stale write fails with `STALE_BASE_SEQ`. With merge, the agent works on a **branch** (a copy of the timeline at a base version), and when it finishes its edits are **merged** into the current timeline. Non-conflicting edits combine automatically. Conflicts are shown to the user.

---

## 3. Data model

```rust
#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct Clip {
    pub id: String,        // stable id, unique within a timeline
    pub src: String,       // asset id
    pub r#in: f64,         // seconds, snapped to the frame grid
    pub out: f64,
    pub group_id: Option<String>,
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct Timeline {
    pub fps: f64,
    pub clips: Vec<Clip>,  // list order = playback order
}
```

Invariants (checked on input and on every merge result):
- Clip ids are unique.
- `in < out`.
- Optional: a minimum clip length.

Times are compared on the frame grid (convert to integer frame counts internally) to avoid floating-point comparison bugs.

---

## 4. Diff

Input: `base`, `other`. Output: a **patch** made of operations.

```rust
pub enum Op {
    Insert { clip: Clip, after: Option<String> },   // after = previous clip id, None = start
    Delete { id: String },
    Move   { id: String, after: Option<String> },
    Edit   { id: String, field: Field, from: f64, to: f64 }, // Field: In | Out | Src | Group
}
```

Algorithm:
1. **Identity by id.** Because ids are stable, no fuzzy matching is needed. Ids in `base` only are deletes; ids in `other` only are inserts; ids in both are candidates for edit or move.
2. **Edits**: compare fields of clips present in both.
3. **Moves**: take the sequence of shared ids in `base` order and in `other` order. Compute the **longest increasing subsequence** of the `other` positions mapped through `base` order (O(n log n)). Shared ids on the LIS are unmoved; the rest are **moves**. This gives a minimal set of moves.
4. Emit ops in a deterministic order (so the same diff always produces the same patch).

`apply(patch, base) == other` must hold. This is a property test (section 7).

---

## 5. Three-way merge

Input: `base`, `ours`, `theirs`. Output: `{ merged: Timeline, conflicts: Vec<Conflict> }`.

### Per-clip rules
| Situation | Result |
|---|---|
| Changed only on one side | Take that side |
| Changed identically on both sides | Take it once, no conflict |
| Same field edited to different values | **Conflict** (`EditEdit`) |
| Different fields of the same clip edited | Merge both (field-level) |
| Deleted on one side, edited on the other | **Conflict** (`DeleteEdit`) |
| Deleted on both | Deleted |
| Inserted on one side | Insert |
| Inserted on both sides at the same position | Keep both in a deterministic order (by side then id) and note an informational `OrderAmbiguity` |

### Order merge
- Merge the **order of ids** with a three-way sequence merge (diff3-style on the id lists).
- A clip moved on one side and not on the other takes the moved position.
- A clip moved to different positions on both sides is a **conflict** (`MoveMove`) unless the positions agree.
- Because a move can look like a delete plus an insert in a sequence diff, **dedupe by id** so a moved clip is never present twice.

### After merging
- Re-check invariants. If a merge produces an invalid state (for example `in >= out` after combining a trim from each side), report a **semantic conflict** instead of emitting a broken timeline.
- Conflicts include the base, ours and theirs values so a UI can show them.

### Determinism
The same inputs always give the same output. No hash-map iteration order leaks into results (use ordered maps or sort).

---

## 6. WASM and API design

```
crates/timeline-merge/
  src/lib.rs          # model, diff, merge, apply, validate
  src/wasm.rs         # wasm-bindgen exports
  tests/              # unit + proptest
  benches/            # criterion
```

JS-facing API (JSON in, JSON out, to keep the boundary simple):
```ts
diff(base: string, other: string): string                 // Patch JSON
apply(base: string, patch: string): string                // Timeline JSON
merge(base: string, ours: string, theirs: string): string // { merged, conflicts }
validate(timeline: string): string                        // list of invariant violations
```

Build targets:
- `wasm-pack build --target web` for the browser
- `wasm-pack build --target nodejs` for the NestJS API

One compiled core, used in both places. Record the `.wasm` size.

---

## 7. Correctness: property-based tests (the credibility piece)

Use `proptest` with a generator that produces a random base timeline and random edit sequences (insert, delete, trim, move, take switch).

| Property | Statement |
|---|---|
| Patch correctness | `apply(diff(A, B), A) == B` |
| Identity | `diff(A, A)` is empty |
| Merge with self | `merge(B, X, X) == X` with no conflicts |
| One side unchanged | `merge(B, B, X) == X` and `merge(B, X, B) == X` |
| Symmetry | For non-conflicting edits, `merge(B, X, Y) == merge(B, Y, X)` |
| Invariants | Every merge output (without conflicts) passes `validate` |
| Determinism | Running the same merge twice gives identical output |
| JSON round trip | Serialize/deserialize leaves the timeline unchanged |

Also write about 20 **hand-written scenario tests** that read like documentation (for example "user trims clip 3 while the agent deletes clip 5: both apply" and "both trim clip 3 differently: conflict").

Report: number of random cases run per property and any bugs the properties found. A bug found by a property test is a good story.

---

## 8. Performance

Use `criterion` benchmarks:
- diff and merge on timelines of 100, 1,000, 10,000 and 100,000 clips
- WASM vs native timing (the overhead of the JS boundary)
- JSON parse/serialize cost versus the algorithm cost

Expected behavior to check: roughly O(n log n) from the LIS step. Report measured numbers, not the expectation.

---

## 9. Product integration (the demo)

1. **Agent on a branch**: when an agent run starts, record `baseSeq` and a base snapshot. The agent edits a working copy.
2. If the user edited the live timeline in the meantime, run `merge(base, live, agent_result)`.
3. No conflicts: apply the merged timeline as new ops. Conflicts: show a **conflict panel**.

Conflict panel UI:
- Two timeline versions side by side, with changed clips colored (added, removed, trimmed, moved).
- A list of conflicts, each with "keep mine", "keep theirs" or "edit manually".
- A resolved preview that updates as the user chooses.

Demo script: start an agent run ("remove the ums"), manually trim a clip while it runs, and show the automatic merge. Then force a conflict (both trim the same clip) and resolve it.

---

## 10. Plan (3-4 days)

**Day 1**: Rust crate, data model, validation, diff (including the LIS move detection), `apply`, and the patch-correctness property test.

**Day 2**: field-level merge, order merge, conflict types, invariant re-check, and the merge property tests and scenario tests.

**Day 3**: `wasm-bindgen` exports, builds for web and Node, integration into the API, benchmarks.

**Day 4**: conflict panel UI, the agent-branch demo, README with test counts and benchmark numbers.

---

## 11. Definition of done

- [ ] Diff and apply satisfy the round-trip property
- [ ] Three-way merge with typed conflicts
- [ ] Property tests running thousands of random cases, with results reported
- [ ] Same core running in browser and Node through WASM
- [ ] Benchmarks at several sizes, with `.wasm` size
- [ ] Conflict panel and the agent-branch demo
- [ ] Limitations section

## 12. Limitations to state

- Not a CRDT or operational transform; it is an offline, Git-style merge and does not give live multi-user editing. (Libraries such as Automerge or Yjs exist for real-time collaboration and would be the starting point for that.)
- Timeline model is small: clips, trims, order, take selection. No effects, multi-track or audio mixing.
- Moves are detected by id and by sequence position; edits that change clip identity (for example splitting a clip into two with new ids) need an explicit rule and are only partly handled.
- Property tests increase confidence but do not prove correctness.

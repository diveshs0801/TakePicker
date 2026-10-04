"""
TakePicker Benchmark Runner — measures precision and recall of the video linter.

This is the core deliverable. It answers:
  "For each defect type and severity, how reliably does the linter catch it?"

Usage:
  python bench/run_bench.py --manifest bench/manifest.json --injected-dir bench/injected/ --split test
  python bench/run_bench.py --manifest bench/manifest.json --injected-dir bench/injected/ --split dev

Output:
  - Per-type precision, recall, F1
  - Per-severity breakdown
  - False alarms per minute on clean controls
  - Localization error (median absolute start-time error)
"""

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

# Add parent dir so we can import the linter
lint_candidates = [
    os.path.join(os.path.dirname(__file__), "..", "apps", "lint"),
    os.path.join(os.path.dirname(__file__), "..", "lint"),
    "/app/lint"
]
for p in lint_candidates:
    if os.path.exists(p):
        sys.path.insert(0, os.path.abspath(p))
        break

from lint import run_lint, load_config, get_video_duration


# Dev/test split by base clip name (70/30 split)
def split_clips(manifest: list[dict], split: str, seed: int = 42) -> list[dict]:
    """
    Split manifest entries by base clip name (not by file).
    This prevents tuning thresholds to the test set.
    """
    import random
    rng = random.Random(seed)

    # Get unique base clip names
    base_names = sorted(set(entry["base"] for entry in manifest))
    rng.shuffle(base_names)

    # 70% dev, 30% test
    split_idx = int(len(base_names) * 0.7)
    if split == "dev":
        selected = set(base_names[:split_idx])
    elif split == "test":
        selected = set(base_names[split_idx:])
    else:
        selected = set(base_names)  # "all"

    return [entry for entry in manifest if entry["base"] in selected]


def match_finding_to_defect(finding: dict, defect: dict,
                            time_tolerance: float = 0.2) -> bool:
    """
    Check if a linter finding matches a ground-truth defect.
    
    Matching rules:
      - Defect type must map to the correct check name
      - Time ranges must overlap within tolerance
    """
    # Map defect types to check names
    type_map = {
        "D1": "D1_black_frames",
        "D2": "D2_frozen_video",
        "D3": "D3_audio_dropout",
        "D4": "D4_loudness_jump",
    }

    expected_check = type_map.get(defect["type"])
    if expected_check is None:
        return False

    if finding["check"] != expected_check:
        return False

    # Check time overlap with tolerance
    f_start = finding["start"]
    f_end = finding["end"]
    d_start = defect["start"]
    d_end = defect["end"]

    # Ranges overlap if one starts before the other ends
    overlap = (f_start <= d_end + time_tolerance and
               f_end >= d_start - time_tolerance)

    return overlap


def compute_metrics(manifest_entries: list[dict], injected_dir: str,
                    config: dict) -> dict:
    """
    Run the linter on all manifest entries and compute precision/recall.
    
    Returns detailed metrics per defect type and severity.
    """
    # Counters: {defect_type: {severity: {tp, fn, fp}}}
    by_type_sev = defaultdict(lambda: defaultdict(lambda: {"tp": 0, "fn": 0}))
    fp_by_type = defaultdict(int)
    clean_fp = 0
    total_clean_duration = 0.0
    localization_errors = defaultdict(list)  # {defect_type: [error_sec]}
    runtimes = []

    type_map_rev = {
        "D1_black_frames": "D1",
        "D2_frozen_video": "D2",
        "D3_audio_dropout": "D3",
        "D4_loudness_jump": "D4"
    }

    for entry in manifest_entries:
        filepath = os.path.join(injected_dir, entry["file"])
        if not os.path.exists(filepath):
            print(f"  ⚠️  Skipping (file not found): {entry['file']}")
            continue

        duration = get_video_duration(filepath)

        # Run linter
        t0 = time.time()
        findings = run_lint(filepath, config)
        elapsed = time.time() - t0
        runtimes.append(elapsed / duration if duration > 0 else 0)

        defects = [d for d in entry.get("defects", []) if "error" not in d]
        is_clean = len(defects) == 0

        if is_clean:
            # Clean control: all findings are false alarms
            clean_fp += len(findings)
            for f in findings:
                dtype = type_map_rev.get(f.get("check"))
                if dtype:
                    fp_by_type[dtype] += 1
            total_clean_duration += duration
            continue

        # Match findings to ground truth defects
        matched_defects = set()
        matched_findings = set()

        for d_idx, defect in enumerate(defects):
            for f_idx, finding in enumerate(findings):
                if f_idx in matched_findings:
                    continue
                if match_finding_to_defect(finding, defect):
                    matched_defects.add(d_idx)
                    matched_findings.add(f_idx)

                    # Localization error
                    loc_err = abs(finding["start"] - defect["start"])
                    localization_errors[defect["type"]].append(loc_err)
                    break

        # Count TP and FN per defect
        for d_idx, defect in enumerate(defects):
            sev = defect.get("severity", "unknown")
            if d_idx in matched_defects:
                by_type_sev[defect["type"]][sev]["tp"] += 1
            else:
                by_type_sev[defect["type"]][sev]["fn"] += 1

        # Unmatched findings on defective clips are false positives for that check type
        for f_idx, finding in enumerate(findings):
            if f_idx not in matched_findings:
                dtype = type_map_rev.get(finding.get("check"))
                if dtype:
                    fp_by_type[dtype] += 1

    # Compute summary metrics
    results = {
        "per_type": {},
        "per_type_severity": {},
        "false_alarms_per_minute": 0,
        "median_localization_error": {},
        "lint_speed_x_median": 0,
    }

    # Per-type aggregation
    for dtype in sorted(by_type_sev.keys()):
        type_tp = sum(s["tp"] for s in by_type_sev[dtype].values())
        type_fn = sum(s["fn"] for s in by_type_sev[dtype].values())
        type_fp = fp_by_type[dtype]
        precision = type_tp / max(type_tp + type_fp, 1)
        recall = type_tp / max(type_tp + type_fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 1e-9)

        results["per_type"][dtype] = {
            "tp": type_tp, "fn": type_fn, "fp": type_fp,
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "f1": round(f1, 3),
        }

        # Per-severity breakdown
        results["per_type_severity"][dtype] = {}
        for sev in sorted(by_type_sev[dtype].keys()):
            counts = by_type_sev[dtype][sev]
            sev_recall = counts["tp"] / max(counts["tp"] + counts["fn"], 1)
            results["per_type_severity"][dtype][sev] = {
                "tp": counts["tp"], "fn": counts["fn"],
                "recall": round(sev_recall, 3),
            }

    # False alarms per minute on clean controls
    if total_clean_duration > 0:
        results["false_alarms_per_minute"] = round(
            clean_fp / (total_clean_duration / 60), 2
        )

    # Median localization error per type
    for dtype, errors in localization_errors.items():
        if errors:
            errors_sorted = sorted(errors)
            median = errors_sorted[len(errors_sorted) // 2]
            results["median_localization_error"][dtype] = round(median, 3)

    # Median lint speed
    if runtimes:
        runtimes_sorted = sorted(runtimes)
        results["lint_speed_x_median"] = round(
            runtimes_sorted[len(runtimes_sorted) // 2], 3
        )

    return results


def print_results(results: dict):
    """Pretty-print the benchmark results."""
    print("\n" + "=" * 70)
    print("BENCHMARK RESULTS")
    print("=" * 70)

    # Per-type table
    print("\n📊 Per Defect Type:")
    print(f"{'Type':<8} {'TP':>4} {'FN':>4} {'Precision':>10} {'Recall':>8} {'F1':>6}")
    print("-" * 44)
    for dtype, m in results["per_type"].items():
        print(f"{dtype:<8} {m['tp']:>4} {m['fn']:>4} {m['precision']:>10.3f} "
              f"{m['recall']:>8.3f} {m['f1']:>6.3f}")

    # Per-severity breakdown
    print("\n📊 Per Severity Breakdown:")
    for dtype, sevs in results["per_type_severity"].items():
        print(f"\n  {dtype}:")
        for sev, m in sevs.items():
            print(f"    {sev:>8}: TP={m['tp']}, FN={m['fn']}, "
                  f"Recall={m['recall']:.3f}")

    # False alarms
    print(f"\n🔔 False alarms on clean controls: "
          f"{results['false_alarms_per_minute']:.2f} per minute")

    # Localization
    if results["median_localization_error"]:
        print("\n🎯 Median localization error:")
        for dtype, err in results["median_localization_error"].items():
            print(f"  {dtype}: {err:.3f}s")

    # Speed
    print(f"\n⚡ Lint speed: {results['lint_speed_x_median']:.3f}x realtime (median)")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Run the video linter benchmark and compute precision/recall"
    )
    parser.add_argument("--manifest", required=True, help="Path to manifest.json")
    parser.add_argument("--injected-dir", required=True, help="Directory with injected clips")
    parser.add_argument("--split", default="all", choices=["dev", "test", "all"],
                        help="Which split to evaluate on")
    parser.add_argument("--config", default=None, help="Path to linter config.yaml")
    parser.add_argument("--out", default=None, help="Output results JSON path")

    args = parser.parse_args()

    with open(args.manifest, "r") as f:
        manifest = json.load(f)

    # Split by base clip
    entries = split_clips(manifest, args.split)
    print(f"Split: {args.split} — {len(entries)} files from "
          f"{len(set(e['base'] for e in entries))} base clips")

    config = load_config(args.config)

    print("Running linter on all clips...")
    results = compute_metrics(entries, args.injected_dir, config)

    print_results(results)

    # Save results
    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\n📄 Results saved to {args.out}")


if __name__ == "__main__":
    main()

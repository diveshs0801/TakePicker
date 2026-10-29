#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
 TakePicker / Cardboard AI: Unified Master Forensic Proof Harness
================================================================================
 Executes all 5 specialized proof test suites covering Cardboard AI Core
 Problems #09 (Video Verification, Editorial Linters & Taste RL) and
 #10 (Version Control for Video, 3-Way Merge & Audition Lanes).

 Suites Executed:
   1. Multi-Scenario Defect Verification (run_multi_scenario_proofs.py)
   2. Cross-Corpus Multi-Video Benchmark (run_cross_corpus_benchmark.py)
   3. Version Control & 3-Way Timeline Merge (run_version_control_proofs.py)
   4. Aesthetic VLM Judge & Platform RL (run_aesthetic_and_rl_proofs.py)
   5. Frontier RL & Creative Style Preservation (run_frontier_rl_proofs.py)
================================================================================
"""

import sys
import os
import subprocess
import json
import time

SUITES = [
    {
        "id": "PROOFS_01_MULTI_SCENARIO",
        "name": "Problem #09: 4-Layer Defect Verification & Auto-Repair",
        "script": "run_multi_scenario_proofs.py",
        "target": "bench/proofs/run_multi_scenario_proofs.py",
        "invariants": 6,
    },
    {
        "id": "PROOFS_02_CROSS_CORPUS",
        "name": "Problem #09: Cross-Corpus Generalization (4 Diverse Formats)",
        "script": "run_cross_corpus_benchmark.py",
        "target": "bench/proofs/run_cross_corpus_benchmark.py",
        "invariants": 4,
    },
    {
        "id": "PROOFS_03_VERSION_CONTROL",
        "name": "Problem #10: 3-Way Timeline Merge, LIS Diff & Audition Lanes",
        "script": "run_version_control_proofs.py",
        "target": "bench/proofs/run_version_control_proofs.py",
        "invariants": 6,
    },
    {
        "id": "PROOFS_04_AESTHETIC_RL",
        "name": "Problem #09: Aesthetic VLM Judge & Platform Retention Loop",
        "script": "run_aesthetic_and_rl_proofs.py",
        "target": "bench/proofs/run_aesthetic_and_rl_proofs.py",
        "invariants": 4,
    },
    {
        "id": "PROOFS_05_FRONTIER_RL",
        "name": "Problem #09: Frontier RL, Causal DML & Creator Style Guardrails",
        "script": "run_frontier_rl_proofs.py",
        "target": "bench/proofs/run_frontier_rl_proofs.py",
        "invariants": 6,
    },
]

def run_suite(suite_info, base_dir):
    script_path = os.path.join(base_dir, suite_info["script"])
    print(f"\n{'='*80}")
    print(f"▶ EXECUTING SUITE: {suite_info['name']}")
    print(f"  Target File: {script_path}")
    print(f"{'='*80}")
    
    t0 = time.time()
    res = subprocess.run(
        [sys.executable, "-X", "utf8", script_path],
        cwd=base_dir,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )
    elapsed = time.time() - t0
    
    # Print stdout
    if res.stdout:
        print(res.stdout)
    if res.stderr and res.returncode != 0:
        print("STDERR:\n", res.stderr)
        
    passed = (res.returncode == 0)
    status_str = "✅ PASS" if passed else "❌ FAIL"
    print(f"[{status_str}] Finished in {elapsed:.2f}s (Exit code: {res.returncode})")
    
    return {
        "id": suite_info["id"],
        "name": suite_info["name"],
        "script": suite_info["script"],
        "invariants": suite_info["invariants"],
        "passed": passed,
        "elapsed_sec": round(elapsed, 3),
        "exit_code": res.returncode
    }

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(base_dir, "..", ".."))
    
    print("\n" + "="*80)
    print("🛡️  TAKEPICKER / CARDBOARD AI: UNIFIED MASTER PROOF HARNESS")
    print(f"   Root: {project_root}")
    print(f"   Timestamp: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    print("="*80)
    
    results = []
    total_invariants = sum(s["invariants"] for s in SUITES)
    
    t_start = time.time()
    for suite in SUITES:
        res = run_suite(suite, base_dir)
        results.append(res)
    total_elapsed = time.time() - t_start
    
    all_passed = all(r["passed"] for r in results)
    passed_invariants = sum(r["invariants"] for r in results if r["passed"])
    
    print("\n" + "#"*80)
    print("📊 UNIFIED PROOF EXECUTION SCORECARD")
    print("#"*80)
    print(f"{'Suite ID':<26} | {'Target Test Suite':<35} | {'Invariants':<10} | {'Status'}")
    print("-" * 80)
    for r in results:
        status_sym = "✅ PASS (100%)" if r["passed"] else "❌ FAILED"
        print(f"{r['id']:<26} | {r['name'][:35]:<35} | {r['invariants']:<10} | {status_sym}")
    print("-" * 80)
    print(f"Total Suites: {len(results)}/{len(results)} passed | Total Invariants Verified: {passed_invariants}/{total_invariants}")
    print(f"Overall Pass Rate: {100.0 if all_passed else 0.0:.1f}% | Total Time: {total_elapsed:.2f}s")
    print("#"*80)
    
    scorecard = {
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "overall_status": "PASS" if all_passed else "FAIL",
        "total_suites": len(results),
        "passed_suites": sum(1 for r in results if r["passed"]),
        "total_invariants": total_invariants,
        "verified_invariants": passed_invariants,
        "pass_rate_pct": 100.0 if all_passed else 0.0,
        "total_elapsed_sec": round(total_elapsed, 3),
        "suites": results
    }
    
    out_path = os.path.join(base_dir, "master_proof_scorecard.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(scorecard, f, indent=2)
    print(f"\n📄 Persisted Master Proof Scorecard: {out_path}\n")
    
    if not all_passed:
        sys.exit(1)

if __name__ == "__main__":
    main()

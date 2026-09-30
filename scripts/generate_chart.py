#!/usr/bin/env python3
"""
Generate a sleek, dark-mode benchmark chart for TakePicker.
Saves to docs/screenshots/00_benchmark_chart.png
"""

import os
import matplotlib.pyplot as plt
import numpy as np

workers = [1, 2, 4, 6]
durations = [160.76, 107.56, 85.83, 88.09]
speedups = [1.00, 1.49, 1.87, 1.82]

plt.style.use('dark_background')
fig, ax1 = plt.subplots(figsize=(10, 5.5), dpi=300)
fig.patch.set_facecolor('#0b0f19')
ax1.set_facecolor('#0f172a')

# Bar plot for duration
bars = ax1.bar(
    [w - 0.2 for w in workers],
    durations,
    width=0.4,
    color='#6366f1',
    alpha=0.85,
    label='Export Duration (seconds)'
)

ax1.set_xlabel('Parallel Render Workers (BullMQ / FFmpeg -threads 2)', fontsize=11, fontweight='bold', color='#cbd5e1', labelpad=10)
ax1.set_ylabel('Export Time (seconds) — Lower is Better', fontsize=11, fontweight='bold', color='#818cf8', labelpad=10)
ax1.set_xticks(workers)
ax1.set_xticklabels(['1 Worker\n(Baseline)', '2 Workers', '4 Workers', '6 Workers'], fontsize=10, color='#e2e8f0')
ax1.set_ylim(0, 190)
ax1.grid(axis='y', linestyle='--', alpha=0.15, color='#94a3b8')

# Value labels on bars
for bar in bars:
    yval = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2.0, yval + 3, f"{yval:.1f}s", ha='center', va='bottom', fontsize=10, fontweight='bold', color='#ffffff')

# Line plot for speedup on secondary axis
ax2 = ax1.twinx()
ax2.plot([w + 0.2 for w in workers], speedups, color='#34d399', marker='o', linewidth=2.5, markersize=8, label='Speedup Factor')
ax2.set_ylabel('Speedup Factor vs 1 Worker — Higher is Better', fontsize=11, fontweight='bold', color='#34d399', labelpad=10)
ax2.set_ylim(0.5, 2.3)

for w, s in zip(workers, speedups):
    ax2.text(w + 0.2, s + 0.06, f"{s:.2f}x", ha='center', va='bottom', fontsize=10, fontweight='bold', color='#34d399')

# Annotate plateau at 6 workers
ax2.annotate(
    "Amdahl's Law Plateau\n(Serial concat merge + CPU saturation)",
    xy=(6 + 0.2, 1.82),
    xytext=(4.5, 2.05),
    arrowprops=dict(facecolor='#f43f5e', shrink=0.08, width=1.5, headwidth=6),
    fontsize=9.5,
    fontweight='semibold',
    color='#fca5a5',
    bbox=dict(boxstyle="round,pad=0.4", fc="#1e293b", ec="#f43f5e", lw=1.2)
)

# Titles
plt.title('TakePicker Parallel FFmpeg Render Scaling\n5m 22s 1080p Clip (45 Cuts) on 6-Core Intel i7-8700', fontsize=13, fontweight='bold', color='#f8fafc', pad=16)

# Spines styling
for ax in [ax1, ax2]:
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_color('#334155')
    ax.spines['left'].set_color('#334155')
    ax.spines['bottom'].set_color('#334155')

plt.tight_layout()

out_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "screenshots", "00_benchmark_chart.png"))
plt.savefig(out_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
print("Successfully saved benchmark chart to:", out_path)

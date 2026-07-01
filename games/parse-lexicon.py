#!/usr/bin/env python3
# Parses lexicon.txt into conway-shapes.js (LEXICON_SHAPES data for the search/select UI).
# Run this from games/ whenever lexicon.txt changes: python3 parse-lexicon.py
import re, json, sys, os

DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(DIR, "lexicon.txt")
OUT = os.path.join(DIR, "conway-shapes.js")

text = open(SRC, encoding='utf-8', errors='replace').read()
lines = text.split('\n')

entry_re = re.compile(r'^:([^:]+):')
diagram_line_re = re.compile(r'^(\t| {2,})([*.]+)\s*$')

entry_starts = []
for i, l in enumerate(lines):
    m = entry_re.match(l)
    if m:
        entry_starts.append((i, m.group(1).strip()))

shapes = []
seen_names = set()

for idx, (start, name) in enumerate(entry_starts):
    end = entry_starts[idx + 1][0] if idx + 1 < len(entry_starts) else len(lines)

    # Find first contiguous block of diagram lines within this entry
    # (some entries show multiple generations; we only want the initial shape).
    block = []
    collecting = False
    for j in range(start, end):
        m = diagram_line_re.match(lines[j])
        if m:
            block.append(m.group(2))
            collecting = True
        elif collecting:
            break

    if not block:
        continue

    h = len(block)
    w = max(len(row) for row in block)
    if w == 0 or h == 0 or w > 64 or h > 64:
        continue

    cells = []
    for y, row in enumerate(block):
        for x, ch in enumerate(row):
            if ch == '*':
                cells.append([x, y])

    if not cells:
        continue

    key = name.lower()
    if key in seen_names:
        continue
    seen_names.add(key)

    shapes.append({"name": name, "w": w, "h": h, "cells": cells})

shapes.sort(key=lambda s: s["name"].lower())

print(f"Parsed {len(shapes)} shapes", file=sys.stderr)

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Auto-generated from lexicon.txt by parse-lexicon.py — do not edit by hand.\n")
    f.write("const LEXICON_SHAPES = ")
    f.write(json.dumps(shapes, separators=(",", ":")))
    f.write(";\n")

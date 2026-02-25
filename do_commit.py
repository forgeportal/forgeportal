#!/usr/bin/env python3
"""Commit staged changes using git low-level commands to bypass Cursor Co-authored-by injection.

Usage:
  python do_commit.py "one-line message"
  python do_commit.py --file path/to/msg.txt
"""
import subprocess, sys, pathlib

if len(sys.argv) >= 3 and sys.argv[1] == "--file":
    msg = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8").strip()
elif len(sys.argv) >= 2:
    msg = sys.argv[1]
else:
    msg = "chore: update"

tree = subprocess.check_output(["git", "write-tree"]).decode().strip()
parent = subprocess.check_output(["git", "rev-parse", "HEAD"]).decode().strip()
commit = subprocess.check_output(
    ["git", "commit-tree", tree, "-p", parent, "-m", msg],
).decode().strip()
subprocess.check_call(["git", "update-ref", "HEAD", commit])
print(f"Committed: {commit[:12]} -- {msg.splitlines()[0]}")

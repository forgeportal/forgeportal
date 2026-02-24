#!/usr/bin/env python3
"""Commit staged changes using git low-level commands to bypass Cursor Co-authored-by injection."""
import subprocess, sys

msg = sys.argv[1] if len(sys.argv) > 1 else "chore: update"

tree = subprocess.check_output(["git", "write-tree"]).decode().strip()
parent = subprocess.check_output(["git", "rev-parse", "HEAD"]).decode().strip()
commit = subprocess.check_output(
    ["git", "commit-tree", tree, "-p", parent, "-m", msg],
).decode().strip()
subprocess.check_call(["git", "update-ref", "HEAD", commit])
print(f"Committed: {commit[:12]} — {msg.splitlines()[0]}")

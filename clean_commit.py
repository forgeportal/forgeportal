"""
Create a clean git commit bypassing Cursor's Co-authored-by injection.
Usage: python clean_commit.py "commit message"
"""
import subprocess
import sys
import os

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__)))
    if r.returncode != 0:
        print(f"ERROR: {' '.join(cmd)}\n{r.stderr}", file=sys.stderr)
        sys.exit(r.returncode)
    return r.stdout.strip()

def main():
    msg = sys.argv[1] if len(sys.argv) > 1 else "chore: update"

    # Write tree from current index
    tree = run(["git", "write-tree"])

    # Get current HEAD (parent)
    try:
        parent = run(["git", "rev-parse", "HEAD"])
        parent_args = ["-p", parent]
    except SystemExit:
        parent_args = []

    author = "Ahmed Bendaamer"
    email  = "bendaamerahmed@gmail.com"

    env = os.environ.copy()
    env["GIT_AUTHOR_NAME"]     = author
    env["GIT_AUTHOR_EMAIL"]    = email
    env["GIT_COMMITTER_NAME"]  = author
    env["GIT_COMMITTER_EMAIL"] = email

    cmd = ["git", "commit-tree", tree] + parent_args + ["-m", msg]
    r = subprocess.run(cmd, capture_output=True, text=True,
                       cwd=os.path.dirname(os.path.abspath(__file__)), env=env)
    if r.returncode != 0:
        print(f"ERROR commit-tree:\n{r.stderr}", file=sys.stderr)
        sys.exit(r.returncode)
    new_commit = r.stdout.strip()

    # Get current branch
    branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    run(["git", "update-ref", f"refs/heads/{branch}", new_commit])

    print(f"Created commit {new_commit} on {branch}")

if __name__ == "__main__":
    main()

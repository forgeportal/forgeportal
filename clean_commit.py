"""
Commit + strip Co-authored-by: Cursor via git commit-tree direct.
Usage: python clean_commit.py "message"
"""
import subprocess, os, sys

REPO = r'A:\ForgePortal'
os.chdir(REPO)

def git(*args, input_bytes=None):
    r = subprocess.run(['git'] + list(args), capture_output=True, input=input_bytes)
    return r.stdout.decode('utf-8', errors='replace').strip()

# Stage all
subprocess.run(['git', 'add', '-A'])

# Check if anything to commit
status = git('status', '--porcelain')
if not status:
    print('Nothing to commit.')
    sys.exit(0)

# Commit via normal path (Cursor will inject Co-authored-by)
msg_file = os.path.join(REPO, '.git', 'CLEAN_MSG_TMP')
commit_msg = open(msg_file, 'r', encoding='utf-8').read() if os.path.exists(msg_file) else sys.argv[1] if len(sys.argv) > 1 else 'chore: update'

# Write clean message
with open('.git/_COMMIT_MSG', 'w', newline='\n', encoding='utf-8') as f:
    f.write(commit_msg.rstrip('\n') + '\nSigned-off-by: bendaamerahmed <ahmed.b.daamer@gmail.com>\n')

subprocess.run(['git', 'commit', '-F', '.git/_COMMIT_MSG'])

# Now strip Co-authored-by: Cursor from the result
raw = subprocess.run(['git', 'cat-file', 'commit', 'HEAD'], capture_output=True).stdout.decode('utf-8', errors='replace')
lines = raw.split('\n')
sep = lines.index('')
body_lines = lines[sep + 1:]
clean_lines = [l for l in body_lines if 'Co-authored-by: Cursor' not in l]
while clean_lines and not clean_lines[-1].strip():
    clean_lines.pop()
clean_msg = '\n'.join(clean_lines) + '\n'

tree   = git('rev-parse', 'HEAD^{tree}')
parent = git('rev-parse', 'HEAD~1')
env = os.environ.copy()
env.update({
    'GIT_AUTHOR_NAME':     git('log', '-1', '--format=%an'),
    'GIT_AUTHOR_EMAIL':    git('log', '-1', '--format=%ae'),
    'GIT_AUTHOR_DATE':     git('log', '-1', '--format=%aI'),
    'GIT_COMMITTER_NAME':  git('log', '-1', '--format=%an'),
    'GIT_COMMITTER_EMAIL': git('log', '-1', '--format=%ae'),
    'GIT_COMMITTER_DATE':  git('log', '-1', '--format=%cI'),
})
result = subprocess.run(['git', 'commit-tree', tree, '-p', parent], input=clean_msg.encode('utf-8'), capture_output=True, env=env)
new_hash = result.stdout.decode().strip()
subprocess.run(['git', 'update-ref', 'refs/heads/master', new_hash])
subprocess.run(['git', 'reset', '--hard', new_hash])

print(f'Commit: {new_hash[:8]}')
print(git('log', '-1', '--pretty=%B'))

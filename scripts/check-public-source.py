"""Reject private artifacts and exact local credential values; never print secrets."""
import argparse
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit, unquote

parser = argparse.ArgumentParser()
parser.add_argument("--tracked", action="store_true", help="Audit HEAD instead of the staged index")
parser.add_argument("--secrets-from", type=Path, help="Compare against an external local credential folder")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]

def git(*argv):
    return subprocess.check_output(["git", *argv], cwd=root)

names = git("ls-tree", "-r", "--name-only", "-z", "HEAD") if args.tracked else git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
paths = [p.decode("utf-8") for p in names.split(b"\0") if p]
if not paths:
    raise SystemExit("No source files selected for audit.")

private = re.compile(r"(^|/)(?:work|tasks|artifacts|\.backups|node_modules|dist|\.next|\.wrangler|\.expo|\.gradle|build|test-results|coverage|__pycache__)(/|$)|(?:^|/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|local\.properties)$|\.(?:pem|key|p12|pfx|jks|keystore|dump|sqlite3?|db|apk|zip|log)$", re.I)
credentials = set()
secret_root = args.secrets_from.resolve() if args.secrets_from else root
for file in [*secret_root.glob(".env*"), secret_root / "apps/pages/.dev.vars"]:
    if not file.is_file() or file.name == ".env.example":
        continue
    for line in file.read_text(encoding="utf-8-sig").splitlines():
        match = re.match(r"\s*(?:export\s+)?([A-Z_0-9]+)\s*=\s*(.*?)\s*$", line)
        if not match or not re.search(r"KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL", match[1]):
            continue
        value = match[2].strip("\"'")
        if len(value) >= 8:
            credentials.add(value.encode())
        if match[1] == "DATABASE_URL":
            password = unquote(urlsplit(value).password or "")
            if len(password) >= 8:
                credentials.add(password.encode())

failures = []
for path in paths:
    if path != ".env.example" and private.search(path):
        failures.append((path, "private/generated path"))
    content = git("show", ("HEAD:" if args.tracked else ":") + path)
    if len(content) >= 100 * 1024 * 1024:
        failures.append((path, "GitHub file-size limit"))
    if any(value in content for value in credentials):
        failures.append((path, "exact local credential match"))
    # The scanner's own marker is assembled to avoid matching its source.
    marker = b"-----BEGIN "
    if any(marker + kind + b" PRIVATE KEY-----" in content for kind in [b"RSA", b"EC", b"OPENSSH"]) or marker + b"PRIVATE KEY-----" in content:
        failures.append((path, "private key material"))
if failures:
    for path, reason in failures:
        print(f"REJECTED {path}: {reason}")
    raise SystemExit(1)
print(f"Publication audit passed: {len(paths)} files; local credential values kept private.")

"""Package only the built extension; no credentials or local state."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
if not (dist / "manifest.json").is_file():
    raise SystemExit("Build the extension before packaging it.")
with ZipFile(root / "guruguard-extension.zip", "w", compression=ZIP_DEFLATED) as archive:
    for item in sorted(dist.rglob("*")):
        if not item.is_file() or item.suffix == ".map":
            continue
        entry = ZipInfo(item.relative_to(dist).as_posix(), (2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, item.read_bytes())
print("Built guruguard-extension.zip")

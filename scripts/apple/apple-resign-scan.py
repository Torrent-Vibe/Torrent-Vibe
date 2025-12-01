#!/usr/bin/env python3

import os
import subprocess
import sys


def scan_binaries(app_path):
    if not os.path.exists(app_path):
        sys.exit(1)

    all_paths = set()
    for root, dirs, files in os.walk(app_path):
        for d in dirs:
            if d.endswith(".framework"):
                all_paths.add(os.path.join(root, d))
            if d.endswith(".app"):
                all_paths.add(os.path.join(root, d))

        for f in files:
            all_paths.add(os.path.join(root, f))

    sorted_paths = sorted(all_paths, key=lambda x: (x.count(os.sep), x), reverse=True)

    app_pathes = []
    candidates = []
    for path in sorted_paths:
        if path.endswith(".framework"):
            candidates.append(path)
            continue
        if path.endswith(".app"):
            app_pathes.append(path)
            continue

        try:
            if os.path.isfile(path):
                r = subprocess.run(
                    ["file", path],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                )
                if "Mach-O" in r.stdout:
                    candidates.append(path)
        except Exception:
            pass

    for p in candidates:
        print(p)
    for p in app_pathes:
        print(p)
    print(app_path)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(1)
    app_path = sys.argv[1]
    if not os.path.exists(app_path):
        sys.exit(1)
    if not app_path.endswith(".app"):
        sys.exit(1)
    scan_binaries(app_path)

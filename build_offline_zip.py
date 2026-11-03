#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""构建 ops-toolbox 离线开箱即用包。

要点：
1. 排除 .git / __pycache__ / *.bak —— 历史踩坑：首次打包把整个 .git 打进去（76KB → 31KB）
2. 包内 index.html 的「下载离线版」按钮改指 tool.html —— zip 无法包含自身，否则是死链
3. 线上版 index.html 仍指向 zip（由调用方保证：先在仓库正本构建，再部署）
"""
import os
import re
import shutil
import sys
import zipfile

REPO = os.path.dirname(os.path.abspath(__file__))
STAGING = os.path.join(REPO, ".pkg-staging")
OUT = os.path.join(REPO, "ops-toolbox-offline.zip")

EXCLUDE_DIRS = {".git", "__pycache__", ".pkg-staging"}
EXCLUDE_SUFFIX = (".bak", ".pyc")

FILES = ["index.html", "tool.html", "changelog.html", "README.md", "LICENSE"]


def patch_index(html: str) -> str:
    """把包内 index.html 的下载按钮改指 tool.html（自包含，不能指向 zip 自身）。"""
    before = html
    html = html.replace(
        '<a class="btn btn-ghost" href="ops-toolbox-offline.zip" download>下载离线版</a>',
        '<a class="btn btn-ghost" href="tool.html">打开工具箱</a>',
    )
    html = html.replace(
        '<a class="nav-dl" href="ops-toolbox-offline.zip" download>下载离线版</a>',
        '<a class="nav-dl" href="tool.html">打开工具箱</a>',
    )
    if html == before:
        print("[warn] index.html 未匹配到下载按钮，请检查模板是否变更")
    return html


def main() -> int:
    if os.path.isdir(STAGING):
        shutil.rmtree(STAGING)
    os.makedirs(STAGING)

    for name in FILES:
        src = os.path.join(REPO, name)
        if not os.path.isfile(src):
            print("[fail] 缺少文件:", name)
            return 1
        shutil.copy2(src, os.path.join(STAGING, name))

    # 包内 index.html 自包含改造
    idx = os.path.join(STAGING, "index.html")
    with open(idx, encoding="utf-8") as f:
        html = f.read()
    with open(idx, "w", encoding="utf-8", newline="\n") as f:
        f.write(patch_index(html))

    # 打包
    if os.path.exists(OUT):
        os.remove(OUT)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        # 保留空目录占位（与历史包结构一致：assets/ 虽空但保留入口位）
        assets_dir = os.path.join(REPO, "assets")
        if os.path.isdir(assets_dir):
            z.writestr("assets/", "")
        for root, dirs, files in os.walk(STAGING):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for fn in files:
                if fn.endswith(EXCLUDE_SUFFIX):
                    continue
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, STAGING).replace(os.sep, "/")
                z.write(full, rel)

    # 校验
    with zipfile.ZipFile(OUT) as z:
        names = z.namelist()
        bad = [n for n in names if n.startswith(".git/") or n.endswith(EXCLUDE_SUFFIX)]
        if bad:
            print("[fail] 包内含应排除文件:", bad[:5])
            return 1
        pkg_idx = z.read("index.html").decode("utf-8")
        if "ops-toolbox-offline.zip" in pkg_idx:
            print("[fail] 包内 index.html 仍指向 zip 自身（死链）")
            return 1
        if "tool.html" not in pkg_idx:
            print("[fail] 包内 index.html 缺 tool.html 入口")
            return 1
        print("[ok] 包内文件:", ", ".join(sorted(names)))

    print("[ok] 生成:", OUT, os.path.getsize(OUT), "B")
    shutil.rmtree(STAGING)
    return 0


if __name__ == "__main__":
    sys.exit(main())

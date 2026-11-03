#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""构建 ops-toolbox 离线开箱即用包。

自包含原则：包内任何链接都不得指向"必须联网才能用"的站外资源。

改写规则：
1. 下载按钮 —— zip 无法包含自身，改为指向 tool.html（否则是自指死链）
2. 站内导航 —— 「返回工具列表」「产品介绍」指向 xmtooldev.gf.com.cn，离线时无意义：
   「产品介绍」改指包内 index.html（等价页存在）；「返回工具站」无等价页，直接移除入口
3. GitHub 源码链接 —— 保留。源码是可选溯源信息而非使用前提，
   隐藏反而让用户不知道项目开源；已在 README 说明查看需联网。

排除规则：
- .git / __pycache__ / *.bak —— 历史踩坑：首次打包把整个 .git 打进去（76KB → 31KB）
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

# 站内绝对地址（离线时不可达）
SITE_ROOT = "https://xmtooldev.gf.com.cn/"
SITE_LANDING = "https://xmtooldev.gf.com.cn/ops-toolbox/"


def _remove_anchor(html: str, marker: str) -> str:
    """移除包含 marker 的整个 <a ...>...</a> 元素（支持多行）。"""
    pat = re.compile(r"\s*<a\b[^>]*" + re.escape(marker) + r"[^>]*>.*?</a>", re.S)
    return pat.sub("", html)


def _strip_orphan_css(html: str, selectors) -> str:
    """移除已无对应元素的 CSS 规则块（离线移除入口后遗留的死样式）。

    按选择器长度降序处理，避免 ".nav-back" 先匹配掉 ".nav-back-txt" 的前缀。
    """
    out = html
    for sel in sorted(selectors, key=len, reverse=True):
        # 匹配 ".sel{" 起始、"}" 结束的规则块
        pat = re.compile(r"\n[ \t]*" + re.escape(sel) + r"\s*\{[^}]*\}", re.S)
        out, n = pat.subn("", out)
        if n:
            print("    清理孤儿 CSS %s x%d" % (sel, n))
    return out


def patch_index(html: str):
    """落地页离线化：移除下载入口与站内返回入口。"""
    notes = []

    # 1) 「下载离线版」按钮 —— 原语义是下载本包；离线时人已在包内，且与 CTA「进入工具箱」重复
    n = len(re.findall(r'<a\b[^>]*href="ops-toolbox-offline\.zip"[^>]*>.*?</a>', html, re.S))
    if n:
        html = re.sub(r'\s*<a\b[^>]*href="ops-toolbox-offline\.zip"[^>]*>.*?</a>', "", html, flags=re.S)
        notes.append("移除「下载离线版」x%d（离线时已在包内，且与 CTA 重复）" % n)
        html = _strip_orphan_css(html, [".nav-dl:hover", ".nav-dl"])

    # 2) 「返回工具站」入口 —— 离线时原站点不可达，无等价页 → 移除
    before = html
    html = _remove_anchor(html, 'href="%s"' % SITE_ROOT)
    if html != before:
        notes.append("移除「返回工具站」入口（离线无等价页）")
        html = _strip_orphan_css(html, [".nav-back:hover", ".nav-back svg", ".nav-back-txt", ".nav-back"])

    html = re.sub(r'<link rel="canonical"[^>]*>\s*', "", html)
    html = re.sub(r'<meta property="og:url"[^>]*>\s*', "", html)

    return html, notes


def patch_tool(html: str):
    """工具箱离线化：站内导航改指包内页或移除，保留 GitHub 源码链接。"""
    notes = []

    html = html.replace('href="%s"' % SITE_LANDING, 'href="index.html"')
    notes.append("「产品介绍」-> index.html（包内等价页）")

    before = html
    html = _remove_anchor(html, 'href="%s"' % SITE_ROOT)
    if html != before:
        notes.append("移除「返回工具站」入口（离线无等价页）")

    return html, notes


def patch_readme(text: str) -> str:
    """README 标注离线场景下哪些入口被调整。"""
    marker = "<!-- offline-note:begin -->"
    end = "<!-- offline-note:end -->"
    note = (
        marker + "\n"
        "> **离线包说明**：本包内文件为自包含副本。包内 `index.html` 与 `tool.html` 的\n"
        "> 站内导航已按离线场景调整——「产品介绍」指向包内 `index.html`，\n"
        "> 「返回工具站」入口已隐藏（离线环境下原站点不可达）。\n"
        "> 「GitHub 源码」按钮保留为开源溯源信息，查看需联网。\n"
        + end
    )
    if marker in text:
        return re.sub(re.escape(marker) + r".*?" + re.escape(end), note, text, flags=re.S)
    idx = text.find("## 目录结构")
    if idx == -1:
        return text + "\n\n" + note + "\n"
    return text[:idx] + note + "\n" + text[idx:]


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

    # --- 应用离线化改写 ---
    all_notes = []
    for name, patcher in (("index.html", patch_index), ("tool.html", patch_tool)):
        p = os.path.join(STAGING, name)
        with open(p, encoding="utf-8") as f:
            src = f.read()
        out, notes = patcher(src)
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            f.write(out)
        for nt in notes:
            all_notes.append("  %-11s %s" % (name, nt))

    rp = os.path.join(STAGING, "README.md")
    with open(rp, encoding="utf-8") as f:
        rsrc = f.read()
    with open(rp, "w", encoding="utf-8", newline="\n") as f:
        f.write(patch_readme(rsrc))
    all_notes.append("  README.md   追加离线包说明")

    print("[改写]")
    for nt in all_notes:
        print(nt)

    # --- 打包 ---
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

    # --- 校验 ---
    with zipfile.ZipFile(OUT) as z:
        names = z.namelist()
        bad = [n for n in names if n.startswith(".git/") or n.endswith(EXCLUDE_SUFFIX)]
        if bad:
            print("[fail] 包内含应排除文件:", bad[:5])
            return 1
        pkg_idx = z.read("index.html").decode("utf-8")
        pkg_tool = z.read("tool.html").decode("utf-8")

        errs = []
        if "ops-toolbox-offline.zip" in pkg_idx:
            errs.append("包内 index.html 仍指向 zip 自身（自指死链）")
        if "tool.html" not in pkg_idx:
            errs.append("包内 index.html 缺 tool.html 入口")
        for label, txt in (("index.html", pkg_idx), ("tool.html", pkg_tool)):
            if SITE_ROOT in txt:
                errs.append("%s 仍含站内绝对地址 %s（离线不可达）" % (label, SITE_ROOT))
        for label, txt in (("index.html", pkg_idx), ("tool.html", pkg_tool)):
            for href in set(re.findall(r'href="([A-Za-z0-9_.-]+\.(?:html|zip))"', txt)):
                if href not in names:
                    errs.append("%s 指向包内不存在的文件: %s" % (label, href))
        if errs:
            for e in errs:
                print("[fail]", e)
            return 1
        print("[ok] 包内文件:", ", ".join(sorted(names)))

    print("[ok] 生成:", OUT, os.path.getsize(OUT), "B")
    shutil.rmtree(STAGING)
    return 0


if __name__ == "__main__":
    sys.exit(main())

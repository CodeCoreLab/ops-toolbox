#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""通过 GitHub Contents API 推送文件（git smart-HTTP 通道不稳时的替代路径）。

git over HTTPS 在当前网络下反复 schannel/Empty-reply 失败，但 api.github.com 稳定，
故改走 Contents API 逐文件 PUT，等价于一次 push。
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

REPO = "CodeCoreLab/ops-toolbox"
BRANCH = "master"
LOCAL = os.path.dirname(os.path.abspath(__file__))
API = "https://api.github.com"

FILES = [
    ".gitignore",
    "README.md",
    "build_offline_zip.py",
    "changelog.html",
    "index.html",
    "tool.html",
    "LICENSE",
    "ops-toolbox-offline.zip",
]


def get_token():
    r = subprocess.run(["gh", "auth", "token"], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("取不到 gh token")
    return r.stdout.decode().strip()


TOKEN = None


def request(method, path, payload=None):
    url = API + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_sha(path):
    """已存在则返回 blob sha，不存在返回 None。"""
    try:
        return request("GET", "/repos/%s/contents/%s?ref=%s" % (REPO, path, BRANCH)).get("sha")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def put(path, data: bytes, sha):
    payload = {
        "message": "chore: 同步 %s" % path,
        "content": base64.b64encode(data).decode("ascii"),
        "branch": BRANCH,
    }
    if sha:
        payload["sha"] = sha
    request("PUT", "/repos/%s/contents/%s" % (REPO, path), payload)


def main():
    global TOKEN
    TOKEN = get_token()

    for rel in FILES:
        p = os.path.join(LOCAL, rel)
        if not os.path.isfile(p):
            print("[skip] 本地不存在:", rel)
            continue
        with open(p, "rb") as f:
            data = f.read()
        sha = get_sha(rel)
        action = "update" if sha else "create"
        try:
            put(rel, data, sha)
            print("[ok] %-26s %s  %dB" % (rel, action, len(data)))
        except Exception as e:
            print("[fail] %s -> %s" % (rel, str(e)[:300]))
            return 1
        time.sleep(0.6)  # 避免触发 API 速率限制

    # 回读校验
    print("\n--- 回读校验 ---")
    tree = request("GET", "/repos/%s/git/trees/%s?recursive=1" % (REPO, BRANCH))
    paths = {t["path"] for t in tree["tree"]}
    bad = 0
    for rel in FILES:
        present = rel in paths
        print(("  OK   " if present else "  MISS ") + rel)
        if not present:
            bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

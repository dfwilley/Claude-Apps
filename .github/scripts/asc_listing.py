"""Fills in an app's App Store page in App Store Connect from a listing file.

It writes the text (subtitle, description, keywords, links), the categories, the
notes for Apple's reviewer, the screenshots, and picks the newest uploaded build.

It never submits the app for review, never sets a price, never answers the age
rating or privacy questions, and never touches "Made for Kids". Those stay with
the owner, in the App Store Connect website.

Each part is tried on its own: if one fails, the others still run, and the
summary at the end says what worked and what did not.

Reads the App Store Connect API key from environment variables:
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8
Usage: python3 asc_listing.py <listing.json> <screenshots folder> [--replace-screenshots]
"""
import hashlib
import json
import os
import re
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt  # PyJWT

API = "https://api.appstoreconnect.apple.com/v1"
done, failed = [], []


class ApiError(Exception):
    pass


def token():
    now = int(time.time())
    return jwt.encode(
        {"iss": os.environ["ASC_ISSUER_ID"].strip(), "iat": now, "exp": now + 900,
         "aud": "appstoreconnect-v1"},
        os.environ["ASC_KEY_P8"],
        algorithm="ES256",
        headers={"kid": os.environ["ASC_KEY_ID"].strip(), "typ": "JWT"},
    )


def call(method, path, body=None, ok_missing=False):
    url = path if path.startswith("http") else API + path
    req = urllib.request.Request(
        url, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + token(),
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if ok_missing and e.code == 404:
            return None
        detail = e.read().decode(errors="replace")
        try:
            errs = json.loads(detail).get("errors", [])
            detail = "; ".join(f"{x.get('title', '')}: {x.get('detail', '')}" for x in errs) or detail
        except ValueError:
            pass
        raise ApiError(f"{method} {path.split('?')[0]} failed ({e.code}): {detail[:600]}")


def step(name, fn):
    """Runs one part; records whether it worked."""
    try:
        note = fn()
        done.append(name + (f" ({note})" if note else ""))
        print(f"OK: {name}" + (f" ({note})" if note else ""))
    except Exception as e:  # keep going with the other parts
        failed.append(f"{name}: {e}")
        print(f"::error::{name}: {e}")


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(26)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{os.path.basename(path)} is not a PNG file")
    w, h = struct.unpack(">II", head[16:24])
    return w, h, head[25]  # 25 = color type (6 means it has transparency)


def find_screenshots(root, folder, wanted, size):
    """Maps the names in `wanted` (like "2-ava-today") to files, using the build's manifest.json."""
    manifest = json.load(open(os.path.join(root, folder, "manifest.json")))
    by_name = {}
    for test in manifest:
        for a in test.get("attachments", []):
            name = a.get("suggestedHumanReadableName", "")
            if name.endswith(".png"):
                by_name[name.split("_")[0]] = os.path.join(root, folder, a["exportedFileName"])
    files = []
    for name in wanted:
        path = by_name.get(name)
        if not path or not os.path.exists(path):
            print(f"::warning::No screenshot named {name} in {folder}; skipped.")
            continue
        w, h, color = png_size(path)
        if [w, h] != list(size):
            print(f"::warning::{folder}/{name} is {w}x{h}, not {size[0]}x{size[1]}; skipped.")
            continue
        if color in (4, 6):
            print(f"::warning::{folder}/{name} has transparency, which Apple refuses; skipped.")
            continue
        files.append((name, path))
    return files


def upload_screenshot(set_id, name, path):
    data = open(path, "rb").read()
    made = call("POST", "/appScreenshots", {"data": {
        "type": "appScreenshots",
        "attributes": {"fileName": name + ".png", "fileSize": len(data)},
        "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}}}})["data"]
    for op in made["attributes"]["uploadOperations"]:
        chunk = data[op["offset"]: op["offset"] + op["length"]]
        req = urllib.request.Request(op["url"], method=op["method"], data=chunk)
        for h in op.get("requestHeaders", []):
            req.add_header(h["name"], h["value"])
        with urllib.request.urlopen(req, timeout=300) as r:
            r.read()
    call("PATCH", f"/appScreenshots/{made['id']}", {"data": {
        "type": "appScreenshots", "id": made["id"],
        "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()}}})
    return made["id"]


def main():
    cfg = json.load(open(sys.argv[1]))
    shots_root = sys.argv[2]
    replace = "--replace-screenshots" in sys.argv[3:]
    locale = cfg.get("locale", "en-US")
    bundle = cfg["bundleId"]

    apps = [a for a in call("GET", f"/apps?filter[bundleId]={urllib.parse.quote(bundle)}&limit=10")["data"]
            if a["attributes"]["bundleId"] == bundle]
    if not apps:
        sys.exit(f"::error::No app record for {bundle} in App Store Connect.")
    app = apps[0]
    app_id = app["id"]
    print(f"App: {app['attributes']['name']}")

    # ---- the version being prepared (1.0 is made by Apple together with the app record)
    versions = call("GET", f"/apps/{app_id}/appStoreVersions?filter[platform]=IOS&limit=10")["data"]
    for v in versions:
        a = v["attributes"]
        print(f"Version {a.get('versionString')}: {a.get('appVersionState') or a.get('appStoreState')}")
    editable_states = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY"}
    editable = [v for v in versions
                if (v["attributes"].get("appVersionState") or v["attributes"].get("appStoreState")) in editable_states]
    if not editable:
        sys.exit("::error::No version is open for editing (it may already be waiting for review or on sale). Nothing was changed.")
    version = editable[0]
    vid = version["id"]

    # ---- text on the version: description, keywords, promotional text, links
    def version_text():
        locs = call("GET", f"/appStoreVersions/{vid}/appStoreVersionLocalizations?limit=50")["data"]
        loc = next((x for x in locs if x["attributes"]["locale"] == locale), None)
        attrs = {"description": "\n".join(cfg["description"]), "keywords": cfg["keywords"],
                 "promotionalText": cfg["promotionalText"], "supportUrl": cfg["supportUrl"],
                 "marketingUrl": cfg.get("marketingUrl")}
        attrs = {k: v for k, v in attrs.items() if v}
        if loc:
            call("PATCH", f"/appStoreVersionLocalizations/{loc['id']}", {"data": {
                "type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": attrs}})
            return loc["id"]
        attrs["locale"] = locale
        made = call("POST", "/appStoreVersionLocalizations", {"data": {
            "type": "appStoreVersionLocalizations", "attributes": attrs,
            "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
        return made["data"]["id"]

    loc_box = {}

    def do_version_text():
        loc_box["id"] = version_text()
    step("Description, keywords, promotional text and support link", do_version_text)

    # ---- app information: subtitle, privacy policy link, categories
    infos = call("GET", f"/apps/{app_id}/appInfos?limit=10")["data"]
    info = next((i for i in infos if (i["attributes"].get("state") or i["attributes"].get("appStoreState"))
                 not in ("READY_FOR_DISTRIBUTION", "READY_FOR_SALE")), infos[0] if infos else None)

    def info_text():
        locs = call("GET", f"/appInfos/{info['id']}/appInfoLocalizations?limit=50")["data"]
        loc = next((x for x in locs if x["attributes"]["locale"] == locale), None)
        if not loc:
            raise ApiError(f"no {locale} page on the app information")
        call("PATCH", f"/appInfoLocalizations/{loc['id']}", {"data": {
            "type": "appInfoLocalizations", "id": loc["id"],
            "attributes": {"subtitle": cfg["subtitle"], "privacyPolicyUrl": cfg["privacyPolicyUrl"]}}})

    def categories():
        rel = {"primaryCategory": {"data": {"type": "appCategories", "id": cfg["primaryCategory"]}}}
        if cfg.get("secondaryCategory"):
            rel["secondaryCategory"] = {"data": {"type": "appCategories", "id": cfg["secondaryCategory"]}}
        call("PATCH", f"/appInfos/{info['id']}", {"data": {"type": "appInfos", "id": info["id"], "relationships": rel}})
        return " and ".join(x for x in [cfg["primaryCategory"], cfg.get("secondaryCategory")] if x).title()

    if info:
        step("Subtitle and privacy policy link", info_text)
        step("Categories", categories)
    else:
        failed.append("App information: none found")

    # ---- notes for Apple's reviewer (contact name, phone and email are left for the owner)
    def review_notes():
        attrs = {"notes": "\n\n".join(cfg["reviewNotes"]), "demoAccountRequired": False}
        cur = call("GET", f"/appStoreVersions/{vid}/appStoreReviewDetail", ok_missing=True)
        # The link to the owner's screen recording is typed into App Store Connect by hand and is
        # never kept in this (public) repository. If one is already there, keep it.
        if "PASTE-LINK-HERE" in attrs["notes"] and cur and cur.get("data"):
            first = ((cur["data"]["attributes"].get("notes") or "").split("\n\n") or [""])[0]
            link = re.search(r"https?://\S+", first)
            if link:
                attrs["notes"] = attrs["notes"].replace("PASTE-LINK-HERE", link.group(0))
        if cur and cur.get("data"):
            rid = cur["data"]["id"]
            call("PATCH", f"/appStoreReviewDetails/{rid}", {"data": {
                "type": "appStoreReviewDetails", "id": rid, "attributes": attrs}})
        else:
            call("POST", "/appStoreReviewDetails", {"data": {
                "type": "appStoreReviewDetails", "attributes": attrs,
                "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
    step("Notes for Apple's reviewer", review_notes)

    # ---- the build: newest one Apple has finished processing
    def pick_build():
        builds = call("GET", f"/builds?filter[app]={app_id}&sort=-uploadedDate&limit=20")["data"]
        good = [b for b in builds if b["attributes"].get("processingState") == "VALID"
                and not b["attributes"].get("expired")]
        if not good:
            raise ApiError("no build has finished processing yet")
        best = max(good, key=lambda b: int(b["attributes"]["version"]) if str(b["attributes"]["version"]).isdigit() else 0)
        call("PATCH", f"/appStoreVersions/{vid}/relationships/build", {"data": {"type": "builds", "id": best["id"]}})
        return "build " + str(best["attributes"]["version"])
    step("Build chosen for the App Store version", pick_build)

    # ---- screenshots
    def screenshots(spec):
        def run():
            lid = loc_box.get("id")
            if not lid:
                raise ApiError("the App Store page text could not be opened, so there is nowhere to put them")
            files = find_screenshots(shots_root, spec["folder"], cfg["screenshots"]["order"], spec["size"])
            if not files:
                raise ApiError("no usable screenshot files were found")
            sets = call("GET", f"/appStoreVersionLocalizations/{lid}/appScreenshotSets?limit=50")["data"]
            cur = next((s for s in sets if s["attributes"]["screenshotDisplayType"] == spec["displayType"]), None)
            if cur:
                old = call("GET", f"/appScreenshotSets/{cur['id']}/appScreenshots?limit=50")["data"]
                if old and not replace:
                    return f"left alone: {len(old)} already there"
                for o in old:
                    call("DELETE", f"/appScreenshots/{o['id']}")
                set_id = cur["id"]
            else:
                set_id = call("POST", "/appScreenshotSets", {"data": {
                    "type": "appScreenshotSets",
                    "attributes": {"screenshotDisplayType": spec["displayType"]},
                    "relationships": {"appStoreVersionLocalization": {
                        "data": {"type": "appStoreVersionLocalizations", "id": lid}}}}})["data"]["id"]
            ids = [upload_screenshot(set_id, name, path) for name, path in files]
            # Put them in the listed order, then wait for Apple to finish checking them
            call("PATCH", f"/appScreenshotSets/{set_id}/relationships/appScreenshots",
                 {"data": [{"type": "appScreenshots", "id": i} for i in ids]})
            bad = []
            for _ in range(20):
                time.sleep(6)
                now = call("GET", f"/appScreenshotSets/{set_id}/appScreenshots?limit=50")["data"]
                states = [(s["attributes"]["fileName"], (s["attributes"].get("assetDeliveryState") or {})) for s in now]
                bad = [(n, st) for n, st in states if st.get("state") == "FAILED"]
                if bad or all(st.get("state") == "COMPLETE" for _, st in states):
                    break
            if bad:
                why = "; ".join(f"{n}: " + ", ".join(e.get("description", "") for e in st.get("errors", [])) for n, st in bad)
                raise ApiError("Apple refused " + why)
            return f"{len(ids)} uploaded"
        return run

    for spec in cfg["screenshots"]["sets"]:
        step(f"Screenshots for {spec['folder']} ({spec['size'][0]} x {spec['size'][1]})", screenshots(spec))

    # ---- summary
    lines = ["## App Store page: " + app["attributes"]["name"], "", "**Filled in**", ""]
    lines += [f"- {d}" for d in done] or ["- nothing"]
    if failed:
        lines += ["", "**Did not work**", ""] + [f"- {f}" for f in failed]
    lines += ["", "Not touched: price, age rating answers, privacy answers, Made for Kids, your contact details, and Submit."]
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        open(summary, "a").write("\n".join(lines) + "\n")
    print("\n".join(lines))
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()

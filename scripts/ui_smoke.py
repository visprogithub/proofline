from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT = Path("artifacts/ui-smoke")
OUTPUT.mkdir(parents=True, exist_ok=True)


def inspect_page(page, screenshot_name: str) -> None:
    errors: list[str] = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")

    assert page.title() == "Proofline - Evidence before approval"
    assert page.get_by_role("heading", name="The diff says done. Show the proof.").is_visible()
    assert page.get_by_label("Public GitHub change").is_visible()
    assert page.get_by_role("button", name="Analyze evidence").is_visible()
    assert page.get_by_role("button", name="Try the evidence dossier").is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    if page.viewport_size and page.viewport_size["width"] >= 1000:
        assert page.evaluate("document.documentElement.scrollHeight <= window.innerHeight")
    assert not errors, f"Browser console errors: {errors}"

    page.screenshot(path=str(OUTPUT / screenshot_name), full_page=True)


def inspect_demo(page, screenshot_name: str) -> None:
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    page.get_by_role("button", name="Try the evidence dossier").click()
    page.get_by_role("heading", name="Add reviewer evidence exports").wait_for()

    assert page.get_by_text("Sample / synthetic case").is_visible()
    assert page.get_by_text("Hardcoded response object added").is_visible()
    assert page.get_by_text("Test evidence found").is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    page.screenshot(path=str(OUTPUT / screenshot_name), full_page=True)


def inspect_declared_commit_claim(page, screenshot_name: str) -> None:
    def github_route(route) -> None:
        url = route.request.url
        if "/check-runs" in url:
            payload = '{"check_runs":[]}'
        elif "/git/trees/" in url:
            payload = '{"truncated":false,"tree":[]}'
        else:
            payload = """{
              "sha":"866ed8cc7e2543368c676c05540d71d7ef29b668",
              "html_url":"https://github.com/visprogithub/uipath_simcity_enterprise/commit/866ed8cc7e2543368c676c05540d71d7ef29b668",
              "commit":{"message":"feat: enhance backend loading experience with informative UI and retry option"},
              "files":[{"sha":"file","filename":"src/loading.ts","status":"modified","additions":2,"deletions":0,"patch":"@@ -1 +1,2 @@\\n+backend loading status\\n+show retry option"}]
            }"""
        route.fulfill(
            status=200,
            content_type="application/json",
            headers={"Access-Control-Allow-Origin": "*"},
            body=payload,
        )

    page.route("https://api.github.com/**", github_route)
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    page.get_by_label("Public GitHub change").fill(
        "https://github.com/visprogithub/uipath_simcity_enterprise/commit/866ed8cc7e2543368c676c05540d71d7ef29b668"
    )
    page.get_by_role("button", name="Analyze evidence").click()
    page.get_by_role("heading", name="Declared change claims").wait_for()

    assert page.get_by_text("No formal requirement IDs found.").is_visible()
    assert page.locator(".requirement-id", has_text="CLAIM-001").is_visible()
    assert page.get_by_text("Suggested evidence found").is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    page.screenshot(path=str(OUTPUT / screenshot_name), full_page=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    inspect_page(browser.new_page(viewport={"width": 1440, "height": 1000}), "desktop.png")
    inspect_page(browser.new_page(viewport={"width": 390, "height": 844}), "mobile.png")
    inspect_demo(browser.new_page(viewport={"width": 1440, "height": 1000}), "demo-desktop.png")
    inspect_demo(browser.new_page(viewport={"width": 390, "height": 844}), "demo-mobile.png")
    inspect_declared_commit_claim(
        browser.new_page(viewport={"width": 1440, "height": 1000}), "claim-desktop.png"
    )
    inspect_declared_commit_claim(
        browser.new_page(viewport={"width": 390, "height": 844}), "claim-mobile.png"
    )
    browser.close()

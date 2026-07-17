import sys

from playwright.sync_api import sync_playwright


target = sys.argv[1] if len(sys.argv) > 1 else "https://github.com/ryokun6/ryos/pull/1874"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    console_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    page.get_by_label("Public GitHub change").fill(target)
    page.get_by_role("button", name="Analyze evidence").click()
    page.wait_for_function(
        """() => document.body.innerText.includes('New case')
        || document.querySelector('.error-message') !== null""",
        timeout=30_000,
    )

    error = page.locator(".error-message")
    if error.count():
        message = error.inner_text()
        assert "does not implement interface Window" not in message
        print(f"Handled GitHub response: {message}")
    else:
        print(f"Analysis opened: {page.locator('h1').first.inner_text()}")

    assert not any("does not implement interface Window" in item for item in console_errors)
    browser.close()

from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples" / "local-import"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    page.get_by_role("button", name="Import local evidence").click()
    page.get_by_label("Choose requirements document").set_input_files(
        EXAMPLES / "proofline-sample-service-pr-17-requirements.md"
    )
    page.get_by_label("Choose unified diff").set_input_files(
        EXAMPLES / "proofline-sample-service-pr-17.patch"
    )
    page.get_by_label("Choose optional JUnit results").set_input_files(
        EXAMPLES / "proofline-sample-service-pr-17-junit.xml"
    )
    page.get_by_role("button", name="Analyze local evidence").click()
    page.get_by_role("heading", name="Local evidence analysis").wait_for()
    page.locator(".react-flow__node").first.wait_for()

    initial_nodes = page.locator(".react-flow__node").count()
    assert initial_nodes > 0

    def visible_nodes() -> int:
        return page.evaluate(
            """() => {
              const canvas = document.querySelector('.graph-canvas');
              if (!canvas) return 0;
              const bounds = canvas.getBoundingClientRect();
              return [...document.querySelectorAll('.react-flow__node')].filter((node) => {
                const rect = node.getBoundingClientRect();
                return rect.right > bounds.left && rect.left < bounds.right
                  && rect.bottom > bounds.top && rect.top < bounds.bottom;
              }).length;
            }"""
        )

    assert visible_nodes() > 0

    for button_name in ("Markdown", "JSON", "Mermaid map"):
        with page.expect_download() as download_info:
            page.get_by_role("button", name=button_name, exact=True).click()
        download = download_info.value
        path = download.path()
        assert path is not None
        assert path.stat().st_size > 0, f"{button_name} download was empty"
        assert page.locator(".react-flow__node").count() == initial_nodes
        page.wait_for_timeout(100)
        assert visible_nodes() > 0, f"Evidence map became visually blank after {button_name} export"

    browser.close()

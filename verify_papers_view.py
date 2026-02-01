from playwright.sync_api import Page, expect, sync_playwright

def verify_papers_view(page: Page):
    print("Navigating to http://localhost:5173")
    page.goto("http://localhost:5173")

    print("Waiting for paper card...")
    # Wait for the first paper card to appear
    expect(page.get_by_text("Test Paper 1: Optimization of React Lists")).to_be_visible()

    print("Paper card visible.")
    # Check that the second paper is also there
    expect(page.get_by_text("Test Paper 2: Another Paper")).to_be_visible()

    # Check for DOI link
    expect(page.get_by_text("DOI")).to_be_visible()

    print("Taking screenshot...")
    page.screenshot(path="/home/jules/verification/papers_view.png")
    print("Screenshot saved.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_papers_view(page)
        finally:
            browser.close()

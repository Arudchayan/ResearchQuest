from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:5173")
    page.wait_for_timeout(2000)

    # Use the evaluate script to open the modal
    page.evaluate("""
        document.dispatchEvent(new CustomEvent('open-data-management'));
    """)
    page.wait_for_timeout(2000)

    # Take screenshot of the export dialog to show tasks is selected
    page.screenshot(path="/app/verification/screenshots/tasks_export_dialog.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/app/verification/videos",
            viewport={'width': 1280, 'height': 800}
        )
        context.add_init_script("""
            window.__TEST_USER__ = {
                id: '123',
                email: 'test@example.com',
                user_metadata: { name: 'Test User' }
            };
        """)

        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

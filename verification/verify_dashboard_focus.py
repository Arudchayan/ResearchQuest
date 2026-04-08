from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:5173")  # Vite default port
    page.wait_for_timeout(2000)

    # Inject test user state into localStorage
    page.evaluate("""
        localStorage.setItem('researchquest-storage', JSON.stringify({
            state: {
                currentView: 'dashboard',
                user: { id: 'test-user-id', email: 'test@example.com' },
                notes: [],
                papers: [],
                tasks: []
            },
            version: 0
        }));
        window.__TEST_USER__ = { id: 'test-user-id', email: 'test@example.com' };
    """)
    page.reload()
    page.wait_for_timeout(2000)

    # Focus through elements
    for _ in range(8):
        page.keyboard.press("Tab")
        page.wait_for_timeout(500)

    # Take screenshot at the key moment
    page.screenshot(path="/app/verification/screenshots/verification_dashboard_focus.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/app/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

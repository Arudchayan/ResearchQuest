import os
from playwright.sync_api import Page, expect, sync_playwright

def verify_feature(page: Page):
    page.goto("http://localhost:5173")
    page.wait_for_timeout(1000)

    # Click on the "Ideas" link in the sidebar
    page.get_by_role("link", name="Ideas").click()
    page.wait_for_timeout(1000)

    # Assert that the sort dropdown is visible
    sort_dropdown = page.get_by_role("combobox", name="Sort ideas")
    expect(sort_dropdown).to_be_visible()

    # Change sort to "Title (A-Z)"
    sort_dropdown.select_option("title_asc")
    page.wait_for_timeout(1000)

    # Screenshot the final state
    page.screenshot(path="verification/ideas_board_sort.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="verification/video")

        # Add init script to mock authentication BEFORE navigation
        context.add_init_script("""
            window.__TEST_USER__ = {
                id: '123',
                email: 'test@example.com',
                user_metadata: { name: 'Test User' }
            };
        """)

        page = context.new_page()
        try:
            verify_feature(page)
        finally:
            context.close()
            browser.close()

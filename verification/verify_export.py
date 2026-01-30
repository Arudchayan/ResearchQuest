from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_export_feature(page: Page):
    print("Navigating to home...")
    page.goto("http://localhost:5173")

    # Auth
    print("Waiting for auth screen...")
    # The button text is "🛠️ Use Test Login"
    test_login_btn = page.get_by_text("Use Test Login")
    test_login_btn.wait_for()
    test_login_btn.click()

    # Wait for login
    print("Waiting for login...")
    # Wait for "ResearchQuest" in sidebar to confirm login
    page.get_by_text("ResearchQuest", exact=True).wait_for()

    # Verify Sidebar
    print("Verifying Sidebar...")
    export_btn = page.get_by_role("button", name="Export Data")
    expect(export_btn).to_be_visible()

    # Screenshot Sidebar
    page.screenshot(path="verification/sidebar_export.png")
    print("Sidebar screenshot taken.")

    # Verify Command Palette
    print("Opening Command Palette...")
    page.keyboard.press("Meta+k")

    print("Typing 'Export'...")
    page.get_by_placeholder("Type a command or search...").fill("Export")

    # Wait for result - command palette items are role="option"
    export_cmd = page.get_by_text("Export All Data")
    expect(export_cmd).to_be_visible()

    # Screenshot Command Palette
    page.screenshot(path="verification/command_palette_export.png")
    print("Command Palette screenshot taken.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Set viewport big enough to see sidebar
        page.set_viewport_size({"width": 1280, "height": 720})
        try:
            verify_export_feature(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

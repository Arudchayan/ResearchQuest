import os
import shutil
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.add_init_script("""
        window.__TEST_USER__ = { id: 'test-user', email: 'test@example.com' };
        window.localStorage.setItem('researchquest-storage', JSON.stringify({state: {currentView: 'papers'}, version: 0}));
    """)
    page.goto("http://localhost:5173/")
    page.wait_for_timeout(2000)

    # Click the Papers tab
    page.get_by_role("link", name="Papers").first.click()
    page.wait_for_timeout(2000)

    # Click "Add Paper" button
    page.get_by_role("button", name="Add Paper").click()
    page.wait_for_timeout(1000)

    # Click "IMPORT" tab
    page.get_by_text("IMPORT", exact=True).click()
    page.wait_for_timeout(1000)

    # Locate the drop zone specifically by the label and upload container
    drop_zone = page.locator("div.border-dashed").first

    # Take screenshot of the normal state
    page.screenshot(path="/home/jules/verification/screenshots/import_normal.png")

    # Simulate dragover by evaluating JS directly on the container
    drop_zone.evaluate("""(element) => {
        const dragEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
        element.dispatchEvent(dragEvent);
    }""")

    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/screenshots/import_dragging.png")
    page.wait_for_timeout(1000)

    # Simulate drop
    drop_zone.evaluate("""(element) => {
        const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
        element.dispatchEvent(dropEvent);
    }""")
    page.wait_for_timeout(500)

if __name__ == "__main__":
    video_dir = "/home/jules/verification/videos"
    if os.path.exists(video_dir):
        shutil.rmtree(video_dir)
    os.makedirs(video_dir)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir=video_dir)
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

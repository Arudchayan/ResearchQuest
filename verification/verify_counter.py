from playwright.sync_api import Page, expect, sync_playwright

def test_character_counter(page: Page):
    print("Navigating to /papers...")
    page.goto("http://localhost:5173/papers")

    print("Waiting for load...")
    try:
        page.wait_for_selector("text=Research Library", timeout=10000)
    except:
        print("Research Library header not found, taking screenshot")
        page.screenshot(path="verification/error_load.png")
        raise

    print("Clicking Add Paper...")
    # Try to find "Add Paper" button.
    # In empty state: "Add a paper now"
    # In header: "Add Paper"
    try:
        add_btn = page.get_by_role("button", name="Add Paper")
        if add_btn.is_visible():
            add_btn.click()
        else:
            page.get_by_text("Add a paper now").click()
    except:
        page.get_by_text("Add a paper now").click()

    print("Waiting for dialog...")
    # Wait for dialog to open. "Add New Paper"
    expect(page.get_by_text("Add New Paper")).to_be_visible()

    print("Switching to Manual Entry...")
    # Switch to "Manual Entry" tab
    page.get_by_role("tab", name="Manual Entry").click()

    print("Checking initial state (counter hidden)...")
    # Find the title input
    title_input = page.get_by_placeholder("Enter paper title")

    # Counter should NOT be visible initially
    expect(page.get_by_text("/255")).not_to_be_visible()

    print("Focusing input...")
    # Focus the input
    title_input.focus()

    print("Checking focused state (counter visible)...")
    # Counter SHOULD be visible now
    # Text should be "0/255"
    expect(page.get_by_text("0/255")).to_be_visible()

    print("Typing text...")
    # Type something
    title_input.fill("Test Paper")

    print("Checking updated counter...")
    # Counter should update
    expect(page.get_by_text("10/255")).to_be_visible()

    print("Blurring input...")
    # Blur by focusing the authors input
    page.get_by_placeholder("John Doe, Jane Smith, et al.").focus()

    print("Checking blurred state (counter hidden)...")
    # Counter should NOT be visible
    expect(page.get_by_text("10/255")).not_to_be_visible()

    print("Refocusing for screenshot...")
    # Take screenshot while focused to prove it works
    title_input.focus()
    expect(page.get_by_text("10/255")).to_be_visible()

    print("Taking screenshot...")
    page.screenshot(path="verification/verification.png")
    print("Done!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_character_counter(page)
        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path="verification/error_final.png")
            raise
        finally:
            browser.close()

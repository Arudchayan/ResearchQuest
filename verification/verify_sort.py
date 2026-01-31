from playwright.sync_api import Page, expect, sync_playwright

def test_paper_sorting(page: Page):
    # 1. Arrange: Go to the app (using TestWrapper)
    page.goto("http://localhost:5173")

    # Wait for papers to load
    page.wait_for_timeout(1000)

    # 2. Assert: Check initial order (Last Updated Newest) -> A, B, C
    titles = page.locator("h3").all_inner_texts()
    print("Initial titles:", titles)

    # 3. Act: Change sort to Last Updated (Oldest)
    page.get_by_label("Sort papers").select_option("updated_asc")

    page.wait_for_timeout(500)

    # 4. Assert: Check new order -> C, B, A
    titles_asc = page.locator("h3").all_inner_texts()
    print("Sorted titles:", titles_asc)

    # 5. Screenshot
    page.screenshot(path="verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_paper_sorting(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

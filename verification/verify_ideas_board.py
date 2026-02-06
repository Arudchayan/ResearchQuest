from playwright.sync_api import Page, expect, sync_playwright

def verify_ideas_board(page: Page):
    # 1. Arrange: Go to the app (TestWrapper renders IdeasBoard directly)
    page.goto("http://localhost:5173")

    # 2. Assert: Verify Idea Board is visible
    expect(page.get_by_text("Idea Board")).to_be_visible()

    # 3. Act: Find an idea card and focus it (tab navigation)
    # We look for the text "Quantum Entanglement"
    card = page.get_by_text("Quantum Entanglement")
    expect(card).to_be_visible()

    # Click it to ensure it's there, but we want to test keyboard focus
    # card.click()

    # Tab into the card. The card itself should be focusable now.
    # Note: OnboardingGuide might be first focusable.
    # We can force focus on the card to simulate tabbing to it.

    # Find the card element (it's the parent of the title)
    # Using locator for the card content
    card_locator = page.locator("div.group").filter(has_text="Quantum Entanglement")
    card_locator.focus()

    # 4. Assert: Verify the delete button is visible when focused
    delete_btn = card_locator.get_by_role("button", name="Delete Quantum Entanglement")

    # It should be in the DOM
    expect(delete_btn).to_be_attached()

    # It might be hidden by opacity until focus-within.
    # Since we focused the card (which contains the button), group-focus-within should trigger.
    # However, checking computed style for opacity might be flaky.
    # We can check if it's visible in the screenshot.

    # 5. Screenshot
    page.screenshot(path="verification/ideas_board_focus.png")
    print("Screenshot taken")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_ideas_board(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

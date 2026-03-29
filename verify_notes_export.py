from playwright.sync_api import sync_playwright
 
def verify_notes_export():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Inject test user before page loads
        page.add_init_script("""
            window.__TEST_USER__ = { id: 'test-user', email: 'test@example.com' };
        """)

        print("Navigating to /notes...")
        page.goto("http://localhost:5173/notes")

        # Wait for app to initialize and expose store
        print("Waiting for app store...")
        page.wait_for_function("() => window.__APP_STORE__")

        # Inject test notes
        print("Injecting test notes...")
        page.evaluate("""() => {
            const store = window.__APP_STORE__.getState();
            store.setNotes([
                {
                    id: 'n1',
                    user_id: 'test-user',
                    title: 'Test Note for Export',
                    markdown_body: '# Export Test\\nThis is a test note to verify export functionality.',
                    tags: ['test'],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    linked_entity_ids: []
                }
            ]);
            store.setNotesLoading(false);
        }""")

        # Wait for note to appear in list
        print("Waiting for note to appear...")
        page.get_by_text("Test Note for Export").wait_for()

        # Find export button (it has title "Export notes")
        print("Finding export button...")
        export_btn = page.locator('button[title="Export notes"]')
        export_btn.wait_for()

        # Click export button to open dropdown
        print("Clicking export button...")
        export_btn.click()

        # Verify dropdown items
        print("Verifying dropdown items...")
        page.get_by_text("Markdown (.md)").wait_for()
        page.get_by_text("CSV (.csv)").wait_for()
        page.get_by_text("JSON (.json)").wait_for()

        # Screenshot
        print("Taking screenshot...")
        page.screenshot(path="/tmp/verification_export.png")

        browser.close()
        print("Verification complete!")

if __name__ == "__main__":
    verify_notes_export()

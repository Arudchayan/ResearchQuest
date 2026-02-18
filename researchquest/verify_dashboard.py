from playwright.sync_api import sync_playwright
import time

def verify_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        print("Navigating to http://localhost:5173")
        page.goto("http://localhost:5173")

        print("Waiting for app to load (10s)...")
        page.wait_for_timeout(10000)

        # Check if window.useAppStore is available
        is_store_available = page.evaluate("typeof window.useAppStore !== 'undefined'")
        if not is_store_available:
            print("❌ window.useAppStore is NOT available")
            content = page.content()
            print("Page content:")
            print(content[:1000]) # First 1000 chars
            browser.close()
            return

        print("✅ window.useAppStore is available")

        # Inject fake user and data
        print("Injecting fake user and data...")
        page.evaluate("""
            const store = window.useAppStore.getState();
            store.setUser({
                id: 'test-user',
                email: 'test@example.com',
                username: 'Test User',
                full_name: 'Test User',
                avatar_url: null,
                total_xp: 1200,
                current_level: 3,
                current_streak: 5,
                longest_streak: 10,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            store.setNotes([
                {
                    id: 'note-1',
                    user_id: 'test-user',
                    title: 'Test Note 1',
                    markdown_body: 'This is a test note content.',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ]);

            store.setPapers([
                {
                    id: 'paper-1',
                    user_id: 'test-user',
                    title: 'Test Paper 1',
                    authors: ['Author A', 'Author B'],
                    publication_date: '2023-01-01',
                    status: 'To Read',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    abstract: 'Abstract',
                    citation_count: 0
                }
            ]);

            store.setTasks([
                {
                    id: 'task-1',
                    user_id: 'test-user',
                    title: 'Test Task 1',
                    due_date: new Date(Date.now() + 86400000).toISOString(),
                    status: 'todo',
                    priority: 'high',
                    completed: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ]);

            store.setCurrentView('dashboard');
        """)

        # Wait for data to render
        page.wait_for_timeout(2000)

        try:
            print("Verifying recent note button...")
            note_button = page.get_by_role("button", name="Test Note 1")
            note_button.wait_for(timeout=5000)
            print("✅ Found recent note button")

            print("Verifying paper button...")
            paper_button = page.get_by_role("button", name="Test Paper 1")
            paper_button.wait_for(timeout=5000)
            print("✅ Found paper button")

            print("Verifying task button...")
            task_button = page.get_by_role("button", name="Test Task 1")
            task_button.wait_for(timeout=5000)
            print("✅ Found task button")

            page.screenshot(path="researchquest/dashboard_verification.png")
            print("📸 Screenshot saved to researchquest/dashboard_verification.png")

        except Exception as e:
            print(f"❌ Verification failed: {e}")
            page.screenshot(path="researchquest/dashboard_verification_failed.png")
            print("📸 Failure screenshot saved to researchquest/dashboard_verification_failed.png")

        browser.close()

if __name__ == "__main__":
    verify_dashboard()

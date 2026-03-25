from playwright.sync_api import sync_playwright, expect

def verify_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        # Inject test user BEFORE going to the page
        context.add_init_script("""
            window.__TEST_USER__ = { id: 'test-user', email: 'test@example.com' };
        """)

        page = context.new_page()

        # Intercept route to prevent infinite loading of data from supabase
        page.route("**/rest/v1/**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body="[]"
        ))

        page.goto("http://localhost:5174/")

        # Inject mock data into the store after loading App.tsx
        page.evaluate("""
            if (window.__APP_STORE__) {
                window.__APP_STORE__.setState({
                    notesLoading: false,
                    papersLoading: false,
                    ideasLoading: false,
                    tasksLoading: false,
                    notes: [{id: "1", title: "Test Note", markdown_body: "Test Note", tags: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()}],
                    papers: [{id: "1", title: "Test Paper", status: "unread", authors: ["John Doe"], created_at: new Date().toISOString(), updated_at: new Date().toISOString()}],
                    ideas: [],
                    tasks: [{id: "1", title: "Test Task", status: "todo", priority: "high", created_at: new Date().toISOString(), updated_at: new Date().toISOString()}],
                    currentView: 'dashboard'
                });
            }
        """)

        # Wait for dashboard to load completely
        page.wait_for_selector('text=Ready to make some progress today?')

        # Take a screenshot
        page.screenshot(path="/app/verification/dashboard.png")

        browser.close()

if __name__ == "__main__":
    verify_dashboard()

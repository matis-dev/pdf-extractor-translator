
import pytest
from playwright.sync_api import Page, expect

def test_debug_console(page: Page, live_server_url):
    """Debug JS console errors."""
    console_logs = []
    page.on("console", lambda msg: console_logs.append(msg.text))
    page.on("pageerror", lambda err: console_logs.append(str(err)))

    page.goto(live_server_url + "/editor/dummy.pdf")
    page.wait_for_timeout(3000)

    print("\n--- CONSOLE LOGS ---")
    for log in console_logs:
        print(log)
    logs_str = "\n".join(console_logs)
    print(f"DEBUG: All Console Logs:\n{logs_str}")
    
    # Check attributes
    main_eval = page.evaluate("() => document.body.getAttribute('data-main-evaluating')")
    init_start = page.evaluate("() => document.body.getAttribute('data-init-started')")
    main_error = page.evaluate("() => document.body.getAttribute('data-main-error')")
    pdf_lib = page.evaluate("() => typeof window.PDFLib")
    
    print(f"DEBUG: main_eval={main_eval}")
    print(f"DEBUG: init_start={init_start}")
    print(f"DEBUG: main_error={main_error}")
    print(f"DEBUG: typeof PDFLib={pdf_lib}")

    if main_error:
        print(f"DEBUG: Main Error Found: {main_error}")

    # Check if Main started
    assert main_eval == 'true', f"Main.js did not evaluate! Logs:\n{logs_str}"
    
    # Check if Init started
    if not init_start and main_error:
        pytest.fail(f"Init failed with error: {main_error}")
    assert init_start == 'true', f"Init did not start! Logs:\n{logs_str}"

    ribbon_init = page.evaluate("() => document.body.getAttribute('data-ribbon-initialized')")
    print(f"DEBUG: ribbon_init={ribbon_init}")

    # Check if Ribbon initialized
    assert ribbon_init == 'true', f"Ribbon did not initialize! Logs:\n{logs_str}"

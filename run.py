import os
import uvicorn
import webbrowser
import threading
import time

def open_browser(port):
    time.sleep(1.2)
    webbrowser.open(f"http://localhost:{port}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    print("=" * 60)
    print("  WINDCOACH PRO - Tactical Race Wind Cockpit")
    print(f"  Avvio server su http://localhost:{port}")
    print("  Accessibile da smartphone/tablet sulla stessa rete Wi-Fi / Hotspot")
    print("=" * 60)
    
    # Open browser in a separate thread
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()
    
    # Run uvicorn server on 0.0.0.0 to enable tablet / phone access on boat
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)

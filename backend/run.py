import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Ensure backend/.env is loaded before creating the app
env_file = backend_dir / ".env"
if env_file.is_file():
    load_dotenv(dotenv_path=env_file, override=True)
else:
    root_env = backend_dir.parent / ".env"
    if root_env.is_file():
        load_dotenv(dotenv_path=root_env, override=True)
    else:
        load_dotenv(override=True)

from app import create_app

env = os.getenv("FLASK_ENV", "development")
app = create_app(env)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", str(app.config.get("DEBUG", True))).lower() in ("true", "1", "yes")
    app.run(host="127.0.0.1", port=port, debug=debug)

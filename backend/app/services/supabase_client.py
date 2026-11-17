import logging
from typing import Optional
from flask import current_app

try:
    from supabase import create_client, Client
except ImportError:
    Client = None
    create_client = None

logger = logging.getLogger(__name__)

class SupabaseService:
    """
    Manages trusted backend interactions with Supabase (Storage, Auth admin).
    The service role key is strictly isolated to backend processes.
    """
    _client: Optional[Client] = None
    _admin_client: Optional[Client] = None

    @classmethod
    def get_client(cls) -> Optional[Client]:
        """Returns standard Supabase client with anon key."""
        if cls._client:
            return cls._client

        url = current_app.config.get("SUPABASE_URL")
        anon_key = current_app.config.get("SUPABASE_ANON_KEY")

        if not url or not anon_key or create_client is None:
            logger.warning("Supabase credentials not configured or package missing.")
            return None

        cls._client = create_client(url, anon_key)
        return cls._client

    @classmethod
    def get_admin_client(cls) -> Optional[Client]:
        """
        Returns trusted Supabase client using Service Role Key.
        WORKER AND BACKEND ADMIN USE ONLY. NEVER EXPOSED TO CLIENT.
        """
        if cls._admin_client:
            return cls._admin_client

        url = current_app.config.get("SUPABASE_URL")
        service_key = current_app.config.get("SUPABASE_SERVICE_ROLE_KEY")

        if not url or not service_key or create_client is None:
            logger.warning("Supabase service role credentials not configured.")
            return None

        cls._admin_client = create_client(url, service_key)
        return cls._admin_client

    @classmethod
    def get_storage_bucket(cls, bucket_name: str):
        """Returns bucket reference from trusted admin client for storage tasks."""
        client = cls.get_admin_client()
        if not client:
            return None
        return client.storage.from_(bucket_name)

    @classmethod
    def is_configured(cls) -> bool:
        """Checks if minimal Supabase settings are present."""
        url = current_app.config.get("SUPABASE_URL")
        anon_key = current_app.config.get("SUPABASE_ANON_KEY")
        return bool(url and anon_key and "your-project-ref" not in url)

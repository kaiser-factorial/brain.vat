import os
import psycopg2
from urllib.parse import urlparse

# Read environment variables
supabase_url = os.environ.get('SUPABASE_URL')
supabase_user = os.environ.get('SUPABASE_USER')
supabase_password = os.environ.get('SUPABASE_PASSWORD')
supabase_host = os.environ.get('SUPABASE_HOST')
supabase_database = os.environ.get('POSTGRES_DATABASE')

print(f"Supabase URL: {supabase_url}")
print(f"Supabase Host: {supabase_host}")
print(f"Supabase Database: {supabase_database}")
print(f"User: {supabase_user}")

# Try to establish connection
try:
    conn = psycopg2.connect(
        host=supabase_host,
        database=supabase_database,
        user=supabase_user,
        password=supabase_password,
        port=5432  
    )
    print("Successfully connected to Supabase database!")
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    version = cursor.fetchone()
    print(f"PostgreSQL version: {version[0]}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error connecting to Supabase: {e}")

# Also test the real-time capability
try:
    import requests
    supabase_url = os.environ.get('SUPABASE_URL')
    if supabase_url:
        response = requests.get(f"{supabase_url}/rest/v1/messages?select=*", 
                             headers={'apikey': os.environ.get('SUPABASE_ANON_KEY')})
        if response.status_code in [200, 206]:
            print("REST API reachable")
        else:
            print(f"REST API error: {response.status_code}")
except Exception as e:
    print(f"API Test Error: {e}")


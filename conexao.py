import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

if __name__ == "__main__":
    resposta = supabase.table("categoria").select("*").execute()
    print("Conectado! Categorias:", resposta.data)
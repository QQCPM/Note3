from coursegen.config import GEMINI_API_KEY
from google import genai

print("API key set?", bool(GEMINI_API_KEY))
client = genai.Client(api_key=GEMINI_API_KEY)

models = list(client.models.list())
print("Total models returned:", len(models))
print()

for i, m in enumerate(models[:200], start=1):
    name = getattr(m, "name", None)
    methods = getattr(m, "supported_generation_methods", None)
    display = getattr(m, "display_name", None)
    print(f"{i:03d}. name={name} display={display} supported_methods={methods}")

print("\n--- done ---")

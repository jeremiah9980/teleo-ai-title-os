from fastapi import FastAPI
from ai.agents.intake_agent import process_intake

app = FastAPI(title="Teleo AI API")

@app.get("/healthz")
def health():
    return {"status": "ok"}

@app.post("/api/intake/process")
async def intake(data: dict):
    return await process_intake(data)

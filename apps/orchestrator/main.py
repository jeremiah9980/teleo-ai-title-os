from ai.agents.email_agent import classify_email
from ai.agents.intake_agent import process_intake

async def route(event):
    if event.get("type") == "email":
        result = await classify_email(event)

        if result["type"] == "new_order":
            return await process_intake(event)

    return {"status": "no_action"}

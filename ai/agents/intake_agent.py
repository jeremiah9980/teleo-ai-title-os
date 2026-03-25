from ai.tools.llm import call_llm

async def process_intake(payload):
    text = payload.get("document", "")

    extracted = await call_llm(f"""
    Extract real estate transaction data:
    property address, buyer, seller, lender, closing date

    {text}
    """)

    return {"status": "processed", "data": extracted}

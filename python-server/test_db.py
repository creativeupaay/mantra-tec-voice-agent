import asyncio
from config.database import init_db, get_db

async def main():
    await init_db()
    db = get_db()
    
    identities = await db.identities.find().to_list(length=10)
    memories = await db.memory.find().to_list(length=10)
    calls = await db.calls.find().to_list(length=10)
    
    print(f"Identities count: {len(identities)}")
    print(f"Memories count: {len(memories)}")
    print(f"Calls count: {len(calls)}")
    
    if identities:
        print("Sample Identity:", identities[-1])
    if memories:
        print("Sample Memory:", memories[-1])
    if calls:
        print("Sample Call:", calls[-1])

if __name__ == "__main__":
    asyncio.run(main())

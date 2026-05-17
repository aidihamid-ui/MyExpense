from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
def health():
    return "ok"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=False)

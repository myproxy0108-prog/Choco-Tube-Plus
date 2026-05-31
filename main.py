import asyncio
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse

import core
from routers import api, pages, proxy, shorts, tool


@asynccontextmanager
async def lifespan(app: FastAPI):
    core.http_client = httpx.AsyncClient(
        timeout=core._CLIENT_TIMEOUT,
        limits=core._CLIENT_LIMITS,
        follow_redirects=True,
    )
    task = asyncio.create_task(core._periodic_keepalive())
    yield
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)
    await core.http_client.aclose()


app = FastAPI(lifespan=lifespan)

app.include_router(proxy.router)
app.include_router(shorts.router)
app.include_router(api.router)
app.include_router(pages.router)
app.include_router(tool.router)

app.mount("/static", StaticFiles(directory="templates/static"), name="static")
app.mount("/photo", StaticFiles(directory="photo"), name="photo")
# ↓wistaのサーバー認証偽装（必ず一番最後）
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    return FileResponse("templates/tool/youtube/wista.html")

class StaticCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/static/"):
            response.headers["Cache-Control"] = "public, max-age=86400"
        return response


app.add_middleware(StaticCacheMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=500)

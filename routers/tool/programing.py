from fastapi import APIRouter, Request
from core import templates

router = APIRouter()


@router.get("/tool/programing")
async def programing_home(request: Request):
    return templates.TemplateResponse(
        request, "tool/programing/home.html", {"active": "tool"}
    )


@router.get("/tool/programing/html-editer")
async def html_editer(request: Request):
    return templates.TemplateResponse(
        request, "tool/programing/html-editer.html", {"active": "tool"}
    )


@router.get("/tool/programing/python-editer")
async def python_editer(request: Request):
    return templates.TemplateResponse(
        request, "tool/programing/python-editer.html", {"active": "tool"}
    )


@router.get("/tool/programing/sql-editer")
async def sql_editer(request: Request):
    return templates.TemplateResponse(
        request, "tool/programing/sql-editer.html", {"active": "tool"}
    )


@router.get("/tool/programing/markdown-editer")
async def markdown_editer(request: Request):
    return templates.TemplateResponse(
        request, "tool/programing/markdown-editer.html", {"active": "tool"}
    )


@router.get("/tool/programing/json-editer")
async def json_editer(request: Request):
    return templates.TemplateResponse(
        request, "tool/programing/json-editer.html", {"active": "tool"}
    )


@router.get("/tool/programing/workspace")
async def workspace(request: Request):
    return templates.TemplateResponse(
        request, "tool/programing/workspace.html", {"active": "tool"}
    )

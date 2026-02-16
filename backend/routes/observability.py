from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from services.observability_service import get_logs, get_log_detail, get_stats, get_timeseries

router = APIRouter()


@router.get("/logs")
async def list_logs(
    limit: int = 50,
    offset: int = 0,
    source: Optional[str] = None,
    provider_id: Optional[str] = None,
    model_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    org_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
):
    return await get_logs(
        limit=limit, offset=offset, source=source,
        provider_id=provider_id, model_id=model_id,
        status=status, start_date=start_date, end_date=end_date,
        org_id=org_id, workspace_id=workspace_id
    )


@router.get("/logs/{log_id}")
async def get_log(log_id: str):
    log = await get_log_detail(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


@router.get("/stats")
async def stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    org_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
):
    return await get_stats(start_date=start_date, end_date=end_date, org_id=org_id, workspace_id=workspace_id)


@router.get("/stats/timeseries")
async def timeseries(
    interval: Optional[str] = "hour",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    org_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
):
    return await get_timeseries(interval=interval, start_date=start_date, end_date=end_date,
                                org_id=org_id, workspace_id=workspace_id)


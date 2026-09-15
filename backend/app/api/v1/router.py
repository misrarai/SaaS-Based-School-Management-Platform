from fastapi import APIRouter

from app.api.v1.endpoints import (
    academic_years,
    assignments,
    attendance,
    auth,
    classes,
    courses,
    dashboard,
    fees,
    families,
    google_calendar,
    notifications,
    parents,
    payouts,
    progress,
    quizzes,
    resources,
    schedule,
    staff,
    students,
    teachers,
    tenants,
    uploads,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(tenants.router)
api_router.include_router(academic_years.router)
api_router.include_router(classes.router)
api_router.include_router(courses.router)
api_router.include_router(teachers.router)
api_router.include_router(students.router)
api_router.include_router(families.router)
api_router.include_router(staff.router)
api_router.include_router(uploads.router)
api_router.include_router(schedule.router)
api_router.include_router(google_calendar.router)
api_router.include_router(attendance.router)
api_router.include_router(parents.router)
api_router.include_router(fees.router)
api_router.include_router(resources.router)
api_router.include_router(assignments.router)
api_router.include_router(quizzes.router)
api_router.include_router(progress.router)
api_router.include_router(payouts.router)
api_router.include_router(notifications.router)
api_router.include_router(dashboard.router)

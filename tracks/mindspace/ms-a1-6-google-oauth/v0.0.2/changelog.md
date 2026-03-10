# ms-a1-6-google-oauth v0.0.2

## Changes from v0.0.1
- Added dedicated GET /google/failure route returning 401 JSON error
- Added FRONTEND_URL env var for JWT redirect (supports cross-domain deployment)
- Removed hardcoded failureRedirect to /login
- Redirect now uses ${FRONTEND_URL}/?token=... instead of /?token=...

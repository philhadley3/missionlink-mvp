# Changelog

## [1.0.0] - 2025-10-05
### Added
- Globe view with AnchorsForLife palette (#3673B7 water, #F4F4F4 land, #808080 borders)
- Missionary Dashboard: Save Profile & Save Countries flows
- Auth basics (sign in/out)
- Navbar color theming + centered verse overlay
- PDF upload/serve route (`/uploads/<file>`)

### Fixed
- Globe canvas sizing & centering in column
- Country outline visibility at various zoom levels
- Navbar formatting consistency across pages
- Indentation error in `app/__init__.py` for uploads route

### Security/Config
- CORS restricted to production origin
- Initial security headers scaffold (CSP/HSTS/etc.)
- Feature flags scaffold (risky features default OFF)

### Chores
- Version bump to `v1.0.0`
- Repo initialized; first annotated tag `v1.0.0`

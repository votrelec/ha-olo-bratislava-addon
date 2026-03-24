# Changelog

## 0.1.4

- Use OLO SVG badges in the ingress preview and upcoming list so the admin UI matches the dashboard card visuals.
- Add the `custom:olo-upcoming-pickups-card` companion card for multi-day pickup overviews.
- Stop capping backend `upcoming` payloads at eight rows so the new dashboard card can apply its own limit.
- Clarify that classic add-on options expect manual `notify.mobile_app_*` service IDs while the ingress UI provides a live picker.

## 0.1.3

- Keep ingress settings saves stable by syncing Supervisor options asynchronously after the UI response is sent.

## 0.1.2

- Republish Home Assistant entities every minute so cards recover automatically after a Home Assistant Core restart.

## 0.1.1

- Switch local Home Assistant deployment to a fresh slug to avoid stale Supervisor add-on metadata.
- Keep ingress frontend requests relative so the UI works correctly behind Home Assistant ingress.

## 0.1.0

- Initial implementation of the OLO Bratislava hybrid add-on and companion Lovelace card.

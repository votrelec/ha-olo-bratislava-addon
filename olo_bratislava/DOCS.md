# OLO Bratislava

This add-on is unofficial and is not affiliated with OLO.

## What it does

- fetches OLO Bratislava pickup schedules by registration number
- stores the latest raw and computed data in `/data`
- publishes Home Assistant entities for dashboards and automations
- provides an ingress UI for configuration and diagnostics
- sends optional persistent and mobile notifications one day before pickup

## Entities

- `sensor.olo_next_pickup`
- `binary_sensor.olo_pickup_tomorrow`
- `sensor.olo_pickup_status`

## Configuration

Use either the add-on options UI or the ingress UI.

Important fields:

- `source_url`
- `registration_number`
- category toggles for the waste types you want to show
- `refresh_interval_hours`
- notification settings
- `mobile_notify_services`

For the classic add-on options UI, `mobile_notify_services` is a manual list of
`notify.mobile_app_*` service IDs. Use the ingress UI when you want the live
picker populated from your current Home Assistant mobile notify services.

## Companion Lovelace card

The custom card file lives in this repository under `lovelace-card/olo-next-pickup-card.js`.

For a local Home Assistant install, copy it to:

```text
/config/www/olo-bratislava/olo-next-pickup-card.js
```

Then add a Lovelace resource:

```text
/local/olo-bratislava/olo-next-pickup-card.js
```

And use:

```yaml
type: custom:olo-next-pickup-card
entity: sensor.olo_next_pickup
```

Upcoming list card:

```yaml
type: custom:olo-upcoming-pickups-card
entity: sensor.olo_next_pickup
limit: 8
```

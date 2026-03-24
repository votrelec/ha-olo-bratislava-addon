# OLO Next Pickup Card

Unofficial companion Lovelace card for the OLO Bratislava Home Assistant add-on.

Copy `olo-next-pickup-card.js` to your Home Assistant `/config/www/olo-bratislava/` folder and add it as a Lovelace resource:

```text
/local/olo-bratislava/olo-next-pickup-card.js
```

Example card:

```yaml
type: custom:olo-next-pickup-card
entity: sensor.olo_next_pickup
title: OLO Bratislava
```

Upcoming list example:

```yaml
type: custom:olo-upcoming-pickups-card
entity: sensor.olo_next_pickup
limit: 8
```

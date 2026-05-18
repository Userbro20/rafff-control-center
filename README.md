# Rafff Control Center

Static dashboard for GitHub Pages that connects to the bot's authenticated dashboard API.

## What it controls

- Ticket panels
- Panel buttons/dropdown options
- Ticket types
- Ticket roles and categories
- Raw guild settings used by the ticket system
- Posting a panel to a Discord text channel

## Bot-side config

Add these values to `config.env` on the machine running the bot:

```env
DASHBOARD_API_ENABLED=true
DASHBOARD_API_HOST=0.0.0.0
DASHBOARD_API_PORT=8787
DASHBOARD_API_KEY=change-this-to-a-long-random-secret
DASHBOARD_ALLOWED_ORIGINS=https://YOUR_USERNAME.github.io
```

If you publish under a repository pages URL, use the full origin, for example:

```env
DASHBOARD_ALLOWED_ORIGINS=https://YOUR_USERNAME.github.io
```

or if you front the API with your own domain:

```env
DASHBOARD_ALLOWED_ORIGINS=https://tickets.yourdomain.com
```

## Bot hosting note

GitHub Pages only hosts the frontend. The API still needs to run on the bot host or another backend host that can reach Discord and the bot database.

## Publish to GitHub Pages

Upload the contents of this `dashboard/` folder to a GitHub Pages repo or the `docs/` folder of your repo.

## Connect from the site

Enter:

- API Base URL: `https://your-api-host:8787`
- API Key: the same value as `DASHBOARD_API_KEY`

Then click `Connect`.

## Security

- Do not commit your real API key.
- Restrict `DASHBOARD_ALLOWED_ORIGINS` to your actual Pages origin.
- Put the API behind HTTPS before exposing it publicly.
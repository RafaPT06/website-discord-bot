# Dashboard preview identity verification

- Authenticated preview requests prefer the signed-in Discord account over browser placeholder text.
- The selected guild is inferred from the dashboard server URL when the browser payload does not include a guild ID.
- Member lookup is attempted through the bot API before falling back to the OAuth session identity.
- Demo preview requests remain usable without authentication and do not perform member resolution.

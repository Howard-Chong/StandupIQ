# StandupIQ 🤖

> No more standup meetings. Just answers.

An AI-powered async standup agent for Slack that replaces daily standup
meetings by automatically collecting team updates, detecting hidden blockers
using Real-Time Search API, and generating smart digests with Slack AI.

---

## Progress

- [x] Milestone 1: Project structure and bot initialization
- [x] Milestone 2: Block Kit standup form
- [x] Milestone 3: Daily scheduler (9:00 AM cron)
- [ ] Milestone 4: Response collection and storage
- [ ] Milestone 5: RTS API integration
- [ ] Milestone 6: Slack AI digest generation
- [ ] Milestone 7: `/standup-report` slash command
- [ ] Milestone 8: End to end testing

---

## Features

- Daily async standup collection via Block Kit forms
- Real-Time Search API scans workspace for hidden blockers
- Slack AI generates smart team digests automatically
- `/standup-report` command for weekly summaries
- Socket Mode — no public URL or ngrok required

---

## Built With

- Node.js + Slack Bolt SDK (Socket Mode)
- Slack AI API
- Real-Time Search (RTS) API
- Block Kit
- node-cron

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd standupiq
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your Slack credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | App-Level Token with `connections:write` (`xapp-...`) |
| `SLACK_SIGNING_SECRET` | Signing Secret from Basic Information |

### 3. Enable Socket Mode

1. Go to https://api.slack.com/apps → your app
2. **Socket Mode** → toggle ON
3. **App-Level Tokens** → Generate Token with `connections:write` scope
4. Copy token into `.env` as `SLACK_APP_TOKEN`

### 4. Run

```bash
node index.js
```

The bot will connect to Slack via WebSocket and the daily scheduler will
trigger at 9:00 AM server time.

---

## Project Structure

```
standupiq/
├── .env                          # Secret tokens — NEVER commit
├── .gitignore
├── package.json
├── index.js                      # Main entry point
├── src/
│   ├── bot.js                    # Slack Bolt app initialization (Socket Mode)
│   ├── scheduler.js              # node-cron 9 AM daily trigger
│   ├── standup.js                # Collect standup responses
│   ├── digest.js                 # Generate and post AI digest
│   ├── rts.js                    # Real-Time Search API integration
│   └── commands.js               # /standup-report slash command
├── views/
│   └── standupForm.js            # Block Kit UI form
└── README.md
```

---

## Demo

*Coming soon*

---

## Author

Howard Chong

---

## License

MIT

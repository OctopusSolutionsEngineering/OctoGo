# OctoGo

An unofficial mobile companion app for [Octopus Deploy](https://octopus.com), built with Expo/React Native.

**Stay connected to your DevOps pipeline on the go.** Monitor deployments, manage releases, trigger runbooks, and keep your infrastructure healthy—all from your pocket.

---

## Features

### Core Functionality
- **Dashboard** — Real-time overview of deployments, projects, and system status
- **Projects** — Browse and search projects, view releases, create new releases
- **Deployments** — Monitor ongoing deployments with live activity logs
- **Environments** — View environment health and deployment target status
- **Targets** — Browse deployment targets with health status monitoring
- **Runbooks** — View and trigger runbook runs
- **Tenants** — Tenant management and deployments (Enterprise)
- **Insights** — DevOps metrics and analytics (Enterprise/Unlimited)
- **Events** — Audit log and event history
- **Global Search** — Find projects, deployments, and resources quickly

### Security First
- **Secure Authentication** — API key stored using encrypted device storage
- **Biometric Protection** — Optional Face ID / Touch ID to access the app
- **HTTPS Enforced** — All API communication uses secure connections

### User Experience
- **Light & Dark Themes** — System-aware with manual override
- **Favorites** — Quick access to frequently used projects
- **Native Performance** — Smooth 60fps animations and haptic feedback
- **Pull to Refresh** — Always up-to-date data at your fingertips
- **Multiple Instances** — Connect to different Octopus servers

---

## Security

### Credential Storage
- API keys are stored using `expo-secure-store`, which leverages:
  - **iOS**: Keychain Services with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
  - **Android**: Encrypted SharedPreferences backed by Android Keystore
- Credentials are never logged or exposed in error messages
- API keys are masked in the UI (`API-XXX...XXXX`)

### Network Security
- All API communication uses HTTPS
- Non-HTTPS connections are warned (only allowed for localhost development)
- Request timeouts prevent hanging connections
- Automatic retry with exponential backoff for transient failures

### Input Validation
- Server URLs are validated and normalised before storage
- API keys are validated for format and length
- Path segments are sanitized to prevent injection attacks

### Privacy
- No third-party analytics or tracking
- No data sent anywhere except your Octopus Deploy server
- Credentials stored locally on device only

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator, or Expo Go app on your device

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/OctoGo.git
cd OctoGo

# Install dependencies
npm install

# Start the development server
npm start
```

### Running the App

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Web (limited functionality)
npm run web
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

---

## Connecting to Octopus Deploy

1. Open the app
2. Enter your Octopus Deploy server URL (e.g., `https://your-org.octopus.app`)
3. Enter your API key ([How to create an API key](https://octopus.com/docs/octopus-rest-api/how-to-create-an-api-key))
4. Optionally specify a Space ID (defaults to default space)
5. Tap **Connect**

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | [Expo](https://expo.dev) (SDK 54) |
| Navigation | [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing) |
| Data Fetching | [TanStack Query](https://tanstack.com/query) |
| HTTP Client | [Axios](https://axios-http.com) |
| Secure Storage | [Expo Secure Store](https://docs.expo.dev/versions/latest/sdk/securestore/) |
| Biometrics | [Expo Local Authentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/) |
| Testing | Jest + React Testing Library |

---

## API Endpoints Used

The app uses the official [Octopus Deploy REST API](https://octopus.com/docs/octopus-rest-api):

| Feature | Endpoints |
|---------|-----------|
| Authentication | `/api/users/me`, `/api/serverstatus`, `/api/licenses/licenses-current-status` |
| Spaces | `/api/spaces`, `/api/spaces/all`, `/api/spaces/{id}` |
| Dashboard | `/api/{spaceId}/dashboard` |
| Projects | `/api/{spaceId}/projects`, `/api/{spaceId}/projectgroups`, `/api/{spaceId}/projects/{id}/progression` |
| Releases | `/api/{spaceId}/projects/{id}/releases`, `/api/{spaceId}/releases`, `/api/{spaceId}/releases/template`, `/api/{spaceId}/releases/{id}/progression` |
| Deployments | `/api/{spaceId}/deployments`, `/api/{spaceId}/releases/{id}/deployments/preview/{envId}` |
| Tasks | `/api/tasks`, `/api/tasks/{id}/details`, `/api/tasks/{id}/raw`, `/api/tasks/{id}/interruptions`, POST `/api/tasks`, POST `/api/tasks/{id}/cancel` |
| Interruptions | `/api/{spaceId}/interruptions`, `/api/{spaceId}/interruptions/{id}`, POST submit, PUT responsible |
| Environments | `/api/{spaceId}/environments`, `/api/{spaceId}/environments/all` |
| Lifecycles | `/api/{spaceId}/lifecycles`, `/api/{spaceId}/lifecycles/all` |
| Channels | `/api/{spaceId}/projects/{id}/channels` |
| Machines | `/api/{spaceId}/machines/all/v1`, `/api/{spaceId}/machines/{id}` |
| Runbooks | `/api/{spaceId}/runbooks`, `/api/{spaceId}/runbookRuns`, `/api/{spaceId}/runbookProcesses`, `/api/{spaceId}/runbooks/{id}/runbookSnapshots` |
| Variables | `/api/{spaceId}/projects/{id}/variables` |
| Processes | `/api/{spaceId}/projects/{id}/deploymentprocesses`, `/api/{spaceId}/runbookProcesses/{id}` |
| Tenants | `/api/{spaceId}/tenants`, `/api/{spaceId}/tenants/{id}`, `/api/{spaceId}/tenants/{id}/logo`, `/api/{spaceId}/tagsets/all` |
| Events | `/api/{spaceId}/events` |
| Packages | `/api/{spaceId}/feeds/{id}/packages/versions` |
| Observability | `/api/{spaceId}/projects/{id}/environments/{envId}/untenanted/livestatus`, `.../machines/.../resources/...` (Kubernetes live status) |

---

## Permissions Required

- **Network Access** — To communicate with your Octopus Deploy server
- **Face ID / Touch ID** (optional) — Biometric protection for app access

---

## Limitations

- This is an unofficial app
- OIDC/SSO authentication is not implemented (API key only), this means that your permission is already pre-scoped
- Some advanced features may have limited functionality compared to web UI

---

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

## License

MIT License — see [LICENSE](LICENSE) file for details.

---

## Disclaimer

This is an unofficial, community-built project - it is not a supported application. If you have any issues, please raise an issue here in GitHub.

For official Octopus Deploy support, please visit [octopus.com](https://octopus.com).

---

<p align="center">
  Built with 💙 for the Octopus Deploy community
</p>

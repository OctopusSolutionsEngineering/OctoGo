# OctoGo Widget Support

This directory contains configurations and shared code for iOS and Android widgets.

## iOS Widgets (WidgetKit)

iOS widgets are implemented using WidgetKit and require native Swift code.

### Widget Types

1. **Deployment Status Widget (Small)**
   - Shows the most recent deployment status
   - Quick glance at success/failure state

2. **Project Status Widget (Medium)**
   - Shows deployment status for favorite projects
   - Tap to navigate directly to project

3. **Dashboard Widget (Large)**
   - Overview of recent deployments across environments
   - Shows running/queued tasks count

### Setup Instructions

1. Open the project in Xcode after running `npx expo prebuild`
2. Add a new Widget Extension target
3. Use the shared data types from `shared-types.ts`
4. Configure App Groups for data sharing between app and widget

### Data Sharing

The app stores widget data in a shared UserDefaults suite that widgets can access:

```swift
let sharedDefaults = UserDefaults(suiteName: "group.com.octogo.shared")
```

## Android Widgets (Glance)

Android widgets use Jetpack Glance for a declarative widget API.

### Widget Types

1. **Deployment Status Widget**
   - Shows recent deployment status
   - Quick action to view task

2. **Project Quick Actions Widget**
   - Quick deploy buttons for favorite projects
   - Shows current environment status

### Setup Instructions

1. Run `npx expo prebuild`
2. Add widget definitions to `android/app/src/main/res/xml/`
3. Implement widget receivers in Kotlin
4. Use the shared data types from `shared-types.ts`

## Shared Data Types

The `shared-types.ts` file contains TypeScript interfaces that should be mirrored in native code for widget data:

- `WidgetDeploymentData`
- `WidgetProjectData`
- `WidgetDashboardData`


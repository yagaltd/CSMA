# CSMA Mobile Deployment Instructions

## Android
```bash
cd platforms/mobile-capacitor
npx cap open android
# Or build APK:
npx cap build android
```

## iOS
```bash
cd platforms/mobile-capacitor
npx cap open ios
# Or build IPA:
npx cap build ios
```

## Development
```bash
# Sync changes after web build
npx cap sync

# Run on device/emulator
npx cap run android
npx cap run ios
```

// Background entry points must be registered before the router mounts so they
// also exist when the OS starts the JS runtime headlessly (widget capture sync).
import './src/background';
import 'expo-router/entry';

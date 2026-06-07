import { registerRootComponent } from 'expo';

// Регистрируем фоновую задачу геолокации как можно раньше (в т.ч. при headless-
// запуске задачи самой ОС), чтобы её защита fail-closed всегда была активна.
import './locationTask';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

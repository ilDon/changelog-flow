import { PathsResolver } from 'changelog-flow/libs/paths/paths-resolver.class';
import { ActionPicker } from 'changelog-flow/processes/action-picker/action-picker.class';
import { ChangelogInitializer } from 'changelog-flow/processes/releases/creator/storer/changelog-initializer.class';

export function start(): void {
  new ActionPicker().get();
}

new PathsResolver().setPaths();
new ChangelogInitializer().init();
start();

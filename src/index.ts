import { PathsResolver } from '@bohr/changelogger/libs/paths/paths-resolver.class';
import { ActionPicker } from '@bohr/changelogger/processes/action-picker/action-picker.class';
import { ChangelogInitializer } from '@bohr/changelogger/processes/releases/creator/storer/changelog-initializer.class';

export function start(): void {
  new ActionPicker().get();
}

new PathsResolver().setPaths();
new ChangelogInitializer().init();
start();

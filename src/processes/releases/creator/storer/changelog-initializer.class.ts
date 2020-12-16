import { DIRS } from '@bohr/changelogger/libs/paths/dirs.constant';
import { DEFAULT_CONTENTS } from '@bohr/changelogger/processes/releases/creator/storer/deafult-contents.constant';
import { statSync, writeJSONSync } from 'fs-extra';

export class ChangelogInitializer {

  public init(): void {

    if (this.checkIfExists())
      return;

    this.createJsonFile();
  }

  private checkIfExists(): boolean {
    try {
      statSync(DIRS.pathToChangelogJson);
      return true;
    } catch (err) {
      return false;
    }
  }

  private createJsonFile(): void {
    writeJSONSync(DIRS.pathToChangelogJson, DEFAULT_CONTENTS, { spaces: 2 });
  }

}
